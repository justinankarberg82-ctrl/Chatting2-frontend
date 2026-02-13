import { useEffect, useMemo, useRef, useState } from "react";
import AuditTrailModal from "./AuditTrailModal";

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
    const when = e?.createdAt ? new Date(e.createdAt).toLocaleString() : "";
    const msg = (() => {
      if (e?.type === "LOGIN") return "Logged in";
      if (e?.type === "LOGOUT") return "Logged out";
      if (e?.type === "CHAT_CREATED")
        return `New chat created${e.title ? `: "${e.title}"` : ""}`;
      if (e?.type === "CHAT_DELETED")
        return `Chat deleted${e.title ? `: "${e.title}"` : ""}`;
      if (e?.type === "AUDIT") {
        const actor = e.actorUsername || e?.actorId?.username || "System";
        if (e.action === "CREATE_USER") return `Account created by ${actor}`;
        if (e.action === "DELETE_USER") return `Account deleted by ${actor}`;
        if (e.action === "UPDATE_USER") {
          const ch = e?.metadata?.changes;
          if (ch?.username)
            return `Username changed: ${ch.username.from} -> ${ch.username.to}`;
          if (ch?.role) return `Role changed: ${ch.role.from} -> ${ch.role.to}`;
          if (ch?.isActive)
            return `Status changed: ${ch.isActive.from ? "active" : "disabled"} -> ${ch.isActive.to ? "active" : "disabled"}`;
          return `Updated by ${actor}`;
        }
        return `${e.action || "AUDIT"} by ${actor}`;
      }
      return "Event";
    })();

    return `[${when}] ${msg}`;
  });
}

export default function UserActivityPanel({ selectedUser, events }) {
  const prevIdsRef = useRef(new Set());
  const [newIds, setNewIds] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);

  const normalized = useMemo(() => {
    return (events || []).map((e, idx) => ({
      ...e,
      _key: String(e?._id || `${e?.type || "evt"}:${e?.createdAt || ""}:${e?.action || ""}:${idx}`),
    }));
  }, [events]);

  useEffect(() => {
    const ids = normalized.map((e) => e._key);
    if (!ids.length) {
      prevIdsRef.current = new Set();
      setNewIds(new Set());
      return;
    }

    const prev = prevIdsRef.current;
    const nextNew = [];
    for (const id of ids.slice(0, 12)) {
      if (!prev.has(id)) nextNew.push(id);
    }

    prevIdsRef.current = new Set(ids);
    if (!nextNew.length) return;

    setNewIds(new Set(nextNew));
    const t = setTimeout(() => setNewIds(new Set()), 1200);
    return () => clearTimeout(t);
  }, [normalized]);

  const onExport = async () => {
    if (!selectedUser) return;
    const username = String(selectedUser.username || "user").trim() || "user";
    const ts = new Date();
    const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}`;

    const pickAndSave = async (content, suggestedName, mime) => {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: mime === "application/json" ? "JSON" : "Text",
              accept: { [mime]: [suggestedName.endsWith(".json") ? ".json" : ".txt"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      }

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

    const choice = window.prompt("Export format: json or txt", "json");
    const fmt = String(choice || "json").trim().toLowerCase();

    if (fmt === "txt") {
      const lines = toExportLines(normalized);
      await pickAndSave(
        lines.join("\n") + "\n",
        `${username}-activity-${stamp}.txt`,
        "text/plain",
      );
    } else {
      await pickAndSave(
        JSON.stringify(events || [], null, 2),
        `${username}-activity-${stamp}.json`,
        "application/json",
      );
    }
  };

  return (
    <div
      style={{
        flex: "0 0 40%",
        maxWidth: "40%",
        minWidth: 0,
        minHeight: 0,
        background: "#f3f4f6",
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Space Grotesk','IBM Plex Sans','Segoe UI',Arial,sans-serif",
      }}
    >
      <div
        style={{
          padding: "7px 12px 7px",
          borderBottom: "1px solid #57708a",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>Activities</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            disabled={!selectedUser}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              opacity: selectedUser ? 1 : 0.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            title="See all"
          >
            <ListIcon />
            See all
          </button>

          <button
            type="button"
            onClick={onExport}
            disabled={!selectedUser}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              opacity: selectedUser ? 1 : 0.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
            title="Export activity"
          >
            <DownloadIcon />
            Export
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0,
          background: "#f8fafc",
        }}
      >
        <style>{`
          @keyframes activityEnter {
            0% {
              background: #f0f9ff;
              opacity: 0;
              transform: translateX(18px);
            }
            60% { opacity: 1; }
            100% {
              background: inherit;
              opacity: 1;
              transform: translateX(0);
            }
          }

          .activity-row { position: relative; }
          .activity-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
          .activity-label {
            display: inline-flex;
            align-items: center;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.35px;
            color: #475569;
            text-transform: uppercase;
          }
          .activity-msg {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            white-space: normal;
          }
        `}</style>

        {!selectedUser && (
          <div style={{ color: "#6b7280", fontSize: 13, padding: 12 }}>
            Select a user to see activity.
          </div>
        )}

        {selectedUser && normalized.length === 0 && (
          <div style={{ color: "#6b7280", fontSize: 13, padding: 12 }}>
            No activity for this user.
          </div>
        )}

        {selectedUser &&
          normalized.map((event, idx) => {
            const when = event?.createdAt ? new Date(event.createdAt).toLocaleString() : "";
            const isLogin = event?.type === "LOGIN";
            const isLogout = event?.type === "LOGOUT";
            const isAudit = event?.type === "AUDIT";

            const actor = isAudit
              ? event?.actorUsername || event?.actorId?.username || "System"
              : selectedUser?.username || "User";

            const msg = (() => {
              if (isLogin) return "Logged in";
              if (isLogout) return "Logged out";
              if (event?.type === "CHAT_CREATED")
                return `New chat created${event?.title ? `: "${event.title}"` : ""}`;
              if (event?.type === "CHAT_DELETED")
                return `Chat deleted${event?.title ? `: "${event.title}"` : ""}`;
              if (isAudit) {
                if (event.action === "CREATE_USER") return `Account created by ${actor}`;
                if (event.action === "DELETE_USER") return `Account deleted by ${actor}`;
                if (event.action === "UPDATE_USER") {
                  const ch = event?.metadata?.changes;
                  if (ch?.username) return `Username changed to '${ch.username.to}'`;
                  if (ch?.role) return `Role set to '${ch.role.to}'`;
                  if (ch?.isActive) return `Status set to '${ch.isActive.to ? "active" : "disabled"}'`;
                  return `Account updated by ${actor}`;
                }
                return `${event.action || "Action"} by ${actor}`;
              }
              return "Activity";
            })();

            const accentColor = isLogin
              ? "#22c55e"
              : isLogout
                ? "#94a3b8"
                : event?.type === "CHAT_CREATED"
                  ? "#3b82f6"
                  : event?.type === "CHAT_DELETED"
                    ? "#ef4444"
                    : isAudit && event.action === "CREATE_USER"
                      ? "#14b8a6"
                      : isAudit && event.action === "DELETE_USER"
                        ? "#ef4444"
                        : isAudit && event.action === "UPDATE_USER" && event?.metadata?.changes?.role
                          ? "#8b5cf6"
                          : isAudit && event.action === "UPDATE_USER" && event?.metadata?.changes?.username
                            ? "#14b8a6"
                            : isAudit &&
                                  event.action === "UPDATE_USER" &&
                                  event?.metadata?.changes?.isActive?.to === false
                              ? "#f59e0b"
                              : "#64748b";

            const labelText = isLogin
              ? "Login"
              : isLogout
                ? "Logout"
                : event?.type === "CHAT_CREATED"
                  ? "Chat"
                  : event?.type === "CHAT_DELETED"
                    ? "Chat"
                    : isAudit
                      ? "Admin"
                      : "Event";

            const rowBg = idx % 2 === 0 ? "#fbfdff" : "#f8fafc";

            return (
              <div
                key={event._key || `${event.type}-${idx}`}
                className="activity-row"
                style={{
                  padding: "10px 12px 9px 14px",
                  background: rowBg,
                  border: "none",
                  boxShadow: "none",
                  borderBottom: "1px solid #e5e7eb",
                  fontSize: 13,
                  lineHeight: 1.3,
                  letterSpacing: 0,
                  animation: newIds.has(event._key)
                    ? "activityEnter 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both"
                    : "none",
                  willChange: "transform, opacity",
                }}
              >
                <span className="activity-accent" style={{ background: accentColor }} />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span className="activity-label">{labelText}</span>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: accentColor }} />
                    </div>
                    <div
                      className="activity-msg"
                      title={msg}
                      style={{
                        fontWeight: 400,
                        color: "#0f172a",
                      }}
                    >
                      {msg}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "#64748b",
                    fontWeight: 500,
                    letterSpacing: 0.2,
                    textTransform: "none",
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ color: "#475569" }}>
                    {isAudit ? `By ${actor}` : `User ${actor}`}
                  </span>
                  <span
                    style={{
                      fontFamily:
                        "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                      color: "#94a3b8",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                      letterSpacing: 0,
                      textTransform: "none",
                    }}
                  >
                    {when}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      <AuditTrailModal
        open={showAll}
        onClose={() => setShowAll(false)}
        title="User activity"
        subtitle={selectedUser?.username ? `User: ${selectedUser.username}` : ""}
        events={normalized}
        exportName={selectedUser?.username ? `${String(selectedUser.username).trim() || "user"}-activity` : "user-activity"}
      />
    </div>
  );
}
