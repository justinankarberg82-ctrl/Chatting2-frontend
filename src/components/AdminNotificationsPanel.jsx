import { useEffect, useMemo, useState } from "react";
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

function getEventView(evt) {
  const type = String(evt?.type || "").toUpperCase();
  const username = evt?.username ? String(evt.username) : null;
  const at = evt?.at ? new Date(evt.at) : new Date();

  const base = {
    title: "Event",
    message: "",
    color: "#111827",
    accent: "#64748b",
    time: at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };

  if (type === "LOGIN") {
    return { ...base, title: "Login", message: `${username || "User"} logged in`, accent: "#22c55e" };
  }
  if (type === "LOGOUT") {
    return { ...base, title: "Logout", message: `${username || "User"} logged out`, accent: "#94a3b8" };
  }
  if (type === "CHAT_CREATED") {
    return {
      ...base,
      title: "Chat",
      message: `${username || "User"} created a new chat${evt?.title ? `: "${evt.title}"` : ""}`,
      accent: "#3b82f6",
    };
  }
  if (type === "CHAT_DELETED") {
    return {
      ...base,
      title: "Chat",
      message: `${username || "User"} deleted a chat${evt?.title ? `: "${evt.title}"` : ""}`,
      accent: "#ef4444",
    };
  }
  if (type === "USER_CREATED") {
    return {
      ...base,
      title: "User",
      message: `User created: ${username || ""}`.trim(),
      accent: "#14b8a6",
    };
  }
  if (type === "USER_UPDATED") {
    return {
      ...base,
      title: "User",
      message: `User updated: ${username || ""}`.trim(),
      accent: "#f59e0b",
    };
  }
  if (type === "USER_DELETED") {
    return {
      ...base,
      title: "User",
      message: `User deleted: ${username || ""}`.trim(),
      accent: "#ef4444",
    };
  }
  if (type === "USAGE") {
    return null;
  }

  if (type === 'AUDIT') {
    const action = String(evt?.action || 'updated');
    const actor = evt?.actorUsername ? String(evt.actorUsername) : 'System';
    const target = evt?.targetUsername ? String(evt.targetUsername) : '';
    const msg = `${actor} ${action}${target ? `: ${target}` : ''}`;
    return {
      ...base,
      title: 'Admin',
      message: msg,
      accent: '#64748b',
    };
  }

  return { ...base, title: type || base.title, message: username ? `User: ${username}` : "" };
}

export default function AdminNotificationsPanel({ event, token }) {
  const [animKey, setAnimKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const [fallbackEvent, setFallbackEvent] = useState(null);

  useEffect(() => {
    if (!event) return;
    setAnimKey((k) => k + 1);
  }, [event]);

  useEffect(() => {
    if (!token) return;
    if (event) {
      setFallbackEvent(null);
      return;
    }

    // On initial admin login the socket event can be missed; show the latest server-side event.
    const ctrl = new AbortController();
    fetch('/api/admin/events?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        const first = arr.find((e) => {
          const t = String(e?.type || '').toUpperCase();
          return t && t !== 'USAGE' && t !== 'PRESENCE';
        });
        setFallbackEvent(first || null);
      })
      .catch(() => {
        setFallbackEvent(null);
      });

    return () => ctrl.abort();
  }, [token, event]);

  const view = useMemo(() => {
    const src = event || fallbackEvent;
    if (!src) return null;
    return getEventView(src);
  }, [event, fallbackEvent]);

  useEffect(() => {
    if (!showAll) return;
    if (!token) return;

    const ctrl = new AbortController();
    fetch("/api/admin/events?limit=200", {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        setAllEvents(arr.filter((e) => String(e?.type || '').toUpperCase() !== 'USAGE'));
      })
      .catch(() => setAllEvents([]));

    return () => ctrl.abort();
  }, [showAll, token]);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 5,
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <style>{`
          @keyframes chromeToastIn {
            0% {
              transform: translateX(28px);
            }
            100% {
              transform: translateX(0);
            }
          }
        `}</style>

        {!view ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 14,
              border: "1px dashed #e5e7eb",
              background: "#f8fafc",
              color: "#64748b",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            No notifications yet.
          </div>
        ) : (
          <div
            key={animKey}
            style={{
              width: "100%",
              height: "100%",
              background: "#343434",
              borderRadius: 14,
              boxShadow: "0 14px 40px rgba(15, 23, 42, 0.14)",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              animation: "chromeToastIn 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 220ms both",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ height: 4, background: view.accent }} />
            <div style={{ padding: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: view.accent,
                  flexShrink: 0,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>

              <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>{view.title}</div>
                  <div
                    style={{
                      fontFamily:
                        "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.7)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {view.time}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 15,
                    color: "rgba(255,255,255,0.9)",
                    lineHeight: 1.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {view.message || ""}
                </div>

                <div style={{ marginTop: "auto", paddingTop: 10, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    title="See all"
                    style={{
                      padding: "7px 10px",
                      borderRadius: 12,
                      border: "none",
                      background: "rgba(255,255,255,0.06)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#ffffff",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    }}
                  >
                    <ListIcon />
                    See all
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AuditTrailModal
        open={showAll}
        onClose={() => setShowAll(false)}
        title="All notifications"
        subtitle="Recent admin events"
        events={allEvents}
        exportName="admin-events"
      />
    </div>
  );
}
