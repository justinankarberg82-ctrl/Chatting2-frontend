import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const SORT_OPTIONS = [
  { value: "lastLogin", label: "Last login (recent)" },
  { value: "name", label: "Name" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
  { value: "online", label: "Online/Offline" },
  { value: "created", label: "Created time" },
];

export default function UserColumnList({
  users = [],
  loading = false,
  selectedUserId = null,
  onSelect,
  onDelete,
  onDeleteMany,
  onSetRoleMany,
  onSetStatusMany,
  onAddUser,
  deletingUserIds,
}) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortFocused, setSortFocused] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const sortButtonRef = useRef(null);
  const sortMenuRef = useRef(null);
  const [presencePulseById, setPresencePulseById] = useState({}); // { [userId]: { lightOn: boolean } }
  const presenceTimersRef = useRef(new Map()); // userId -> { timeoutId, intervalId }
  const prevOnlineRef = useRef(new Map());
  const rowRefs = useRef(new Map()); // userId -> HTMLElement
  const prevRowTopRef = useRef(new Map()); // userId -> number
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectAllRef = useRef(null);
  const [bulkRole, setBulkRole] = useState("user");
  const [bulkStatus, setBulkStatus] = useState("active");
  const [sortBy, setSortBy] = useState("lastLogin");

  const sortLabel = useMemo(() => {
    return SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort";
  }, [sortBy]);

  useEffect(() => {
    if (!sortOpen) return;

    setSortMenuVisible(false);
    const raf = requestAnimationFrame(() => setSortMenuVisible(true));

    const onKeyDown = (e) => {
      if (e.key === "Escape") setSortOpen(false);
    };

    const onMouseDown = (e) => {
      const btn = sortButtonRef.current;
      const menu = sortMenuRef.current;
      if (btn && btn.contains(e.target)) return;
      if (menu && menu.contains(e.target)) return;
      setSortOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [sortOpen]);

  useEffect(() => {
    // Cleanup presence timers on unmount
    return () => {
      for (const t of presenceTimersRef.current.values()) {
        if (t?.timeoutId) clearTimeout(t.timeoutId);
        if (t?.intervalId) clearInterval(t.intervalId);
      }
      presenceTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    // Blink online indicator (green/grey) 3 times over 3s when user presence changes.
    const nextPrev = new Map(prevOnlineRef.current);

    for (const u of users || []) {
      const id = u?._id ? String(u._id) : null;
      if (!id) continue;

      const prevOnline = nextPrev.get(id);
      const nowOnline = !!u.online;

      if (typeof prevOnline === 'boolean' && prevOnline !== nowOnline) {
        // Don't animate disabled accounts.
        if (!u.isActive) {
          setPresencePulseById((prev) => {
            if (!prev[id]) return prev;
            const { [id]: _omit, ...rest } = prev;
            return rest;
          });
        } else {
          const existing = presenceTimersRef.current.get(id);
          if (existing?.timeoutId) clearTimeout(existing.timeoutId);
          if (existing?.intervalId) clearInterval(existing.intervalId);

          // Let the row re-sort/move first, then blink.
          const timeoutId = setTimeout(() => {
            let ticks = 0;
            setPresencePulseById((prev) => ({ ...prev, [id]: { lightOn: true } }));

            const intervalId = setInterval(() => {
              ticks += 1;
              if (ticks >= 6) {
                clearInterval(intervalId);
                const current = presenceTimersRef.current.get(id);
                if (current?.intervalId === intervalId) {
                  presenceTimersRef.current.delete(id);
                }
                setPresencePulseById((prev) => {
                  if (!prev[id]) return prev;
                  const { [id]: _omit, ...rest } = prev;
                  return rest;
                });
                return;
              }

              setPresencePulseById((prev) => {
                const cur = prev[id];
                if (!cur) return prev;
                return { ...prev, [id]: { lightOn: !cur.lightOn } };
              });
            }, 500);

            presenceTimersRef.current.set(id, { timeoutId: null, intervalId });
          }, 180);

          presenceTimersRef.current.set(id, { timeoutId, intervalId: null });
        }
      }

      nextPrev.set(id, nowOnline);
    }

    prevOnlineRef.current = nextPrev;
  }, [users]);

  const selectedUsers = useMemo(
    () => users.filter((u) => selectedIds.has(u._id)),
    [users, selectedIds],
  );

  const effectiveRole = useMemo(() => {
    if (!selectedUsers.length) return bulkRole;
    const first = selectedUsers[0]?.role;
    if (!first) return bulkRole;
    const allSame = selectedUsers.every((u) => u.role === first);
    return allSame ? first : bulkRole;
  }, [selectedUsers, bulkRole]);

  const effectiveStatus = useMemo(() => {
    if (!selectedUsers.length) return bulkStatus;
    const first = !!selectedUsers[0]?.isActive;
    const allSame = selectedUsers.every((u) => !!u.isActive === first);
    return allSame ? (first ? "active" : "disabled") : bulkStatus;
  }, [selectedUsers, bulkStatus]);

  // Keep the bulk toggles aligned with the actual selected users.
  // This matters because the parent can refresh/re-render the list while keeping selection.
  useEffect(() => {
    if (!selectedUsers.length) return;

    const role = effectiveRole;
    if (role === "admin" || role === "user") setBulkRole(role);

    const status = effectiveStatus;
    if (status === "active" || status === "disabled") setBulkStatus(status);
  }, [selectedUsers, effectiveRole, effectiveStatus]);

  const TogglePill = ({ leftLabel, rightLabel, value, onToggle }) => {
    const isRight = value === rightLabel;
    return (
      <button
        type="button"
        onClick={onToggle}
        style={{
          position: "relative",
          height: 34,
          width: "100%",
          padding: 4,
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: "#f1f5f9",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: isRight ? "flex-end" : "flex-start",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
        aria-label={`Toggle ${leftLabel}/${rightLabel}`}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            left: isRight ? 10 : 34,
            right: isRight ? 34 : 10,
            textAlign: isRight ? "left" : "right",
            fontSize: 11,
            fontWeight: 800,
            color: "#111827",
            pointerEvents: "none",
            opacity: 0.9,
            overflow: "hidden",
            textOverflow: "clip",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {isRight ? leftLabel : rightLabel}
        </span>

        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 6px 14px rgba(0,0,0,0.10)",
            transition: "transform 180ms ease",
          }}
        />
      </button>
    );
  };

  const getLastLoginTime = (u) =>
    new Date(u?.lastLogin || u?.updatedAt || u?.createdAt || 0).getTime();
  const getCreatedTime = (u) => new Date(u?.createdAt || 0).getTime();

  const filtered = users
    .filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aName = String(a.username || "").toLowerCase();
      const bName = String(b.username || "").toLowerCase();
      const aRole = String(a.role || "").toLowerCase();
      const bRole = String(b.role || "").toLowerCase();
      const aStatus = a.isActive ? 0 : 1; // active first
      const bStatus = b.isActive ? 0 : 1;
      const aOnline = a.online ? 0 : 1; // online first
      const bOnline = b.online ? 0 : 1;
      const aLast = getLastLoginTime(a);
      const bLast = getLastLoginTime(b);
      const aCreated = getCreatedTime(a);
      const bCreated = getCreatedTime(b);

      // online users first, then active-but-offline, then disabled
      const aPresenceRank = !a.isActive ? 2 : a.online ? 0 : 1;
      const bPresenceRank = !b.isActive ? 2 : b.online ? 0 : 1;

      if (sortBy === "name") {
        if (aName !== bName) return aName < bName ? -1 : 1;
        return bLast - aLast;
      }

      if (sortBy === "role") {
        if (aRole !== bRole) return aRole < bRole ? -1 : 1;
        if (aName !== bName) return aName < bName ? -1 : 1;
        return bLast - aLast;
      }

      if (sortBy === "status") {
        if (aStatus !== bStatus) return aStatus - bStatus;
        return bLast - aLast;
      }

      if (sortBy === "online") {
        if (aPresenceRank !== bPresenceRank) return aPresenceRank - bPresenceRank;
        if (bLast !== aLast) return bLast - aLast;
        if (aName !== bName) return aName < bName ? -1 : 1;
        return 0;
      }

      if (sortBy === "created") {
        if (aCreated !== bCreated) return bCreated - aCreated;
        if (aName !== bName) return aName < bName ? -1 : 1;
        return bLast - aLast;
      }

      // default: last login recent
      if (aPresenceRank !== bPresenceRank) return aPresenceRank - bPresenceRank;
      if (bLast !== aLast) return bLast - aLast;
      if (aName !== bName) return aName < bName ? -1 : 1;
      return 0;
    });

  const filteredIds = useMemo(() => filtered.map((u) => u._id), [filtered]);
  const filteredIdsKey = useMemo(
    () => filteredIds.map((id) => String(id)).join(","),
    [filteredIds],
  );

  useLayoutEffect(() => {
    // FLIP animation for row re-ordering (sort/presence changes)
    const nextTop = new Map();

    for (const id of filteredIds) {
      const key = String(id);
      const el = rowRefs.current.get(key);
      if (!el) continue;
      nextTop.set(key, el.getBoundingClientRect().top);
    }

    for (const [key, newTop] of nextTop.entries()) {
      const prevTop = prevRowTopRef.current.get(key);
      if (typeof prevTop !== "number") continue;

      const delta = prevTop - newTop;
      if (!delta) continue;

      const el = rowRefs.current.get(key);
      if (!el) continue;

      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        const cur = rowRefs.current.get(key);
        if (!cur) return;
        cur.style.transition = "transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        cur.style.transform = "translateY(0)";
      });
    }

    prevRowTopRef.current = nextTop;
  }, [filteredIdsKey]);
  const selectedCount = useMemo(() => {
    let n = 0;
    for (const id of filteredIds) if (selectedIds.has(id)) n++;
    return n;
  }, [filteredIds, selectedIds]);

  const allSelected = filteredIds.length > 0 && selectedCount === filteredIds.length;
  const someSelected = selectedCount > 0 && selectedCount < filteredIds.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const existing = new Set(users.map((u) => u._id));
      for (const id of next) if (!existing.has(id)) next.delete(id);
      return next;
    });
  }, [users]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {loading && (
        <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>
          Loading users…
        </div>
      )}

      {/* Search + Add User */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <input
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "12px 16px",
            borderRadius: 10,
            border: `1px solid ${searchFocused ? "#9ca3af" : "#e5e7eb"}`,
            background: searchFocused ? "#f3f4f6" : "#ffffff",
            fontSize: 14,
            outline: "none",
            transition:
              "border-color 180ms ease, background 180ms ease",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <button
              ref={sortButtonRef}
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              onFocus={() => setSortFocused(true)}
              onBlur={() => setSortFocused(false)}
              title="Sort"
              style={{
                height: 40,
                padding: "0 12px",
                borderRadius: 12,
                border: `1px solid ${sortFocused || sortOpen ? "#9ca3af" : "#e5e7eb"}`,
                background: sortFocused || sortOpen ? "#f3f4f6" : "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                outline: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                transition: "border-color 180ms ease, background 180ms ease",
              }}
            >
              <span style={{ whiteSpace: "nowrap" }}>{sortLabel}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.85 }}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {sortOpen && (
              <div
                ref={sortMenuRef}
                style={{
                  position: "absolute",
                  top: 46,
                  right: 0,
                  width: 210,
                  background: "#ffffff",
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.16)",
                  transform: sortMenuVisible ? "translateY(0) scale(1)" : "translateY(-6px) scale(0.98)",
                  opacity: sortMenuVisible ? 1 : 0,
                  transition: "opacity 160ms ease, transform 160ms ease",
                  zIndex: 50,
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    color: "#6b7280",
                    background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  Sort users
                </div>

                {SORT_OPTIONS.map((opt) => {
                  const active = opt.value === sortBy;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSortBy(opt.value);
                        setSortOpen(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        border: "none",
                        background: active ? "#f3f4f6" : "transparent",
                        color: "#111827",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: active ? 700 : 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                      onMouseEnter={(e) => {
                        if (active) return;
                        e.currentTarget.style.background = "#f9fafb";
                      }}
                      onMouseLeave={(e) => {
                        if (active) return;
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span>{opt.label}</span>
                      {active && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#6b7280"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={onAddUser}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "none",
              background: "#343434",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + New User
          </button>
        </div>
      </div>

      {/* Bulk actions row (appears when selection exists) */}
      <div
        style={{
          flexShrink: 0,
          overflow: "hidden",
          maxHeight: selectedCount > 0 ? 56 : 0,
          opacity: selectedCount > 0 ? 1 : 0,
          transform: selectedCount > 0 ? "translateY(0)" : "translateY(-6px)",
          transition: "max-height 200ms ease, opacity 200ms ease, transform 200ms ease",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 2fr 1fr 1fr 80px",
            alignItems: "center",
            background: "#ffffff",
            boxShadow: "0 1px 0 rgba(0,0,0,0.06)",
          }}
        >
          <div />
          <div style={{ padding: "10px 16px", fontSize: 12, color: "#6b7280" }}>
            {selectedCount} selected
          </div>

          {/* Role bulk (toggle) */}
          <div style={{ padding: "10px 8px", minWidth: 0, overflow: "hidden" }}>
            <TogglePill
              leftLabel="User"
              rightLabel="Admin"
              value={effectiveRole === "admin" ? "Admin" : "User"}
              onToggle={() => {
                const next = effectiveRole === "admin" ? "user" : "admin";
                setBulkRole(next);
                const selectedUsers = users.filter((u) => selectedIds.has(u._id));
                onSetRoleMany?.(selectedUsers, next);
              }}
            />
          </div>

          {/* Status bulk (toggle) */}
          <div style={{ padding: "10px 8px", minWidth: 0, overflow: "hidden" }}>
            <TogglePill
              leftLabel="Active"
              rightLabel="Disabled"
              value={effectiveStatus === "disabled" ? "Disabled" : "Active"}
              onToggle={() => {
                const next = effectiveStatus === "disabled" ? "active" : "disabled";
                setBulkStatus(next);
                const selectedUsers = users.filter((u) => selectedIds.has(u._id));
                onSetStatusMany?.(selectedUsers, next);
              }}
            />
          </div>

          {/* Delete all (trash icon like rows) */}
          <div
            style={{
              padding: "10px 16px",
              display: "flex",
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            <button
              onClick={() => {
                const selectedUsers = users.filter((u) => selectedIds.has(u._id));
                onDeleteMany?.(selectedUsers);
              }}
              title={`Delete ${selectedCount} users`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "transparent",
                color: "#d11a2a",
                cursor: "pointer",
                padding: 2,
                flexShrink: 0,
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
            </button>
          </div>
        </div>
      </div>

      {/* Fixed header */}
      <div
        style={{
          flexShrink: 0,
          display: "grid",
          gridTemplateColumns: "44px 2fr 1fr 1fr 80px",
          background: "#eef4ff",
          fontSize: 14,
          fontWeight: 600,
          color: "#334155",
          boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ padding: "14px 12px", display: "flex", justifyContent: "center" }}>
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={(e) => {
              const checked = e.target.checked;
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (checked) {
                  for (const id of filteredIds) next.add(id);
                } else {
                  for (const id of filteredIds) next.delete(id);
                }
                return next;
              });
            }}
            aria-label="Select all"
          />
        </div>

        <div style={{ padding: "14px 16px" }}>Username</div>
        <div style={{ padding: "14px 16px" }}>Role</div>
        <div style={{ padding: "14px 16px" }}>Status</div>
        <div style={{ padding: "14px 16px", textAlign: "right" }}>Action</div>
      </div>

      {/* Scrollable rows */}
      <div style={{ flex: 1, overflowY: "auto", paddingTop: 5 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {filtered.map((u) => {
            const isDeleting = deletingUserIds && deletingUserIds.has(u._id);
            const checked = selectedIds.has(u._id);
            const isSelected = !!selectedUserId && String(selectedUserId) === String(u._id);
            const pulse = presencePulseById[String(u._id)];
            const dotColor = pulse
              ? pulse.lightOn
                ? "#22c55e"
                : "#3f3f3f"
              : u.online
                ? "#22c55e"
                : "#3f3f3f";
            return (
              <div
                key={u._id}
                style={{
                  overflow: "hidden",
                  maxHeight: isDeleting ? 0 : 96,
                  opacity: isDeleting ? 0 : 1,
                  transform: isDeleting ? "translateX(8px)" : "translateX(0)",
                  transition:
                    "max-height 220ms ease, opacity 220ms ease, transform 220ms ease",
                }}
              >
                <div
                  ref={(el) => {
                    const key = String(u._id);
                    if (el) rowRefs.current.set(key, el);
                    else rowRefs.current.delete(key);
                  }}
                  onClick={() => onSelect?.(u)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 2fr 1fr 1fr 80px",
                    alignItems: "center",
                    background: isSelected ? "#dbdbdb" : "#ffffff",
                    borderRadius: 12,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    border: "none",
                    cursor: isDeleting ? "default" : "pointer",
                    pointerEvents: isDeleting ? "none" : "auto",
                    transition:
                      "background 0.15s ease",
                    willChange: "transform",
                  }}
                  onMouseEnter={(e) => {
                    if (isDeleting) return;
                    e.currentTarget.style.background = isSelected ? "#e3e3e3" : "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    if (isDeleting) return;
                    e.currentTarget.style.background = isSelected ? "#f3f4f6" : "#ffffff";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const nextChecked = e.target.checked;
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (nextChecked) next.add(u._id);
                          else next.delete(u._id);
                          return next;
                        });
                      }}
                      aria-label={`Select ${u.username}`}
                    />
                  </div>
                  <div style={{ padding: "14px 16px", fontWeight: 600 }}>
                    {u.username}
                  </div>
              <div style={{ color: "#64748b" }}>{u.role}</div>
               <div style={{ display: "flex", alignItems: "center" }}>
                 <span
                   style={{
                     padding: "6px 14px",
                     borderRadius: 999,
                     fontSize: 13,
                     fontWeight: 600,
                     background: u.isActive ? "#e0fbe8" : "#fee2e2",
                     color: u.isActive ? "#16a34a" : "#dc2626",
                     lineHeight: 1,
                   }}
                 >
                   {u.isActive ? "Active" : "Disabled"}
                 </span>
               </div>
               <div
                 style={{
                   display: "flex",
                   alignItems: "center",
                   justifyContent: "flex-end",
                   gap: 12,
                   padding: "0 16px",
                 }}
               >
                {/* Online / Offline indicator */}
                 <span
                   title={!u.isActive ? "Disabled" : u.online ? "Online" : "Offline"}
                   style={{
                     width: 10,
                     height: 10,
                     borderRadius: "50%",
                     background: dotColor,
                     opacity: !u.isActive ? 0.6 : 1,
                     flexShrink: 0,
                   }}
                 />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(u);
                  }}
                  title="Delete user"
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    background: "transparent",
                    color: "#d11a2a",
                    cursor: "pointer",
                    padding: 2,
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
                </button>
              </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
