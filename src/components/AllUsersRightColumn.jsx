import TopUsersPanel from "./TopUsersPanel";
import AdminNotificationsPanel from "./AdminNotificationsPanel";

export default function AllUsersRightColumn({ token, lastAdminEvent, refreshKey }) {
  return (
    <div
      style={{
        flex: "38 1 0",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "65 1 0", minHeight: 0 }}>
        <TopUsersPanel token={token} refreshKey={refreshKey} />
      </div>

      <div style={{ flex: "35 1 0", minHeight: 0 }}>
        <AdminNotificationsPanel event={lastAdminEvent} token={token} />
      </div>
    </div>
  );
}
