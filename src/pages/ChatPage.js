import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

export default function ChatPage() {
  const { token, user, logout, logoutSignal, setLogoutSignal } = useAuth();
  const CHAT_COLUMN_WIDTH = 768;
  const SIDEBAR_WIDTH = 260;
  const [emptyStage, setEmptyStage] = useState("shown"); // shown | leaving | hidden
  const prevMsgLenRef = useRef(0);
  const [startAnim, setStartAnim] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimerRef = useRef(null);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 800);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 800);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [logoutAnimating, setLogoutAnimating] = useState(false);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token || localStorage.getItem("token")}` }),
    [token],
  );

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 800;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent page-level scrollbar; keep scrolling only inside dialogue area
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch("/api/chats", { headers: authHeader })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error('unauthorized');
        return res.json();
      })
      .then(setChats)
      .catch(() => {
        // token invalid/disabled
        setLogoutAnimating(true);
        setTimeout(() => logout(), 250);
      });
  }, [authHeader, logout]);

  useEffect(() => {
    if (!logoutSignal || logoutAnimating) return;
    setLogoutAnimating(true);
    // allow time for a clean animation, then logout
    const t = setTimeout(() => {
      setLogoutSignal?.(null);
      logout();
    }, 250);
    return () => clearTimeout(t);
  }, [logoutSignal, logoutAnimating, logout, setLogoutSignal]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const prevLen = prevMsgLenRef.current;
    const nextLen = messages.length;
    prevMsgLenRef.current = nextLen;

    // Control empty-state overlay so it can animate out instead of disappearing instantly.
    if (nextLen === 0) {
      setEmptyStage("shown");
      setStartAnim(false);
      return;
    }

    if (prevLen === 0 && nextLen > 0) {
      setEmptyStage("leaving");
      setStartAnim(true);
      const t = setTimeout(() => {
        setEmptyStage("hidden");
        setStartAnim(false);
      }, 280);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  const createTempId = () =>
    `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  function TypingDots() {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 2px" }}>
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot chat-typing-dot--2" />
        <span className="chat-typing-dot chat-typing-dot--3" />
      </div>
    );
  }

  async function loadChat(id) {
    setActiveChatId(id);
    setChatId(id);

    const res = await fetch(`/api/chat/${id}`, {
      headers: authHeader,
    });
    if (res.status === 401 || res.status === 403) {
      setLogoutAnimating(true);
      setTimeout(() => logout(), 250);
      return;
    }
    const chat = await res.json();

    // adapt versioned messages to renderable format
    const adapted = [];

    for (let i = 0; i < chat.messages.length; i++) {
      const m = chat.messages[i];

      // ✅ Legacy flat messages (user → assistant)
      if (!m.versions || !m.versions.length) {
        if (m.role === "user") {
          const next = chat.messages[i + 1];
          adapted.push({
            role: "user",
            content: m.content || "",
            messageId: m._id,
          });

          if (next && next.role === "assistant") {
            adapted.push({
              role: "assistant",
              content: next.content || "",
              messageId: m._id,
            });
            i++; // skip paired assistant
          }
        }
        continue;
      }

      // ✅ Versioned messages
      const activeIndex =
        Number.isInteger(m.activeVersion) && m.activeVersion > 0
          ? m.activeVersion - 1
          : 0;

      const v = m.versions[activeIndex];
      if (!v) continue;

      adapted.push({
        role: "user",
        content: v.content || "",
        messageId: m._id,
        versionIndex: activeIndex,
        totalVersions: m.versions.length,
      });
      adapted.push({
        role: "assistant",
        content: v.assistant || "",
        messageId: m._id,
      });
    }

    setMessages(adapted);
  }

  function newChat() {
    setMessages([]);
    setChatId(null);
    setActiveChatId(null);
    setEmptyStage("shown");
    setStartAnim(false);
    // scroll to top like ChatGPT new chat
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    });
  }

  async function sendMessage() {
    const text = String(input || "").trim();
    if (!text) return;
    if (isTyping) return;

    const tempId = createTempId();
    setInput("");
    setIsTyping(true);

    setMessages((m) => [
      ...m,
      { role: "user", content: text, tempId },
      { role: "assistant", content: "", tempId, loading: true },
    ]);

    let res;
    try {
      res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({ message: text, chatId }),
      });
    } catch {
      setIsTyping(false);
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((x) => x.role === "assistant" && x.tempId === tempId);
        if (idx >= 0) next[idx] = { ...next[idx], loading: false, content: "Request failed." };
        return next;
      });
      return;
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        setLogoutAnimating(true);
        setTimeout(() => logout(), 250);
      }
      setIsTyping(false);
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.findIndex((x) => x.role === "assistant" && x.tempId === tempId);
        if (idx >= 0) next[idx] = { ...next[idx], loading: false, content: "Failed to send." };
        return next;
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";

    let pendingEvent = null;
    setIsTyping(true);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) {
          pendingEvent = line.slice("event:".length).trim();
        }

        if (line.startsWith("data:")) {
          // Important: do NOT trimStart(), it would delete legitimate leading spaces
          // in streamed tokens and cause words to concatenate.
          let data = line.slice("data:".length);
          if (data.startsWith(" ")) data = data.slice(1);

          const payload = (() => {
            const raw = String(data || "");
            const s = raw.trim();
            if (!s) return null;
            if (s.startsWith("{") || s.startsWith("[") || s.startsWith('"')) {
              try {
                return JSON.parse(s);
              } catch {
                return raw;
              }
            }
            return raw;
          })();

          if (pendingEvent === "done") {
            const nextChatId =
              payload && typeof payload === "object" ? String(payload.chatId || "") : String(payload || "");
            if (nextChatId) setChatId(nextChatId);
            setIsTyping(false);
            setMessages((m) => {
              const updated = [...m];
              const idx = updated.findIndex((x) => x.role === "assistant" && x.tempId === tempId);
              if (idx >= 0) updated[idx] = { ...updated[idx], loading: false };
              return updated;
            });
            // refresh chat list so new chat appears in history
            fetch("/api/chats", {
              headers: authHeader,
            })
              .then((res) => res.json())
              .then(setChats);
            pendingEvent = null;
          } else if (pendingEvent !== "error") {
            const token =
              payload && typeof payload === "object" ? String(payload.token ?? "") : String(payload ?? "");
            if (!token) continue;

            assistantText += token;
            setMessages((m) => {
              const updated = [...m];
              const idx = updated.findIndex((x) => x.role === "assistant" && x.tempId === tempId);
              if (idx >= 0) updated[idx] = { ...updated[idx], loading: false, content: assistantText };
              return updated;
            });
          } else {
            setIsTyping(false);
            setMessages((m) => {
              const updated = [...m];
              const idx = updated.findIndex((x) => x.role === "assistant" && x.tempId === tempId);
              if (idx >= 0) updated[idx] = { ...updated[idx], loading: false, content: "Failed." };
              return updated;
            });
          }
        }
      }
    }
  }

  async function deleteChat(id) {
    await fetch(`/api/chat/${id}`, {
      method: "DELETE",
      headers: authHeader,
    });

    setChats((prev) => {
      const index = prev.findIndex((c) => c._id === id);
      const updated = prev.filter((c) => c._id !== id);

      if (id === chatId) {
        const next = updated[index] || updated[index - 1];
        if (next) {
          loadChat(next._id);
        } else {
          newChat();
        }
      }

      return updated;
    });
  }

  async function renameChat(chat) {
    const title = prompt("New title", chat.title);
    if (!title) return;

    await fetch(`/api/chat/${chat._id}/title`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ title }),
    });

    setChats(chats.map((c) => (c._id === chat._id ? { ...c, title } : c)));
  }

  return (
    <div
      style={{
        display: "flex",
        height: 'calc(100vh - 20px)',
        overflow: "hidden",
        background: "#ffffff",
        color: "#1e1e1e",
      }}
    >
      <style>{`
        @keyframes chatTypingPulse {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-3px); opacity: 0.9; }
        }
        @keyframes chatMessageEnter {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatComposerEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatEmptyExit {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-8px); }
        }
        .chat-user-actions {
          display: flex;
          gap: 14px;
          align-items: center;
          margin-top: 6px;
          opacity: 0;
          transform: translateY(-2px);
          transition: opacity 150ms ease, transform 150ms ease;
          pointer-events: none;
        }
        .chat-user-wrap:hover .chat-user-actions {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .chat-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6b7280;
          animation: chatTypingPulse 900ms ease-in-out infinite;
        }
        .chat-typing-dot--2 { animation-delay: 120ms; }
        .chat-typing-dot--3 { animation-delay: 240ms; }
      `}</style>
      {logoutAnimating && (
        <div
          onClick={() => {
            // Allow dismissing stale logout banners after re-login.
            setLogoutAnimating(false);
            setLogoutSignal?.(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            background: "rgba(255,255,255,0.78)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 1,
            transition: "opacity 260ms ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              maxWidth: "92%",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
              padding: 18,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              transform: "translateY(0)",
              transition: "transform 260ms ease",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              Logged out
            </div>
            <div style={{ fontSize: 15, color: "#6b7280" }}>
              {logoutSignal?.reason === 'disabled'
                ? 'Your account was disabled by an admin.'
                : 'Session ended.'}
            </div>
          </div>
        </div>
      )}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.25)",
            zIndex: 15,
          }}
        />
      )}

      {!sidebarOpen && isMobile && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 30,
            border: "none",
            background: "#000",
            color: "#fff",
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          ☰
        </button>
      )}
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={(id) => {
          loadChat(id);
          if (isMobile) setSidebarOpen(false);
        }}
        onNew={newChat}
        onDelete={deleteChat}
        onRename={renameChat}
        visible={sidebarOpen}
        onClose={isMobile ? () => setSidebarOpen(false) : null}
        username={user?.username || ""}
        isLoggedIn={!!token}
        onLogout={logout}
      />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            position: "relative",
            paddingLeft: !isMobile && sidebarOpen ? SIDEBAR_WIDTH : 0,
            transition: "padding-left 0.25s ease",
            paddingBottom: 1,
            minWidth: 0,
            width: "100%",
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
        >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#ffffff",
            borderBottom: "1px solid #eee",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            height: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              transform: chatId ? "translateY(0)" : "translateY(-6px)",
              opacity: chatId ? 1 : 0,
              pointerEvents: chatId ? "auto" : "none",
              transition: "opacity 180ms ease, transform 180ms ease",
            }}
          >
            <button
              onClick={() => setShowDeleteModal(true)}
              title="Delete chat"
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                border: "none",
                background: "transparent",
                color: "#d11a2a",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              Delete
            </button>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            height: "100%",
            overscrollBehavior: "contain",
            minHeight: 0,
            background: "#ffffff",
            fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            fontSize: 17,
            lineHeight: 1.75,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: isMobile ? "100%" : "70%",
              margin: "0 auto",
              padding: isMobile ? "0 12px 100px" : "0 24px 100px",
              paddingRight: isMobile ? 20 : 32,
              boxSizing: "border-box",
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 24,
                  animation:
                    startAnim && i < 2
                      ? `chatMessageEnter 280ms ease both ${i === 0 ? 0 : 60}ms`
                      : undefined,
                }}
              >
                {m.role === "user" ? (
                  (() => {
                    const msgKey = m.messageId || m.tempId || `idx_${i}`;
                    const isCopied = copiedKey === msgKey;
                    const isEditing = editingId === m.messageId;
                    return (
                  <div
                    className="chat-user-wrap"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isEditing ? "stretch" : "flex-end",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        background: "#f2f2f2",
                        border: "none",
                        borderRadius: 20,
                        padding: isEditing ? "25px 14px 54px 30px" : "10px 14px",
                        position: isEditing ? "relative" : "static",
                        boxSizing: "border-box",
                        lineHeight: 1.6,
                        letterSpacing: "0.02em",
                        maxWidth: isEditing ? "100%" : "80%",
                        width: isEditing ? "100%" : "fit-content",
                      }}
                    >
                      {isEditing ? (
                    <div>
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{
                          width: "100%",
                          minHeight: 96,
                          fontFamily:
                            "'Segoe UI','Helvetica Neue',Arial,sans-serif",
                           fontSize: 17,
                           lineHeight: 1.6,
                           padding: 0,
                           borderRadius: 0,
                           border: "none",
                           background: "transparent",
                           boxShadow: "none",
                           boxSizing: "border-box",
                           resize: "none",
                           outline: "none",
                          }}
                        />
                      <div
                        style={{
                          position: "absolute",
                          right: 12,
                          bottom: 10,
                          display: "flex",
                          gap: 10,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditValue("");
                          }}
                          style={{
                            padding: "6px 12px",
                            paddingTop: 10,
                            paddingBottom: 10,
                            borderRadius: 999,
                            border: "1px solid #ccc",
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            const nextText = String(editValue ?? "");
                            if (!nextText.trim()) return;

                            // exit edit mode immediately
                            setEditingId(null);
                            setEditValue("");
                            setIsTyping(true);

                            // Optimistically update the edited message and clear its assistant reply.
                            setMessages((prev) => {
                              const updated = [...(prev || [])];
                              const userIdx = updated.findIndex(
                                (x) => x?.role === "user" && x?.messageId === m.messageId,
                              );

                              if (userIdx >= 0) {
                                updated[userIdx] = { ...updated[userIdx], content: nextText };
                              }

                              const assistantIdx =
                                userIdx >= 0
                                  ? updated.findIndex(
                                      (x, idx) =>
                                        idx > userIdx &&
                                        x?.role === "assistant" &&
                                        x?.messageId === m.messageId,
                                    )
                                  : updated.findIndex(
                                      (x) => x?.role === "assistant" && x?.messageId === m.messageId,
                                    );

                              if (assistantIdx >= 0) {
                                updated[assistantIdx] = {
                                  ...updated[assistantIdx],
                                  content: "",
                                  loading: true,
                                };
                                // Match ChatGPT behavior: regenerate from this point.
                                return updated.slice(0, assistantIdx + 1);
                              }

                              // If we somehow don't have the paired assistant message, create one.
                              if (userIdx >= 0) {
                                updated.splice(userIdx + 1, 0, {
                                  role: "assistant",
                                  content: "",
                                  messageId: m.messageId,
                                  loading: true,
                                });
                                return updated.slice(0, userIdx + 2);
                              }

                              return updated;
                            });

                            const res = await fetch(
                              "/api/chat/stream",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${localStorage.getItem("token")}`,
                                },
                                body: JSON.stringify({
                                  chatId,
                                  messageId: m.messageId,
                                  message: nextText,
                                }),
                              },
                            );

                            if (!res.body) {
                              setIsTyping(false);
                              return;
                            }

                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            let assistantText = "";
                            let pendingEvent = null;
                            let doneChatId = null;

                            // reset assistant content for this message
                            setMessages((prev) => {
                              const updated = [...prev];
                              for (let i = updated.length - 1; i >= 0; i--) {
                                if (
                                  updated[i].role === "assistant" &&
                                  updated[i].messageId === m.messageId
                                ) {
                                  updated[i] = { ...updated[i], content: "", loading: true };
                                  break;
                                }
                              }
                              return updated;
                            });

                            while (true) {
                              const { value, done } = await reader.read();
                              if (done) break;

                              const chunk = decoder.decode(value);
                              const lines = chunk.split("\n");

                              for (const line of lines) {
                                if (line.startsWith("event:")) {
                                  pendingEvent = line.slice("event:".length).trim();
                                  continue;
                                }

                                if (line.startsWith("data:")) {
                                  // Don't trimStart(): streamed tokens may begin with spaces.
                                  let token = line.slice("data:".length);
                                  if (token.startsWith(" ")) token = token.slice(1);

                                  const payload = (() => {
                                    const raw = String(token || "");
                                    const s = raw.trim();
                                    if (!s) return null;
                                    if (s.startsWith("{") || s.startsWith("[") || s.startsWith('"')) {
                                      try {
                                        return JSON.parse(s);
                                      } catch {
                                        return raw;
                                      }
                                    }
                                    return raw;
                                  })();

                                  if (pendingEvent === "done") {
                                    const nextChatId =
                                      payload && typeof payload === "object"
                                        ? String(payload.chatId || "")
                                        : String(payload || "");
                                    if (nextChatId) doneChatId = nextChatId;
                                    pendingEvent = null;
                                    continue;
                                  }

                                  if (pendingEvent === "error") {
                                    pendingEvent = null;
                                    continue;
                                  }

                                  const tokenText =
                                    payload && typeof payload === "object"
                                      ? String(payload.token ?? "")
                                      : String(payload ?? "");
                                  if (!tokenText) continue;

                                  assistantText += tokenText;

                                  setMessages((prev) => {
                                    const updated = [...prev];
                                    for (
                                      let i = updated.length - 1;
                                      i >= 0;
                                      i--
                                    ) {
                                      if (
                                        updated[i].role === "assistant" &&
                                        updated[i].messageId === m.messageId
                                      ) {
                                        updated[i] = {
                                          ...updated[i],
                                          content: assistantText,
                                          loading: false,
                                        };
                                        break;
                                      }
                                    }
                                    return updated;
                                  });
                                }
                              }
                            }

                            setMessages((prev) =>
                              (prev || []).map((x) =>
                                x?.role === "assistant" && x?.messageId === m.messageId
                                  ? { ...x, loading: false }
                                  : x,
                              ),
                            );
                            setIsTyping(false);

                            // Reload chat so the UI matches server state (versions + truncated history).
                            const idToLoad = doneChatId || chatId;
                            if (idToLoad) loadChat(idToLoad);

                            // Refresh chat list so title/order update after edit.
                            fetch("/api/chats", { headers: authHeader })
                              .then((r) => (r.ok ? r.json() : []))
                              .then(setChats)
                              .catch(() => {});
                          }}
                          style={{
                            padding: "6px 14px",
                            paddingTop: 10,
                            paddingBottom: 10,
                            borderRadius: 999,
                            border: "none",
                            background: "#000",
                            color: "#fff",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                      ) : (
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      )}
                    </div>

                    {editingId !== m.messageId && (
                      <div className="chat-user-actions">
                        <button
                          onClick={() => {
                            navigator.clipboard
                              .writeText(m.content)
                              .then(() => {
                                setCopiedKey(msgKey);
                                if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
                                copyTimerRef.current = setTimeout(() => {
                                  setCopiedKey(null);
                                }, 1200);
                              })
                              .catch(() => {});
                          }}
                          title={isCopied ? "Copied" : "Copy"}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            padding: 2,
                            color: "#555",
                          }}
                        >
                          {isCopied ? (
                            <svg
                              width="23"
                              height="25"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.9"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : (
                            <svg
                              width="23"
                              height="25"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                            </svg>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (!m.messageId) return;
                            setEditingId(m.messageId);
                            setEditValue(m.content);
                          }}
                          title="Edit"
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: m.messageId ? "pointer" : "default",
                            padding: 2,
                            color: "#555",
                            opacity: m.messageId ? 1 : 0.35,
                          }}
                        >
                          <svg
                            width="23"
                            height="25"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>

                        {m.totalVersions > 1 && (
                          <>
                            <button
                              title="Previous version"
                              disabled={m.versionIndex === 0}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: m.versionIndex === 0 ? "default" : "pointer",
                                padding: 2,
                                opacity: m.versionIndex === 0 ? 0.3 : 1,
                              }}
                              onClick={() => handlePrevVersion(m.messageId)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#555"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="15 18 9 12 15 6"></polyline>
                              </svg>
                            </button>
                            <span style={{ fontSize: 14, color: "#666" }}>
                              {m.versionIndex + 1} / {m.totalVersions}
                            </span>
                            <button
                              title="Next version"
                              disabled={m.versionIndex === m.totalVersions - 1}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor:
                                  m.versionIndex === m.totalVersions - 1 ? "default" : "pointer",
                                padding: 2,
                                opacity: m.versionIndex === m.totalVersions - 1 ? 0.3 : 1,
                              }}
                              onClick={() => handleNextVersion(m.messageId)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#555"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="9 18 15 12 9 6"></polyline>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                    );
                  })()
                ) : (
                  <div
                    style={{
                      background: "#ffffff",
                      border: "none",
                      borderRadius: 0,
                      padding: 14,
                      lineHeight: 1.6,
                      letterSpacing: "0.02em",
                      maxWidth: "100%",
                      width: "100%",
                      marginLeft: 0,
                    }}
                  >
                    {m.loading && !String(m.content || "").trim() ? (
                      <TypingDots />
                    ) : (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {emptyStage !== "hidden" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: !isMobile && sidebarOpen ? SIDEBAR_WIDTH : 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              pointerEvents: emptyStage === "shown" ? "auto" : "none",
              animation: emptyStage === "leaving" ? "chatEmptyExit 260ms ease both" : undefined,
            }}
          >
            <div style={{ width: "100%", transform: "translateY(-50px)" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 400,
                  color: "#333",
                  fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
                  textAlign: "center",
                  marginBottom: 30,
                  opacity: emptyStage === "leaving" ? 0 : 1,
                  transition: "opacity 160ms ease",
                }}
              >
                How can I help you?
              </div>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "70%",
                  margin: "0 auto",
                  opacity: emptyStage === "leaving" ? 0 : 1,
                  transform: emptyStage === "leaving" ? "translateY(8px)" : "translateY(0)",
                  transition: "opacity 160ms ease, transform 160ms ease",
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    sendMessage();
                  }}
                  placeholder="Ask anything..."
                  style={{
                    width: "100%",
                    padding: "20px 56px 20px 50px",
                    borderRadius: "999px",
                    border: "2px solid #d3d3d3",
                    fontSize: 17,
                    outline: "none",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isTyping}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 40,
                    height: 40,
                    borderRadius: "999px",
                    border: "none",
                    background: input.trim() && !isTyping ? "#000" : "#f2f2f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: input.trim() && !isTyping ? "pointer" : "default",
                  }}
                >
                  {input.trim() && !isTyping ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#999"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {messages.length !== 0 && (
          <div
            style={{
              position: "sticky",
              bottom: 20,
              background: "transparent",
              pointerEvents: "none",
              animation: startAnim ? "chatComposerEnter 240ms ease both" : undefined,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: isMobile ? "100%" : "70%",
                margin: "0 auto",
                display: "flex",
                pointerEvents: "auto",
                flexDirection: "column",
                alignItems: "stretch",
                padding: isMobile ? "0 12px" : "0 24px",
                boxSizing: "border-box",
                overflowX: "hidden",
              }}
            >
               <div style={{ position: "relative", width: "100%" }}>
                 <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    sendMessage();
                  }}
                  placeholder="Ask anything..."
                    style={{
                     width: "100%",
                     padding: "20px 56px 20px 50px",
                     borderRadius: "999px",
                     border: "2px solid #d3d3d3",
                      fontSize: 17,
                      outline: "none",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                      boxSizing: "border-box",
                    }}
                />
                <button
                 onClick={sendMessage}
                 disabled={!input.trim() || isTyping}
                   style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 40,
                    height: 40,
                    borderRadius: "999px",
                    border: "none",
                    background: input.trim() && !isTyping ? "#000" : "#f2f2f2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: input.trim() && !isTyping ? "pointer" : "default",
                  }}
               >
                 {input.trim() && !isTyping ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#999"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                  </svg>
                )}
              </button>
            </div>
            </div>
           </div>
          )}
      </div>

      {showDeleteModal && (
        <>
          <div
            onClick={() => setShowDeleteModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(255,255,255,0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 40,
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 360,
              background: "#ffffff",
              borderRadius: 10,
              padding: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Delete chat?
            </div>

            <div style={{ fontSize: 16, color: "#444", marginBottom: 20 }}>
              This will delete New Prompt Creation.
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const id = chatId;
                  setShowDeleteModal(false);
                  deleteChat(id);
                  newChat();
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#d11a2a",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
