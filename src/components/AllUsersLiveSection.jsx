import AllUsersLiveChart from "./AllUsersLiveChart";
import AllUsersRightColumn from "./AllUsersRightColumn";

export default function AllUsersLiveSection({ token, lastAdminEvent, lastUsageEvent, refreshKey, style }) {
  return (
    <section
      style={{
        height: "100%",
        minHeight: 0,
        background: "#ffffff",
        borderRadius: 16,
        padding: 10,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.10)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "hidden",
        ...(style || {}),
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
        <div style={{ flex: "62 1 0", minWidth: 0, minHeight: 0 }}>
          <AllUsersLiveChart token={token} usageEvent={lastUsageEvent} refreshKey={refreshKey} />
        </div>

        <AllUsersRightColumn token={token} lastAdminEvent={lastAdminEvent} refreshKey={refreshKey} />
      </div>
    </section>
  );
}
