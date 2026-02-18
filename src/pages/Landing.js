import { useMemo } from "react";

function Cloud({ style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        borderRadius: 999,
        filter: "blur(1px)",
        background:
          "radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0.68) 60%, rgba(255,255,255,0.00) 100%)",
        ...style,
      }}
    />
  );
}

export default function Landing() {
  const clouds = useMemo(
    () => [
      { top: "14%", left: "-8%", width: 420, height: 220, opacity: 0.85 },
      { top: "8%", right: "-10%", width: 520, height: 260, opacity: 0.75 },
      { top: "52%", left: "-12%", width: 560, height: 280, opacity: 0.55 },
      { top: "62%", right: "-14%", width: 640, height: 320, opacity: 0.5 },
      { top: "36%", left: "18%", width: 360, height: 200, opacity: 0.35 },
      { top: "22%", right: "18%", width: 340, height: 190, opacity: 0.3 },
    ],
    [],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        overflow: "hidden",
        position: "relative",
        background:
          "radial-gradient(1200px 600px at 20% 10%, rgba(255,255,255,0.95), rgba(255,255,255,0.0) 60%), radial-gradient(900px 520px at 82% 18%, rgba(255,255,255,0.70), rgba(255,255,255,0.0) 62%), linear-gradient(180deg, #a9d5ff 0%, #d9edff 48%, #f3e7e7 100%)",
        color: "#0f172a",
      }}
    >
      <style>{`
        @keyframes landingFloat {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -10px, 0); }
        }
        @keyframes landingDrift {
          0% { transform: translate3d(-10px, 0, 0); }
          50% { transform: translate3d(10px, 0, 0); }
          100% { transform: translate3d(-10px, 0, 0); }
        }
      `}</style>

      {clouds.map((c, idx) => (
        <Cloud
          key={idx}
          style={{
            ...c,
            animation:
              idx % 2 === 0
                ? "landingDrift 12s ease-in-out infinite"
                : "landingFloat 10s ease-in-out infinite",
          }}
        />
      ))}

    </div>
  );
}
