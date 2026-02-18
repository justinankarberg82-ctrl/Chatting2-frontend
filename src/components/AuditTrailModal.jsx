import { useEffect, useMemo, useRef, useState } from "react";

function ListIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function DownloadIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function toExportLines(events) {
  return (events || []).map((e) => {
    const when = e?.createdAt ? new Date(e.createdAt).toLocaleString() : e?.at ? new Date(e.at).toLocaleString() : "";
    const type = String(e?.type || "");
    const ip = e?.ip ? String(e.ip) : "";
    const msg = (() => {
      if (type === "LOGIN") return `Logged in${e?.username ? `: ${e.username}` : ""}`;
      if (type === "LOGOUT") return `Logged out${e?.username ? `: ${e.username}` : ""}`;
      if (type === "CHAT_CREATED") return `${e?.username || "User"} created a new chat${e?.title ? `: "${e.title}"` : ""}`;
      if (type === "CHAT_DELETED") return `${e?.username || "User"} deleted a chat${e?.title ? `: "${e.title}"` : ""}`;
      if (type === "USAGE") {
        const stage = String(e?.stage || "").toLowerCase();
        if (stage === "request") return `Request +1, credits ~+${Number(e?.tokensUsed ?? 0)}`;
        if (stage === "complete") {
          const d = Number(e?.tokensDelta ?? 0);
          return d ? `Credits adjust ${d > 0 ? "+" : ""}${d}` : `Credits +${Number(e?.tokensUsed ?? 0)}`;
        }
        return `Usage event`;
      }
      if (type === "AUDIT") {
        const actor = e?.actorUsername || "System";
        if (e.action === "CREATE_USER") return `Account created by ${actor}`;
        if (e.action === "DELETE_USER") return `Account deleted by ${actor}`;
        if (e.action === "UPDATE_USER") {
          const ch = e?.metadata?.changes;
          if (ch?.username) return `Username changed: ${ch.username.from} -> ${ch.username.to}`;
          if (ch?.role) return `Role changed: ${ch.role.from} -> ${ch.role.to}`;
          if (ch?.isActive) return `Status changed: ${ch.isActive.from ? "active" : "disabled"} -> ${ch.isActive.to ? "active" : "disabled"}`;
          return `Updated by ${actor}`;
        }
        return `${e.action || "AUDIT"} by ${actor}`;
      }
      return type || "Event";
    })();

    return `[${when}] ${msg}${ip ? ` (ip: ${ip})` : ""}`;
  });
}

function buildDetails(e) {
  const type = String(e?.type || "");
  const when = e?.createdAt ? new Date(e.createdAt) : e?.at ? new Date(e.at) : null;
  const time = when ? when.toLocaleString() : "";

  const main = (() => {
    if (type === "LOGIN" || type === "LOGOUT") return `${type}: ${e?.username || "User"}`;
    if (type === "CHAT_CREATED") return `CHAT_CREATED by ${e?.username || "User"}${e?.title ? `: "${e.title}"` : ""}`;
    if (type === "CHAT_DELETED") return `CHAT_DELETED by ${e?.username || "User"}${e?.title ? `: "${e.title}"` : ""}`;
    if (type === "USAGE") {
      const stage = String(e?.stage || "").toLowerCase();
      if (stage === "request") return `USAGE (request): requests +1, credits ~+${Number(e?.tokensUsed ?? 0)}`;
      if (stage === "complete") {
        const d = Number(e?.tokensDelta ?? 0);
        return `USAGE (complete): credits adjust ${d > 0 ? "+" : ""}${d}`;
      }
      return `USAGE`;
    }
    if (type === "AUDIT") {
      const actor = e?.actorUsername || "System";
      const target = e?.targetUsername ? ` -> ${e.targetUsername}` : "";
      return `AUDIT ${e?.action || ""}${target} (by ${actor})`.trim();
    }
    return type || "Event";
  })();

  const meta = (() => {
    const out = {};
    if (e?.userId) out.userId = e.userId;
    if (e?.username) out.username = e.username;
    if (e?.ip) out.ip = e.ip;
    if (e?.chatId) out.chatId = e.chatId;
    if (typeof e?.tokensUsed === "number") out.tokensUsed = e.tokensUsed;
    if (typeof e?.tokensDelta === "number") out.tokensDelta = e.tokensDelta;
    if (e?.action) out.action = e.action;
    if (e?.actorUsername) out.actorUsername = e.actorUsername;
    if (e?.targetUsername) out.targetUsername = e.targetUsername;
    if (e?.metadata && Object.keys(e.metadata).length) out.metadata = e.metadata;
    return out;
  })();

  return { main, time, meta };
}

function getCardView(e) {
  const type = String(e?.type || "").toUpperCase();
  const username = e?.username ? String(e.username) : null;
  const when = e?.createdAt ? new Date(e.createdAt) : e?.at ? new Date(e.at) : null;
  const time = when ? when.toLocaleString() : "";

  const base = {
    title: type || "Event",
    message: "",
    accent: "#64748b",
    time,
  };

  if (type === "LOGIN") return { ...base, title: "Login", message: `${username || "User"} logged in`, accent: "#22c55e" };
  if (type === "LOGOUT") return { ...base, title: "Logout", message: `${username || "User"} logged out`, accent: "#94a3b8" };

  if (type === "CHAT_CREATED") {
    return {
      ...base,
      title: "Chat",
      message: `${username || "User"} created a new chat${e?.title ? `: "${e.title}"` : ""}`,
      accent: "#3b82f6",
    };
  }
  if (type === "CHAT_DELETED") {
    return {
      ...base,
      title: "Chat",
      message: `${username || "User"} deleted a chat${e?.title ? `: "${e.title}"` : ""}`,
      accent: "#ef4444",
    };
  }

  if (type === "AUDIT") {
    const actor = e?.actorUsername ? String(e.actorUsername) : "System";
    const action = e?.action ? String(e.action) : "AUDIT";
    const target = e?.targetUsername ? String(e.targetUsername) : (e?.username ? String(e.username) : "");

    const actionLabel =
      action === "CREATE_USER"
        ? "created user"
        : action === "DELETE_USER"
          ? "deleted user"
          : action === "UPDATE_USER"
            ? "updated user"
            : action.toLowerCase().split("_").join(" ");

    return {
      ...base,
      title: "Admin",
      message: `${actor} ${actionLabel}${target ? `: ${target}` : ""}`,
      accent: "#64748b",
    };
  }

  return base;
}

function formatAuditChangeValue(v) {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "—";
  return String(v);
}

function getAuditChangeLines(e) {
  const changes = e?.metadata?.changes;
  if (!changes || typeof changes !== "object") return [];

  const out = [];
  const keys = Object.keys(changes);
  for (const k of keys) {
    const ch = changes[k];
    if (!ch || typeof ch !== "object") continue;

    if (k === "isActive") {
      const from = ch.from ? "active" : "disabled";
      const to = ch.to ? "active" : "disabled";
      out.push(`Status: ${from} -> ${to}`);
      continue;
    }

    const from = formatAuditChangeValue(ch.from);
    const to = formatAuditChangeValue(ch.to);
    out.push(`${k}: ${from} -> ${to}`);
  }
  return out;
}

export default function AuditTrailModal({ open, onClose, title, subtitle, events, exportName = "audit" }) {
  const [visible, setVisible] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const listRef = useRef(null);

  const pageSize = 100;

  useEffect(() => {
    if (open) requestAnimationFrame(() => setVisible(true));
    else setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Reset controls when modal opens.
    setQuery("");
    setSortDir("desc");
    setTypeFilter("all");
    setPage(1);
  }, [open]);

  const normalized = useMemo(() => {
    return (events || []).map((e, idx) => ({
      ...e,
      _key: String(e?._id || `${e?.type || "evt"}:${e?.createdAt || e?.at || ""}:${idx}`),
    }));
  }, [events]);

  const availableTypes = useMemo(() => {
    const set = new Set();
    for (const e of normalized) {
      const t = String(e?.type || "").toUpperCase();
      if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [normalized]);

  const items = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const tf = String(typeFilter || "all").toLowerCase();

    const filtered = (normalized || []).filter((e) => {
      const t = String(e?.type || "").toUpperCase();
      if (tf !== "all" && String(t).toLowerCase() !== tf) return false;
      if (!q) return true;

      const d = buildDetails(e);
      const v = getCardView(e);
      const hay = [
        t,
        e?.username,
        e?.actorUsername,
        e?.targetUsername,
        e?.action,
        e?.title,
        e?.ip,
        v?.title,
        v?.message,
        d?.main,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });

    const sorted = filtered.slice().sort((a, b) => {
      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : a?.at ? new Date(a.at).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : b?.at ? new Date(b.at).getTime() : 0;
      return sortDir === "asc" ? ta - tb : tb - ta;
    });

    return sorted;
  }, [normalized, query, sortDir, typeFilter]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    const el = listRef.current;
    if (el) el.scrollTop = 0;
  }, [open, query, sortDir, typeFilter]);

  const shownCount = Math.min(items.length, page * pageSize);
  const pagedItems = items.slice(0, shownCount);
  const canLoadMore = shownCount < items.length;

  const onScrollList = () => {
    const el = listRef.current;
    if (!el || !canLoadMore) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 160) setPage((p) => p + 1);
  };

  useEffect(() => {
    if (!exportMenuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setExportMenuOpen(false);
    };
    const onClick = (e) => {
      // Close if click happened outside the menu.
      if (!e.target?.closest?.("[data-export-menu='true']")) {
        setExportMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [exportMenuOpen]);

  const startExport = (fmt) => {
    const ts = new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}`;

    const format = String(fmt || "json").toLowerCase() === "txt" ? "txt" : "json";
    const mime = format === "txt" ? "text/plain" : "application/json";
    const suggestedName = `${exportName}-${stamp}.${format}`;

    const getContent = () => {
      if (format === "txt") {
        const lines = toExportLines(normalized);
        return lines.join("\n") + "\n";
      }
      return JSON.stringify(normalized, null, 2);
    };

    const saveWithDownload = () => {
      const content = getContent();
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    // Close the menu immediately (doesn't affect user gesture).
    setExportMenuOpen(false);

    // If File System Access API is available, call it directly from the click.
    if (window.showSaveFilePicker) {
      let pickerPromise;
      try {
        pickerPromise = window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: format === "json" ? "JSON" : "Text",
              accept: { [mime]: [format === "json" ? ".json" : ".txt"] },
            },
          ],
        });
      } catch {
        saveWithDownload();
        return;
      }

      pickerPromise
        .then((handle) => handle.createWritable())
        .then((writable) => writable.write(getContent()).then(() => writable.close()))
        .catch((err) => {
          // User cancelled the dialog.
          if (err?.name === "AbortError") return;
          // Common cases: missing user gesture / blocked picker.
          if (err?.name === "SecurityError") {
            saveWithDownload();
            return;
          }
          // Fall back instead of breaking the UI.
          saveWithDownload();
        });
      return;
    }

    saveWithDownload();
  };

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
          zIndex: 300,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.98})`,
          opacity: visible ? 1 : 0,
          width: "min(980px, calc(100vw - 28px))",
          height: "min(78vh, 760px)",
          padding: 0,
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
          zIndex: 310,
          fontFamily: "'Space Grotesk','IBM Plex Sans','Segoe UI',Arial,sans-serif",
          transition: "opacity 180ms ease-out, transform 180ms ease-out",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: "#111827",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Audit trail"
              >
                <ListIcon color="#ffffff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: "#0f172a" }}>{title}</div>
                {subtitle ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 560,
                    }}
                    title={subtitle}
                  >
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ position: "relative" }} data-export-menu="true">
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
                title="Export"
              >
                <DownloadIcon />
                Export
              </button>

              {exportMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 180,
                    borderRadius: 14,
                    border: "1px solid rgba(15, 23, 42, 0.10)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 18px 40px rgba(2, 6, 23, 0.18)",
                    overflow: "hidden",
                    zIndex: 999,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => startExport("json")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Export as JSON
                  </button>
                  <div style={{ height: 1, background: "rgba(15, 23, 42, 0.08)" }} />
                  <button
                    type="button"
                    onClick={() => startExport("txt")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Export as TXT
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                fontSize: 18,
                cursor: "pointer",
                color: "#6b7280",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #e5e7eb",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  pointerEvents: "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "9px 10px 9px 34px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: "9px 10px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
              }}
              title="Filter by type"
            >
              <option value="all">All types</option>
              {availableTypes.map((t) => (
                <option key={t} value={String(t).toLowerCase()}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              style={{
                padding: "9px 10px",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
              }}
              title="Sort order"
            >
              <option value="desc">Newest</option>
              <option value="asc">Oldest</option>
            </select>
          </div>

           <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, whiteSpace: "nowrap" }}>
             {pagedItems.length} / {items.length}
           </div>
         </div>

         <div
           ref={listRef}
           onScroll={onScrollList}
           style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#f8fafc", padding: 12 }}
         >
           {items.length === 0 ? (
             <div style={{ padding: 14, fontSize: 13, color: "#6b7280" }}>No events.</div>
           ) : (
              pagedItems.map((e) => {
                const d = buildDetails(e);
                const v = getCardView(e);
                const isAudit = String(e?.type || "").toUpperCase() === "AUDIT";
                const auditLines = isAudit ? getAuditChangeLines(e) : [];
                const ip = e?.ip ? String(e.ip) : "";
                return (
                <div
                  key={e._key}
                  style={{
                    padding: 0,
                    background: "transparent",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      overflow: "hidden",
                      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
                    }}
                  >
                    <div style={{ padding: "10px 12px", borderLeft: `5px solid ${v.accent}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{v.title}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#94a3b8",
                            fontWeight: 800,
                            fontFamily:
                              "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {v.time || d.time}
                        </div>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 13, color: "#334155", lineHeight: 1.25 }}>
                        {v.message || d.main}
                      </div>

                      {ip ? (
                        <div
                          style={{
                            marginTop: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "#f1f5f9",
                            border: "1px solid #e5e7eb",
                            color: "#0f172a",
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily:
                              "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                          }}
                          title={ip}
                        >
                          IP
                          <span style={{ opacity: 0.75 }}>{ip}</span>
                        </div>
                      ) : null}

                      {isAudit && auditLines.length > 0 ? (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          {auditLines.map((line) => (
                            <div
                              key={line}
                              style={{
                                fontSize: 12,
                                color: "#0f172a",
                                background: "#f8fafc",
                                border: "1px solid #e5e7eb",
                                borderRadius: 12,
                                padding: "6px 8px",
                                fontFamily:
                                  "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={line}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {d.meta && Object.keys(d.meta).length ? (
                        <pre
                          style={{
                            marginTop: 10,
                            marginBottom: 0,
                            padding: 10,
                            background: "#0b1220",
                            color: "#e5e7eb",
                            borderRadius: 12,
                            fontSize: 12,
                            lineHeight: 1.25,
                            overflowX: "auto",
                          }}
                        >
                          {JSON.stringify(d.meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </div>
               );
             })
           )}

           {canLoadMore ? (
             <div style={{ padding: 10, display: "flex", justifyContent: "center" }}>
               <button
                 type="button"
                 onClick={() => setPage((p) => p + 1)}
                 style={{
                   padding: "10px 12px",
                   borderRadius: 12,
                   border: "1px solid #e5e7eb",
                   background: "#ffffff",
                   fontSize: 12,
                   fontWeight: 700,
                   cursor: "pointer",
                 }}
               >
                 Load {Math.min(pageSize, items.length - shownCount)} more
               </button>
             </div>
           ) : null}
         </div>
       </div>
     </>
  );
}
