import { useState } from "react";
import UserStats from "./UserStats";
import UserColumnList from "./UserColumnList";
import AddUserModal from "./AddUserModal";

export default function LeftAdmin({
  users,
  loading,
  selectedUserId,
  onSelectUser,
  onDeleteUser,
  onDeleteMany,
  onSetRoleMany,
  onSetStatusMany,
  onCreateUser,
  deletingUserIds,
  token,
  usageRefreshKey,
}) {
  const [showAdd, setShowAdd] = useState(false);
  const visibleUsers = users.filter(
    (u) => !["Hunter0516", "Justin"].includes(String(u.username || "").trim()),
  );

  const onlineCount = visibleUsers.filter((u) => u.isActive && u.online).length;
  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        flex: "0 0 30%",
        maxWidth: "30%",
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* Top stats + add user */}
      <UserStats
        total={visibleUsers.length}
        active={visibleUsers.filter((u) => u.isActive).length}
        online={onlineCount}
        token={token}
        refreshKey={usageRefreshKey}
        onAddUser={() => setShowAdd(true)}
      />

      {/* User list */}
      <div style={{ flex: 1, marginTop: 4, minHeight: 0 }}>
        <UserColumnList
          users={visibleUsers}
          loading={loading}
          selectedUserId={selectedUserId}
          onSelect={onSelectUser}
          onDelete={onDeleteUser}
          onDeleteMany={onDeleteMany}
          onSetRoleMany={onSetRoleMany}
          onSetStatusMany={onSetStatusMany}
          onAddUser={() => setShowAdd(true)}
          deletingUserIds={deletingUserIds}
        />
      </div>

      <AddUserModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={({ username, role, status }) =>
          onCreateUser(username, role, status)
        }
      />
    </section>
  );
}
