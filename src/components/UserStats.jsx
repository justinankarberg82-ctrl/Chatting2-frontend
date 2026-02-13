import AnimatedNumber from "./AnimatedNumber";
import UsageTotalsPanel from "./UsageTotalsPanel";

export default function UserStats({ total, active, online, token, refreshKey, onAddUser }) {
  const stats = [
    {
      label: "TOTAL USERS",
      value: total,
      accent: (total ?? 0) > 0 ? "#3b82f6" : "#9ca3af",
    },
    {
      label: "ACTIVE USERS",
      value: active,
      accent: (active ?? 0) > 0 ? "#22c55e" : "#9ca3af",
    },
    {
      label: "ONLINE USERS",
      value: online ?? "—",
      accent: (online ?? 0) > 0 ? "#22c55e" : "#9ca3af",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "stretch",
        width: "100%",
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", gap: 10, flex: 1, width: "100%" }}>
         {stats.map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                minWidth: 0,
                background: "#4d4d4d",
                borderRadius: 14,
                 padding: "8px 10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: 0.5,
                    color: "#b9b9b9",
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 35, fontWeight: 600, lineHeight: 1, color: "#ffffff" }}>
                  <AnimatedNumber value={s.value} duration={260} />
                </div>
              </div>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: s.accent,
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
      </div>

      <UsageTotalsPanel token={token} refreshKey={refreshKey} />
    </div>
  );
}
