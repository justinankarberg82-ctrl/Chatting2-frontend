import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import AnimatedNumber from "./AnimatedNumber";
import TimeUnitSegmented from "./TimeUnitSegmented";
import { API_BASE } from "../lib/net";

function toDateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(d, days) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function startOfWeekMonday(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  const dow = n.getDay(); // 0 Sun .. 6 Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  n.setDate(n.getDate() + delta);
  return n;
}

function startOfMonth(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  n.setDate(1);
  return n;
}

function startOfYear(d) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  n.setMonth(0, 1);
  return n;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatRangeLabel(unit, anchorDate) {
  if (!anchorDate) return "";

  if (unit === "day") {
    return anchorDate.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (unit === "week") {
    const start = startOfWeekMonday(anchorDate);
    const end = addDays(start, 6);
    const left = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const right = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${left} - ${right}`;
  }

  if (unit === "month") {
    return anchorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  if (unit === "year") {
    return String(anchorDate.getFullYear());
  }

  return "";
}

function ThreeDotsIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

export default function UsageTotalsPanel({ token, refreshKey }) {
  const [unit, setUnit] = useState("day");
  const [anchorDate, setAnchorDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const calendarButtonRef = useRef(null);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });

  const [totals, setTotals] = useState({ requests: 0, credits: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const label = useMemo(() => formatRangeLabel(unit, anchorDate), [unit, anchorDate]);

  useEffect(() => {
    if (!calendarOpen) return;

    const clampToViewport = () => {
      const pop = calendarRef.current;
      if (!pop) return;
      const r = pop.getBoundingClientRect();
      const pad = 8;
      setCalendarPos((prev) => {
        const leftMax = Math.max(pad, window.innerWidth - r.width - pad);
        const topMax = Math.max(pad, window.innerHeight - r.height - pad);
        const nextLeft = Math.round(clamp(prev.left, pad, leftMax));
        const nextTop = Math.round(clamp(prev.top, pad, topMax));
        if (nextLeft === prev.left && nextTop === prev.top) return prev;
        return { ...prev, left: nextLeft, top: nextTop };
      });
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") setCalendarOpen(false);
    };

    const onMouseDown = (e) => {
      const pop = calendarRef.current;
      const btn = calendarButtonRef.current;
      if (pop && pop.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      setCalendarOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("resize", clampToViewport);
    window.addEventListener("scroll", clampToViewport, true);
    requestAnimationFrame(clampToViewport);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", clampToViewport);
      window.removeEventListener("scroll", clampToViewport, true);
    };
  }, [calendarOpen]);

  useEffect(() => {
    if (!token) return;

    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      unit,
      date: toDateKey(anchorDate),
      tzOffset: String(new Date().getTimezoneOffset()),
    });

    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/admin/usage-summary?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.text().catch(() => "");
        throw new Error(body || `HTTP ${r.status}`);
      })
      .then((data) => {
        setTotals({
          requests: Number(data.requests ?? 0),
          credits: Number(data.credits ?? data.tokens ?? 0),
        });
      })
      .catch((e) => {
        setError(e?.message || "Failed to load");
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [token, unit, anchorDate, refreshKey]);

  const weekRange = useMemo(() => {
    if (unit !== "week") return null;
    const from = startOfWeekMonday(anchorDate);
    const to = addDays(from, 6);
    return { from, to };
  }, [unit, anchorDate]);

  const monthRange = useMemo(() => {
    if (unit !== "month") return null;
    const from = startOfMonth(anchorDate);
    const to = addDays(new Date(from.getFullYear(), from.getMonth() + 1, 0), 0);
    to.setHours(0, 0, 0, 0);
    return { from, to };
  }, [unit, anchorDate]);

  const onPickUnit = (next) => {
    setUnit(next);
    const d = new Date();
    d.setHours(0, 0, 0, 0);

    if (next === "week") setAnchorDate(startOfWeekMonday(d));
    else if (next === "month") setAnchorDate(startOfMonth(d));
    else if (next === "year") setAnchorDate(startOfYear(d));
    else setAnchorDate(d);
  };

  return (
    <div
      style={{
        width: "100%",
        background: "#ffffff",
        borderRadius: 14,
        padding: "8px 10px 4px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "#343434",
            borderRadius: 12,
            padding: "6px 8px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, color: "#afafaf" }}>Requests</div>
          <div style={{ fontSize: 40, fontWeight: 600, textAlign: "center", paddingTop: 0, color: "#ffffff" }}>
            <AnimatedNumber value={totals.requests} duration={260} />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "#343434",
            borderRadius: 12,
            padding: "4px 8px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "#afafaf" }}>Credits</div>
          <div style={{ fontSize: 40, fontWeight: 600, textAlign: "center", paddingTop: 0, color: "#ffffff" }}>
            <AnimatedNumber value={totals.credits} duration={260} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 6,
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#111827",
              fontWeight: 700,
              padding: "3px 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={label}
          >
            {label}
          </div>

          <button
            ref={calendarButtonRef}
            type="button"
            onClick={() => {
              const next = !calendarOpen;
              if (next) {
                const rect = calendarButtonRef.current?.getBoundingClientRect();
                if (rect) {
                  setCalendarPos({
                    top: Math.round(rect.bottom + 8),
                    left: Math.round(rect.left),
                  });
                }
              }
              setCalendarOpen(next);
            }}
            aria-label="Open calendar"
            title="Pick period"
            style={{
              padding: "5px 6px",
              borderRadius: 10,
              border: "none",
              background: "#ffffff",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flex: "0 0 auto",
            }}
          >
            <ThreeDotsIcon size={18} />
          </button>

          {(loading || error) && (
            <div style={{ fontSize: 11, color: error ? "#dc2626" : "#6b7280", fontWeight: 700 }}>
              {loading ? "Loading..." : "Failed"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <TimeUnitSegmented value={unit} onChange={onPickUnit} padTop={3} padBottom={3} />
        </div>
      </div>

      {calendarOpen &&
        createPortal(
          <div
            ref={calendarRef}
            style={{
              position: "fixed",
              top: calendarPos.top,
              left: calendarPos.left,
              zIndex: 10000,
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              padding: 10,
              fontSize: 12,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              maxHeight: `calc(100vh - ${calendarPos.top}px - 12px)`,
              overflow: "auto",
            }}
          >
            {unit === "year" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>Pick year</div>
                <select
                  value={String(anchorDate.getFullYear())}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    if (!Number.isFinite(y)) return;
                    const d = new Date(anchorDate);
                    d.setFullYear(y, 0, 1);
                    d.setHours(0, 0, 0, 0);
                    setAnchorDate(startOfYear(d));
                    setCalendarOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    background: "#ffffff",
                  }}
                >
                  {Array.from({ length: 16 }).map((_, idx) => {
                    const y = 2020 + idx;
                    return (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <DayPicker
                mode="single"
                selected={anchorDate}
                onSelect={(d) => {
                  if (!d) return;
                  const n = new Date(d);
                  n.setHours(0, 0, 0, 0);

                  if (unit === "week") setAnchorDate(startOfWeekMonday(n));
                  else if (unit === "month") setAnchorDate(startOfMonth(n));
                  else setAnchorDate(n);

                  setCalendarOpen(false);
                }}
                captionLayout="dropdown"
                fromYear={2020}
                toYear={2035}
                showOutsideDays
                weekStartsOn={1}
                modifiers={{
                  selectedWeek: weekRange,
                  selectedMonth: monthRange,
                }}
                modifiersStyles={{
                  selectedWeek: {
                    backgroundColor: "#111827",
                    color: "#ffffff",
                    borderRadius: 999,
                  },
                  selectedMonth: {
                    backgroundColor: "#111827",
                    color: "#ffffff",
                    borderRadius: 999,
                  },
                }}
                style={{
                  "--rdp-day-height": "32px",
                  "--rdp-day-width": "32px",
                  "--rdp-day_button-height": "30px",
                  "--rdp-day_button-width": "30px",
                  "--rdp-weekday-padding": "0.25rem 0rem",
                  "--rdp-nav-height": "2.25rem",
                  "--rdp-nav_button-height": "1.9rem",
                  "--rdp-nav_button-width": "1.9rem",
                  "--rdp-months-gap": "1rem",
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
