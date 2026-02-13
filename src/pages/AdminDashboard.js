import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import SmartAreaChart from "../components/SmartAreaChart";
import AnimatedNumber from "../components/AnimatedNumber";
import LeftAdmin from "../components/LeftAdmin";
import AllUsersLiveSection from "../components/AllUsersLiveSection";
import AuditTrailModal from "../components/AuditTrailModal";
// legacy user panel components removed; using LeftAdmin instead

export default function AdminDashboard() {
  const { token, logout, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [tokensDaily, setTokensDaily] = useState([]);
  // dark mode removed
  const [selectedUser, setSelectedUser] = useState(null);
  const usernameBoxRef = useRef(null);
  const [usernameMarquee, setUsernameMarquee] = useState({ active: false, delta: 0, duration: 8 });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const createdRef = useRef(null);
  const lastLoginRef = useRef(null);
  const [animateDates, setAnimateDates] = useState(false);
  // credit control removed
  const [userChats, setUserChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  // activity panel handles its own “new item” animation state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { user, fields, message }
  const [editUserField, setEditUserField] = useState(null); // 'username' | 'role' | 'status'
  const [editUserValue, setEditUserValue] = useState("");
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [bulkDeleteModalVisible, setBulkDeleteModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [deletingUserIds, setDeletingUserIds] = useState(() => new Set());
  const [bulkUsersToDelete, setBulkUsersToDelete] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkConfirmAction, setBulkConfirmAction] = useState(null); // { users, fields, title, message }
  const [bulkConfirmVisible, setBulkConfirmVisible] = useState(false);
  const SHOW_LEGACY_USERS_PANEL = false;
  // confirmation modal reverted
  const [newUserRole, setNewUserRole] = useState("user");
  const [newUserStatus, setNewUserStatus] = useState("active");

  const selectedUserRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const onlineIdsRef = useRef(new Set());
  const presencePulseTimerRef = useRef(null);
  const [presencePulse, setPresencePulse] = useState({
    userId: null,
    running: false,
    lightOn: false,
  });

  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const [lastAdminEvent, setLastAdminEvent] = useState(null);
  const [lastUsageEvent, setLastUsageEvent] = useState(null);
  const [showUserAuditModal, setShowUserAuditModal] = useState(false);

  useEffect(() => {
    const calc = () => {
      const el = usernameBoxRef.current;
      if (!el) return;

      const delta = Math.max(0, (el.scrollWidth || 0) - (el.clientWidth || 0));
      const active = delta > 4;
      const duration = Math.max(6, Math.round((delta / 40) * 10) / 10); // ~40px/s
      setUsernameMarquee((prev) => {
        if (prev.active === active && prev.delta === delta && prev.duration === duration) return prev;
        return { active, delta, duration };
      });
    };

    const raf = requestAnimationFrame(calc);
    window.addEventListener("resize", calc);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", calc);
    };
  }, [selectedUser?.username]);

  const todayKey = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const todayUsage = (() => {
    const r = tokensDaily.find((x) => x.date === todayKey);
    return { requests: r?.requests ?? 0, tokens: r?.tokens ?? 0 };
  })();

  // ---- FIXED: optimistic update MUST live inside component ----
  const updateUserOptimistic = async (user, updatedFields) => {
    if (!user) return;

    const prevUser = user;
    const nextUser = { ...user, ...updatedFields };

    // optimistic UI update
    setSelectedUser(nextUser);
    setUsers((prev) =>
      prev.map((u) => (u._id === nextUser._id ? nextUser : u)),
    );
    setIsSavingUser(true);

    try {
      const res = await fetch(
        `/api/admin/users/${nextUser._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedFields),
        },
      );

      if (!res.ok) throw new Error("Failed to update user");
    } catch (err) {
      // rollback on failure
      setSelectedUser(prevUser);
      setUsers((prev) =>
        prev.map((u) => (u._id === prevUser._id ? prevUser : u)),
      );
      console.error("Failed to update user", err);
    } finally {
      setIsSavingUser(false);
    }
  };

  const openEditModal = (field) => {
    if (!selectedUser) return;
    setEditUserField(field);
    if (field === "username") setEditUserValue(selectedUser.username || "");
    if (field === "role") setEditUserValue(selectedUser.role || "user");
    if (field === "status") setEditUserValue(selectedUser.isActive ? "active" : "disabled");

    // Animate in (same feel as AddUserModal)
    setEditModalVisible(false);
    requestAnimationFrame(() => setEditModalVisible(true));
  };

  const closeEditModal = () => {
    // Animate out, then unmount
    setEditModalVisible(false);
    setTimeout(() => {
      setEditUserField(null);
      setEditUserValue("");
    }, 220);
  };

  useEffect(() => {
    if (showDeleteUserModal) requestAnimationFrame(() => setDeleteModalVisible(true));
    else setDeleteModalVisible(false);
  }, [showDeleteUserModal]);

  useEffect(() => {
    if (showBulkDeleteModal) requestAnimationFrame(() => setBulkDeleteModalVisible(true));
    else setBulkDeleteModalVisible(false);
  }, [showBulkDeleteModal]);

  useEffect(() => {
    if (confirmAction) requestAnimationFrame(() => setConfirmModalVisible(true));
    else setConfirmModalVisible(false);
  }, [confirmAction]);

  const closeDeleteUserModal = () => {
    setDeleteModalVisible(false);
    setTimeout(() => {
      setShowDeleteUserModal(false);
      setUserToDelete(null);
    }, 220);
  };

  const closeBulkDeleteModal = () => {
    setBulkDeleteModalVisible(false);
    setTimeout(() => {
      setShowBulkDeleteModal(false);
      setBulkUsersToDelete([]);
    }, 220);
  };

  const closeConfirmModal = () => {
    setConfirmModalVisible(false);
    setTimeout(() => setConfirmAction(null), 220);
  };

  useEffect(() => {
    if (bulkConfirmAction) requestAnimationFrame(() => setBulkConfirmVisible(true));
    else setBulkConfirmVisible(false);
  }, [bulkConfirmAction]);

  const closeBulkConfirmModal = () => {
    setBulkConfirmVisible(false);
    setTimeout(() => setBulkConfirmAction(null), 220);
  };

  const updateUsersOptimistic = async (ids, updatedFields) => {
    if (!ids?.length) return;

    const idSet = new Set(ids);
    const prevUsers = users;
    const prevSelected = selectedUser;

    setUsers((prev) =>
      prev.map((u) => (idSet.has(u._id) ? { ...u, ...updatedFields } : u)),
    );
    if (selectedUser && idSet.has(selectedUser._id)) {
      setSelectedUser((prev) => ({ ...prev, ...updatedFields }));
    }

    setIsSavingUser(true);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/admin/users/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updatedFields),
          }),
        ),
      );
    } catch (e) {
      setUsers(prevUsers);
      setSelectedUser(prevSelected);
    } finally {
      setIsSavingUser(false);
      loadUsers();
    }
  };

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const next = await res.json();
      setUsers((prev) => {
        const onlineById = new Map((prev || []).map((u) => [String(u._id), !!u.online]));
        return (next || []).map((u) => ({
          ...u,
          online: onlineIdsRef.current.has(String(u._id))
            ? true
            : onlineById.has(String(u._id))
              ? onlineById.get(String(u._id))
              : false,
        }));
      });
    }
    setLoading(false);
  }

  async function loadTokensDaily(userId) {
    const qs = new URLSearchParams({ days: "30" });
    if (userId) qs.set("userId", userId);
    qs.set("tzOffset", String(new Date().getTimezoneOffset()));

    try {
      const res = await fetch(
        `/api/admin/charts/tokens-daily?${qs.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setTokensDaily(await res.json());
      else setTokensDaily([]);
    } catch (err) {
      console.error("loadTokensDaily failed", err);
      setTokensDaily([]);
    }
  }

  async function openUser(user) {
    setSelectedUser(user);
    // Load per-user usage series so Requests/Credits + charts match selection
    await loadTokensDaily(user._id);

    try {
      const res = await fetch(
        `/api/admin/users/${user._id}/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) setUserAnalytics(await res.json());
      else setUserAnalytics(null);
    } catch (err) {
      console.error("openUser analytics failed", err);
      setUserAnalytics(null);
    }

    try {
      const activityRes = await fetch(
        `/api/admin/users/${user._id}/activity?limit=120`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (activityRes.ok) setAuditEvents(await activityRes.json());
      else setAuditEvents([]);
    } catch (err) {
      console.error("openUser activity failed", err);
      setAuditEvents([]);
    }
  }

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    return () => {
      if (presencePulseTimerRef.current) {
        clearInterval(presencePulseTimerRef.current);
        presencePulseTimerRef.current = null;
      }
    };
  }, []);

  const startPresencePulse = (userId) => {
    if (presencePulseTimerRef.current) {
      clearInterval(presencePulseTimerRef.current);
      presencePulseTimerRef.current = null;
    }

    let ticks = 0;
    setPresencePulse({
      userId: String(userId),
      running: true,
      lightOn: true,
    });

    presencePulseTimerRef.current = setInterval(() => {
      ticks += 1;
      if (ticks >= 6) {
        clearInterval(presencePulseTimerRef.current);
        presencePulseTimerRef.current = null;
        setPresencePulse((p) => ({
          ...p,
          running: false,
          lightOn: true,
        }));
        return;
      }

      setPresencePulse((p) => ({ ...p, lightOn: !p.lightOn }));
    }, 500);
  };

  useEffect(() => {
    if (!token) return;

    const socket = io(window.location.origin, {
      auth: { token },
    });

    const onAdminEvent = (evt) => {
      if (evt?.type === 'PRESENCE' && evt.userId) {
        if (evt.online) onlineIdsRef.current.add(String(evt.userId));
        else onlineIdsRef.current.delete(String(evt.userId));

        setUsers((prev) =>
          prev.map((u) =>
            String(u._id) === String(evt.userId) ? { ...u, online: !!evt.online } : u,
          ),
        );
        setSelectedUser((prev) =>
          prev && String(prev._id) === String(evt.userId)
            ? { ...prev, online: !!evt.online }
            : prev,
        );

        const sel = selectedUserRef.current;
        if (sel && String(sel._id) === String(evt.userId) && sel.isActive) {
          startPresencePulse(evt.userId);
        }

        return;
      }

      const type = String(evt?.type || '').toUpperCase();
      if (type === 'USAGE') {
        // Update charts/totals only when the request is completed.
        const stage = String(evt?.stage || '').toLowerCase();
        if (stage === 'request') return;

        setLastUsageEvent(evt || null);
        setUsageRefreshKey((n) => n + 1);
        scheduleRefresh();
        return;
      }

      // Any other non-presence event may imply counts changed.
      setUsageRefreshKey((n) => n + 1);
      setLastAdminEvent(evt || null);
      scheduleRefresh();
    };

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = setTimeout(async () => {
        refreshTimerRef.current = null;

        try {
          await loadUsers();

          const u = selectedUserRef.current;
          if (u?._id) {
            await loadTokensDaily(u._id);

            const res = await fetch(
              `/api/admin/users/${u._id}/analytics`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (res.ok) setUserAnalytics(await res.json());

            const activityRes = await fetch(
              `/api/admin/users/${u._id}/activity?limit=120`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (activityRes.ok) setAuditEvents(await activityRes.json());
          } else {
            await loadTokensDaily();
          }
        } catch {
          // ignore transient refresh failures
        }
      }, 350);
    };

    socket.on("connect", scheduleRefresh);
    socket.on("admin:event", onAdminEvent);
    socket.on('admin:presence_snapshot', (ids) => {
      const set = new Set((ids || []).map((x) => String(x)));
      onlineIdsRef.current = set;
      setUsers((prev) => (prev || []).map((u) => ({ ...u, online: set.has(String(u._id)) })));
      setSelectedUser((prev) =>
        prev ? { ...prev, online: set.has(String(prev._id)) } : prev,
      );
    });
    socket.on("disconnect", () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      socket.disconnect();
    };
  }, [token]);

  // activity panel handles its own “new item” animation state

  useEffect(() => {
    setAnimateDates(false);
    if (!selectedUser) return;

    const timer = setTimeout(() => {
      const createdEl = createdRef.current;
      const loginEl = lastLoginRef.current;
      if (
        (createdEl && createdEl.scrollWidth > createdEl.clientWidth) ||
        (loginEl && loginEl.scrollWidth > loginEl.clientWidth)
      ) {
        setAnimateDates(true);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [selectedUser]);

  useEffect(() => {
    loadUsers();
    loadTokensDaily();
  }, []);

  async function createUser() {
    if (!username.trim()) return;
    await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: username.trim() }),
    });
    setUsername("");
    loadUsers();
  }

  async function toggleUser(id, isActive) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isActive: !isActive }),
    });
    loadUsers();
  }

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

  return (
     <div
       style={{
         height: "calc(100vh - 26px)",
         background: "#f4f6fb",
         color: "#111827",
         fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
       }}
     >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 10,
          boxSizing: "border-box",
        }}
      >
        {/* Logout button fixed bottom-right */}
        <button
          onClick={logout}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            background: "#111827",
            color: "#fff",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 100,
          }}
        >
          Logout
        </button>

        {/* TOP ROW: Users (40%) + New Panel (60%) */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flex: 1,
            width: "100%",
            minHeight: 0,
          }}
        >
          {/* NEW LEFT ADMIN PANEL (component-based) */}
            <LeftAdmin
              users={users}
              loading={loading}
              selectedUserId={selectedUser?._id || null}
              onSelectUser={openUser}
              token={token}
              usageRefreshKey={usageRefreshKey}
              onDeleteUser={(u) => {
                setUserToDelete(u);
                setShowDeleteUserModal(true);
              }}
              onDeleteMany={(arr) => {
                setBulkUsersToDelete(arr || []);
                setShowBulkDeleteModal(true);
              }}
              onSetRoleMany={(arr, role) => {
                if (!arr?.length) return;
                setBulkConfirmAction({
                  users: arr,
                  fields: { role },
                  title: "Change role",
                  message: `Set role to '${role}' for ${arr.length} users?`,
                });
              }}
              onSetStatusMany={(arr, status) => {
                if (!arr?.length) return;
                const isActive = status === "active";
                setBulkConfirmAction({
                  users: arr,
                  fields: { isActive },
                  title: "Change status",
                  message: `Set status to '${status}' for ${arr.length} users?`,
                });
              }}
              deletingUserIds={deletingUserIds}
              onCreateUser={async (username, role, status) => {
                if (!username.trim()) return;

              // 1) Create user
              const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  username: username.trim(),
                  role,
                  isActive: status === "active",
                }),
              });

              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.message || data.error || "Failed to create user");
                loadUsers();
                return;
              }

              const createdUser = await res.json().catch(() => null);
              const createdId = createdUser?._id || createdUser?.id;

              // 2) Refresh list
              loadUsers();
            }}
          />

          {/* NEW PANEL */}
          <div
            style={{
              width: "70%",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* NEW PANEL (TOP) */}
            <section
              style={{
                flex: "4 1 0",
                minHeight: 0,
                background: "#ffffff",
                borderRadius: 16,
                padding: 10,
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                overflowY: "hidden",
                overflowX: "visible",
                transition: "opacity 0.25s ease, transform 0.25s ease",
                opacity: selectedUser ? 1 : 0.6,
                transform: selectedUser ? "translateY(0)" : "translateY(4px)",
              }}
            >
              {/* LEFT: user info (was TOP LINE) | RIGHT: analytics (was BOTTOM LINE) */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, overflow: "visible" }}>
                <div style={{ flex: "2 1 0", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  {/* Top: username (70%) + role/status (30%) */}
                  <div style={{ display: "flex", gap: 3, flex: "3 1 0", minHeight: 0 }}>
                    <div
                      style={{
                        flex: "0 0 60%",
                        maxWidth: "60%",
                        minWidth: 0,
                        minHeight: 0,
                        background: "#f1f1f1",
                        borderRadius: 18,
                        padding: "5px 10px",
                        boxSizing: "border-box",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 0,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#626572" }}>Username</div>
                        {selectedUser && (
                          <button
                            onClick={() => openEditModal("username")}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#111827",
                              cursor: "pointer",
                              fontSize: 22,
                              lineHeight: 1,
                              padding: 2,
                            }}
                            title="Edit username"
                          >
                            ⋯
                          </button>
                        )}
                      </div>

                      <div
                        ref={usernameBoxRef}
                        style={{
                          fontSize: 27,
                          fontWeight: 600,
                          color: "#000000",
                          fontFamily:
                            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Inter, Helvetica, Arial, sans-serif",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          lineHeight: 1.1,
                          textAlign: "center",
                          position: "relative",
                          paddingBottom: 6,
                        }}
                        title={selectedUser?.username || ""}
                      >
                        <style>{`
                          @keyframes usernameMarquee {
                            from { transform: translateX(0); }
                            to { transform: translateX(var(--marquee-x)); }
                          }
                        `}</style>
                        <span
                          style={{
                            display: "inline-block",
                            paddingRight: usernameMarquee.active ? 24 : 0,
                            willChange: "transform",
                            "--marquee-x": `${-usernameMarquee.delta}px`,
                            animation: usernameMarquee.active
                              ? `usernameMarquee ${usernameMarquee.duration}s linear 2s infinite`
                              : "none",
                          }}
                        >
                          {selectedUser?.username || ""}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "0 0 40%",
                        maxWidth: "40%",
                        minWidth: 0,
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          background: "#f1f5f9",
                          borderRadius: 12,
                          padding: "5px 10px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 600,
                              color: "#111827",
                              textTransform: "capitalize",
                              paddingLeft: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              minWidth: 0,
                            }}
                            title={selectedUser?.role ?? ""}
                          >
                            {selectedUser?.role ?? "—"}
                          </div>
                          {selectedUser && (
                            <button
                              onClick={() => openEditModal("role")}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "#111827",
                                cursor: "pointer",
                                fontSize: 22,
                                lineHeight: 1,
                                padding: 2,
                              }}
                              title="Edit role"
                            >
                              ⋯
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          background: selectedUser?.isActive ? "#e0fbe8" : "#fee2e2",
                          borderRadius: 12,
                          padding: "5px 10px",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 600,
                              color: selectedUser?.isActive ? "#16a34a" : "#dc2626",
                              paddingLeft: 10,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              minWidth: 0,
                            }}
                            title={selectedUser ? (selectedUser.isActive ? "Active" : "Disabled") : ""}
                          >
                            {selectedUser ? (selectedUser.isActive ? "Active" : "Disabled") : "—"}
                          </div>
                          {selectedUser && (
                            <button
                              onClick={() => openEditModal("status")}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "#111827",
                                cursor: "pointer",
                                fontSize: 22,
                                lineHeight: 1,
                                padding: 2,
                              }}
                              title="Edit status"
                            >
                              ⋯
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: requests + credits (50/50) */}
                  <div style={{ display: "flex", gap: 3, flex: "4 1 0", minHeight: 0 }}>
                    <div
                      style={{
                        flex: "0 0 50%",
                        maxWidth: "50%",
                        minWidth: 0,
                        minHeight: 0,
                        background: "#343434",
                        borderRadius: 14,
                        padding: "8px 10px",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                       <div style={{ fontSize: 11, fontWeight: 600, color: "#afafaf" }}>Requests (Today)</div>
                      <div
                        style={{
                          fontSize: 40,
                          fontWeight: 600,
                          textAlign: "center",
                          color: "#ffffff",
                          lineHeight: 1,
                          marginBottom: 20,
                        }}
                      >
                        <AnimatedNumber value={selectedUser ? todayUsage.requests : 0} duration={260} />
                      </div>
                    </div>

                    <div
                      style={{
                        flex: "0 0 50%",
                        maxWidth: "50%",
                        minWidth: 0,
                        minHeight: 0,
                        background: "#343434",
                        borderRadius: 14,
                        padding: "8px 10px",
                        boxSizing: "border-box",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                       <div style={{ fontSize: 11, fontWeight: 600, color: "#afafaf" }}>Credits (Today)</div>
                      <div
                        style={{
                          fontSize: 40,
                          fontWeight: 600,
                          textAlign: "center",
                          color: "#ffffff",
                          lineHeight: 1,
                          marginBottom: 20,
                        }}
                      >
                        <AnimatedNumber value={selectedUser ? todayUsage.tokens : 0} duration={260} />
                      </div>
                    </div>
                  </div>

                  {/* Bottom: times (left) + audit button (right) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      justifyContent: "space-between",
                      gap: 10,
                      flex: "3 1 0",
                      minHeight: 0,
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0,
                        borderRadius: 0,
                        overflow: "hidden",
                        border: "none",
                        background: "#ffffff",
                      }}
                    >
                    {[
                      {
                        k: "created",
                        label: "Created",
                        value: selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "",
                        accent: "#64748b",
                        icon: (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M8 2v4" />
                            <path d="M16 2v4" />
                            <path d="M3 10h18" />
                            <path d="M5 6h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
                          </svg>
                        ),
                      },
                      {
                        k: "updated",
                        label: "Updated",
                        value: selectedUser?.updatedAt ? new Date(selectedUser.updatedAt).toLocaleString() : "",
                        accent: "#0ea5e9",
                        icon: (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M3 12a9 9 0 1 0 3-6" />
                            <path d="M3 3v6h6" />
                          </svg>
                        ),
                      },
                      {
                        k: "lastLogin",
                        label: "Last login",
                        value: userAnalytics?.lastLogin ? new Date(userAnalytics.lastLogin).toLocaleString() : "",
                        accent: "#22c55e",
                        icon: (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <path d="M10 17l5-5-5-5" />
                            <path d="M15 12H3" />
                          </svg>
                        ),
                      },
                    ].map((item, idx, arr) => (
                        <div
                          key={item.k}
                          style={{
                            flex: 1,
                            minHeight: 0,
                            minWidth: 0,
                            padding: "3px 0px",
                            borderRadius: 0,
                            borderBottom: "none",
                            background:
                              idx === 0
                                ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
                                : idx === 1
                                  ? "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)"
                                  : "linear-gradient(180deg, #ffffff 0%, #f7fff9 100%)",
                          display: "grid",
                          gridTemplateColumns: "4px 1fr",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ height: "100%", background: item.accent }} />
                        <div
                          style={{
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            paddingLeft: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              minWidth: 0,
                              color: "#64748b",
                              fontSize: 14,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={item.label}
                          >
                            <span style={{ color: item.accent, display: "inline-flex", alignItems: "center" }}>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              color: "#111827",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontFamily:
                                "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
                              textAlign: "right",
                              minWidth: 0,
                              flex: 1,
                            }}
                            title={item.value}
                          >
                            {item.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                    <button
                      type="button"
                      disabled={!selectedUser}
                      onClick={() => setShowUserAuditModal(true)}
                      style={{
                        padding: "8px",
                        borderRadius: 12,
                        border: "none",
                        background: "transparent",
                        color: selectedUser ? "#111827" : "#9ca3af",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: selectedUser ? "pointer" : "not-allowed",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0,
                        boxShadow: "none",
                        transition: "transform 140ms ease, background 140ms ease",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}
                      title="See all"
                      onMouseEnter={(e) => {
                        if (!selectedUser) return;
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.background = "#f3f4f6";
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedUser) return;
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <ListIcon />
                    </button>
                  </div>
                </div>

                <div style={{ flex: "3 1 0", minWidth: 0, minHeight: 0, display: "flex" }}>
                  <div style={{ flex: 1, maxWidth: "100%", minWidth: 0, minHeight: 0 }}>
                    <SmartAreaChart
                      label="Requests & Credits"
                      data={tokensDaily}
                      syncId="analytics"
                      token={token}
                      userId={selectedUser?._id || null}
                    />
                  </div>
                </div>
              </div>
              </section>

              <AuditTrailModal
                open={showUserAuditModal}
                onClose={() => setShowUserAuditModal(false)}
                title="User audit trail"
                subtitle={selectedUser?.username ? `User: ${selectedUser.username}` : ""}
                events={auditEvents}
                exportName={
                  selectedUser?.username
                    ? `${String(selectedUser.username).trim() || "user"}-audit`
                    : "user-audit"
                }
              />

              <AllUsersLiveSection
                token={token}
                lastAdminEvent={lastAdminEvent}
                lastUsageEvent={lastUsageEvent}
                refreshKey={usageRefreshKey}
                style={{ flex: "6 1 0", minHeight: 0 }}
              />
          </div>
        </div>

        {/* USER ANALYTICS DRAWER */}
        {false && (
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: 420,
              height: "100vh",
              background: "#fff",
              boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
              padding: 24,
              zIndex: 50,
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0 }}>{userAnalytics.user.username}</h3>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserAnalytics(null);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: 14, color: "#555" }}>
              <div>
                <strong>Role:</strong> {userAnalytics.user.role}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                {userAnalytics.user.isActive ? "Active" : "Disabled"}
              </div>
              <div>
                <strong>Created:</strong>{" "}
                {new Date(userAnalytics.user.createdAt).toLocaleString()}
              </div>
            </div>

            <hr style={{ margin: "20px 0" }} />

            <div style={{ fontSize: 14 }}>
              <div>
                <strong>Last Login:</strong>{" "}
                {userAnalytics.lastLogin
                  ? new Date(userAnalytics.lastLogin).toLocaleString()
                  : "—"}
              </div>
              <div>
                <strong>Total Logins:</strong> {userAnalytics.totalLogins}
              </div>
              <div>
                <strong>Total Requests:</strong> {userAnalytics.totalRequests}
              </div>
              <div>
                <strong>Total Tokens Used:</strong> {userAnalytics.totalTokens}
              </div>
            </div>
            {/* credit control removed */}
            <hr style={{ margin: "20px 0" }} />
            <div>
              <h4>Chats</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {userChats.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => setActiveChat(c)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      cursor: "pointer",
                    }}
                  >
                    {c.title || "Untitled"}
                  </button>
                ))}
              </div>
            </div>
            {activeChat && (
              <div style={{ marginTop: 16 }}>
                <h4>{activeChat.title}</h4>
                <div style={{ fontSize: 13, color: "#555" }}>
                  {activeChat.messages.map((m, i) => {
                    const content = m.versions
                      ? m.versions[m.activeVersion - 1]?.content
                      : m.content;
                    const assistant = m.versions
                      ? m.versions[m.activeVersion - 1]?.assistant
                      : m.assistant;
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div>
                          <strong>User:</strong> {content}
                        </div>
                        {assistant && (
                          <div>
                            <strong>Assistant:</strong> {assistant}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddUserModal && (
        <>
          <div
            onClick={() => setShowAddUserModal(false)}
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
              padding: 24,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowAddUserModal(false)}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                border: "none",
                background: "transparent",
                fontSize: 18,
                cursor: "pointer",
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>

            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>
              Add new user
            </div>

            {/* Username */}
            <input
              autoFocus
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 18px",
                marginBottom: 16,
                borderRadius: "999px",
                border: "1px solid #d0d0d0",
                fontSize: 14,
                outline: "none",
              }}
            />

            {/* Role */}
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 44px 14px 18px",
                marginBottom: 16,
                borderRadius: "999px",
                border: "1px solid #d0d0d0",
                fontSize: 15,
                background: "#fff",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                backgroundImage:
                  "linear-gradient(45deg, transparent 50%, #555 50%), linear-gradient(135deg, #555 50%, transparent 50%)",
                backgroundPosition:
                  "calc(100% - 20px) 22px, calc(100% - 14px) 22px",
                backgroundSize: "6px 6px, 6px 6px",
                backgroundRepeat: "no-repeat",
              }}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>

            {/* Status */}
            <select
              value={newUserStatus}
              onChange={(e) => setNewUserStatus(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 44px 14px 18px",
                marginBottom: 20,
                borderRadius: "999px",
                border: "1px solid #d0d0d0",
                fontSize: 15,
                background: "#fff",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                backgroundImage:
                  "linear-gradient(45deg, transparent 50%, #555 50%), linear-gradient(135deg, #555 50%, transparent 50%)",
                backgroundPosition:
                  "calc(100% - 20px) 22px, calc(100% - 14px) 22px",
                backgroundSize: "6px 6px, 6px 6px",
                backgroundRepeat: "no-repeat",
              }}
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>

            <button
              onClick={async () => {
                await fetch("/api/admin/users", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    username: username.trim(),
                    role: newUserRole,
                    isActive: newUserStatus === "active",
                  }),
                });
                setUsername("");
                setShowAddUserModal(false);
                loadUsers();
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px 18px",
                borderRadius: "999px",
                border: "none",
                background: "#000000",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
        </>
      )}

      {showDeleteUserModal && userToDelete && (
        <>
          {/* Blur overlay */}
          <div
            onClick={closeDeleteUserModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
              zIndex: 40,
              opacity: deleteModalVisible ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          />

          {/* Delete confirmation modal */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${deleteModalVisible ? 1 : 0.96})`,
              opacity: deleteModalVisible ? 1 : 0,
              width: 380,
              background: "#ffffff",
              borderRadius: 18,
              padding: "32px 28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Delete user?
            </div>

            <div style={{ fontSize: 14, color: "#444", marginBottom: 20 }}>
              This will permanently delete{" "}
              <strong>{userToDelete.username}</strong>.
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                onClick={() => {
                  closeDeleteUserModal();
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  const id = userToDelete._id;

                  // Start row collapse animation
                  setDeletingUserIds(new Set([id]));
                  closeDeleteUserModal();

                  // Let the UI animate, then delete
                  setTimeout(async () => {
                    try {
                      await fetch(`/api/admin/users/${id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                    } finally {
                      // Optimistically remove locally
                      setUsers((prev) => prev.filter((u) => u._id !== id));
                      if (selectedUser?._id === id) {
                        setSelectedUser(null);
                        setUserAnalytics(null);
                      }
                      setDeletingUserIds(new Set());
                      loadUsers();
                    }
                  }, 220);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#d11a2a",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {showBulkDeleteModal && bulkUsersToDelete.length > 0 && (
        <>
          <div
            onClick={closeBulkDeleteModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
              zIndex: 40,
              opacity: bulkDeleteModalVisible ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${bulkDeleteModalVisible ? 1 : 0.96})`,
              opacity: bulkDeleteModalVisible ? 1 : 0,
              width: 380,
              background: "#ffffff",
              borderRadius: 18,
              padding: "32px 28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Delete users?
            </div>

            <div style={{ fontSize: 14, color: "#444", marginBottom: 20 }}>
              {(() => {
                const selfId = user?.id ? String(user.id) : null;
                const deletable = bulkUsersToDelete.filter(
                  (u) => !selfId || String(u._id) !== selfId,
                );
                const skipped = bulkUsersToDelete.length - deletable.length;
                return (
                  <>
                    This will permanently delete <strong>{deletable.length}</strong> users.
                    {skipped > 0 && (
                      <span style={{ color: "#6b7280" }}> (skipping your own account)</span>
                    )}
                  </>
                );
              })()}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => {
                  closeBulkDeleteModal();
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const selfId = user?.id ? String(user.id) : null;
                  const selfUsername = user?.username ? String(user.username) : null;
                  const protectedIds = new Set([selfId].filter(Boolean));

                  const eligibleIds = bulkUsersToDelete
                    .filter((u) => {
                      if (protectedIds.has(String(u._id))) return false;
                      if (selfUsername && String(u.username) === selfUsername) return false;
                      return true;
                    })
                    .map((u) => u._id);

                  if (eligibleIds.length === 0) {
                    closeBulkDeleteModal();
                    return;
                  }

                  setDeletingUserIds(new Set(eligibleIds));
                  closeBulkDeleteModal();

                  setTimeout(async () => {
                    try {
                      const results = await Promise.all(
                        eligibleIds.map(async (id) => {
                          const res = await fetch(
                            `/api/admin/users/${id}`,
                            {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${token}` },
                            },
                          );
                          return { id, ok: res.ok, status: res.status };
                        }),
                      );

                      const deletedIds = results.filter((r) => r.ok).map((r) => r.id);
                      const failed = results.filter((r) => !r.ok);

                      if (failed.length) {
                        const byStatus = failed.reduce((acc, r) => {
                          const k = String(r.status || 0);
                          acc[k] = (acc[k] || 0) + 1;
                          return acc;
                        }, {});
                        const breakdown = Object.entries(byStatus)
                          .map(([k, v]) => `${k}:${v}`)
                          .join(", ");
                        alert(
                          `${failed.length} user(s) could not be deleted. Status breakdown: ${breakdown}`,
                        );
                      }

                      setUsers((prev) => prev.filter((u) => !deletedIds.includes(u._id)));
                      if (selectedUser && deletedIds.includes(selectedUser._id)) {
                        setSelectedUser(null);
                        setUserAnalytics(null);
                      }
                    } finally {
                      setDeletingUserIds(new Set());
                      loadUsers();
                    }
                  }, 240);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#d11a2a",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}

      {/* BULK UPDATE CONFIRM MODAL */}
      {bulkConfirmAction && (
        <>
          <div
            onClick={closeBulkConfirmModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
              zIndex: 40,
              opacity: bulkConfirmVisible ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${bulkConfirmVisible ? 1 : 0.96})`,
              opacity: bulkConfirmVisible ? 1 : 0,
              width: 380,
              background: "#ffffff",
              borderRadius: 18,
              padding: "32px 28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
              {bulkConfirmAction.title}
            </div>

            <div style={{ fontSize: 14, color: "#444", marginBottom: 24 }}>
              {bulkConfirmAction.message}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={closeBulkConfirmModal}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const ids = bulkConfirmAction.users.map((u) => u._id);
                  updateUsersOptimistic(ids, bulkConfirmAction.fields);
                  closeBulkConfirmModal();
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#000000",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* CONFIRM ACTION MODAL */}
      {confirmAction && (
        <>
          <div
            onClick={closeConfirmModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
              zIndex: 40,
              opacity: confirmModalVisible ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${confirmModalVisible ? 1 : 0.96})`,
              opacity: confirmModalVisible ? 1 : 0,
              width: 380,
              padding: "32px 28px",
              background: "#ffffff",
              borderRadius: 18,
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
              {confirmAction.fields?.role
                ? "Confirm role change"
                : confirmAction.fields?.isActive === false
                  ? "Confirm disable"
                  : "Confirm action"}
            </div>

            <div style={{ fontSize: 14, color: "#444", marginBottom: 24 }}>
              {confirmAction.message}
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                onClick={closeConfirmModal}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                No
              </button>

              <button
                onClick={() => {
                  updateUserOptimistic(
                    confirmAction.user,
                    confirmAction.fields,
                  );
                  closeConfirmModal();
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    confirmAction.fields?.isActive === false
                      ? "#d11a2a"
                      : "#000000",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </>
      )}

      {/* EDIT USER FIELD MODAL */}
      {editUserField && selectedUser && (
        <>
          <div
            onClick={closeEditModal}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
              zIndex: 40,
              opacity: editModalVisible ? 1 : 0,
              transition: "opacity 220ms ease-out",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${editModalVisible ? 1 : 0.96})`,
              opacity: editModalVisible ? 1 : 0,
              width: 380,
              background: "#ffffff",
              borderRadius: 18,
              padding: "32px 28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              zIndex: 50,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {editUserField === "username"
                ? "Edit username"
                : editUserField === "role"
                  ? "Edit role"
                  : "Edit status"}
            </div>

            <div style={{ fontSize: 14, color: "#444", marginBottom: 14 }}>
              Update <strong>{selectedUser.username}</strong>.
            </div>

            {editUserField === "username" && (
              <input
                autoFocus
                value={editUserValue}
                onChange={(e) => setEditUserValue(e.target.value)}
                placeholder="Username"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  outline: "none",
                  marginBottom: 18,
                }}
              />
            )}

            {editUserField === "role" && (
              <select
                autoFocus
                value={editUserValue}
                onChange={(e) => setEditUserValue(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  background: "#fff",
                  marginBottom: 18,
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            )}

            {editUserField === "status" && (
              <select
                autoFocus
                value={editUserValue}
                onChange={(e) => setEditUserValue(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  background: "#fff",
                  marginBottom: 18,
                }}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={closeEditModal}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const next = {};
                  if (editUserField === "username") {
                    const v = editUserValue.trim();
                    if (!v) return;
                    next.username = v;
                  }
                  if (editUserField === "role") next.role = editUserValue;
                  if (editUserField === "status")
                    next.isActive = editUserValue === "active";

                  updateUserOptimistic(selectedUser, next);
                  closeEditModal();
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#000000",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
