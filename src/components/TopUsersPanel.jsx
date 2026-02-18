import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
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

export default function TopUsersPanel({ token, refreshKey }) {
  const TOP_N = 3;
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

  const [rows, setRows] = useState([]);
  const [prevRows, setPrevRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const topRows = useMemo(() => {
    return (Array.isArray(rows) ? rows : []).slice(0, TOP_N);
  }, [rows, TOP_N]);

  const maxRequests = useMemo(() => {
    let max = 1;
    for (const r of topRows || []) {
      const v = Number(r?.requests ?? 0);
      if (Number.isFinite(v) && v > max) max = v;
    }
    return max;
  }, [topRows]);

  const prevByUserId = useMemo(() => {
    const map = new Map();
    for (const r of prevRows || []) {
      const id = r?.userId ? String(r.userId) : null;
      if (!id) continue;
      map.set(id, {
        requests: Number(r.requests ?? 0),
        credits: Number(r.credits ?? r.tokens ?? 0),
      });
    }
    return map;
  }, [prevRows]);

  const prevRankByUserId = useMemo(() => {
    const map = new Map();
    for (let i = 0; i < (prevRows || []).length; i++) {
      const r = prevRows[i];
      const id = r?.userId ? String(r.userId) : null;
      if (!id) continue;
      map.set(id, i + 1);
    }
    return map;
  }, [prevRows]);

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
      limit: String(TOP_N),
    });

    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/admin/top-users?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        const body = await r.text().catch(() => "");
        throw new Error(body || `HTTP ${r.status}`);
      })
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => {
        setRows([]);
        setError(e?.message || "Failed to load");
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [token, unit, anchorDate, refreshKey]);

  useEffect(() => {
    if (!token) return;

    const prevDate = (() => {
      const d = new Date(anchorDate);
      d.setHours(0, 0, 0, 0);
      if (unit === "day") d.setDate(d.getDate() - 1);
      else if (unit === "week") d.setDate(d.getDate() - 7);
      else if (unit === "month") d.setMonth(d.getMonth() - 1);
      else if (unit === "year") d.setFullYear(d.getFullYear() - 1);
      return d;
    })();

    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      unit,
      date: toDateKey(prevDate),
      tzOffset: String(new Date().getTimezoneOffset()),
      limit: String(TOP_N),
    });

    fetch(`${API_BASE}/admin/top-users?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPrevRows(Array.isArray(data) ? data : []))
      .catch(() => setPrevRows([]));

    return () => ctrl.abort();
  }, [token, unit, anchorDate]);

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
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "8px 12px 3px 12px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: "#f1f5f9",
        }}
      >
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <div
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: 12,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#343434"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 4 4 6-7" />
            </svg>
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#343434",
                lineHeight: 1.1,
              }}
            >
              Top request users
            </div>
            <div
              style={{
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: error ? "#b91c1c" : "#64748b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
                title={label}
              >
                {loading ? "Loading..." : error ? "Failed to load" : label}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <TimeUnitSegmented value={unit} onChange={onPickUnit} />

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
            }}
          >
            <ThreeDotsIcon color="#111827" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes topusersShimmer {
          0% { background-position: 0% 0; }
          100% { background-position: -200% 0; }
        }
        .topusers-row {
          background: #ffffff;
          border: 1px solid rgba(226, 232, 240, 0.95);
          border-left: 4px solid #343434;
          border-radius: 14px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .topusers-row--top1 {
          border-left-color: #111827;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.10);
        }
        .topusers-rank {
          border: 1px solid rgba(15, 23, 42, 0.10);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.10);
        }
        .topusers-bar {
          height: 8px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }
        .topusers-barFill {
          height: 100%;
          background: #343434;
        }
        .topusers-delta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(148, 163, 184, 0.10);
          font-weight: 900;
        }
        .topusers-delta--up { color: #16a34a; border-color: rgba(22, 163, 74, 0.25); background: rgba(22, 163, 74, 0.10); }
        .topusers-delta--down { color: #dc2626; border-color: rgba(220, 38, 38, 0.25); background: rgba(220, 38, 38, 0.10); }
        .topusers-delta--flat { color: #64748b; }
        .topusers-rankmove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(148, 163, 184, 0.10);
          color: #64748b;
        }
        .topusers-rankmove--up { color: #16a34a; border-color: rgba(22, 163, 74, 0.25); background: rgba(22, 163, 74, 0.10); }
        .topusers-rankmove--down { color: #dc2626; border-color: rgba(220, 38, 38, 0.25); background: rgba(220, 38, 38, 0.10); }
        .topusers-stat {
          font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          color: #334155;
        }
        .topusers-skel {
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(226, 232, 240, 0.45) 0%, rgba(226, 232, 240, 0.85) 50%, rgba(226, 232, 240, 0.45) 100%);
          background-size: 200% 100%;
          animation: topusersShimmer 1100ms linear infinite;
        }
      `}</style>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#f1f5f9",
          padding: 8,
          gap: 2,
        }}
      >
        {Array.from({ length: TOP_N }).map((_, idx) => {
          const r = topRows[idx] || null;
          const key = r?.userId ? String(r.userId) : `slot_${idx}`;
          const emptyLabel = error ? "Failed to load" : loading ? "Loading..." : "No users";

          return (
            <div
              key={key}
              className={`topusers-row ${idx === 0 && r ? 'topusers-row--top1' : ''}`}
              style={{
                flex: "1 1 0",
                minHeight: 0,
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                className="topusers-rank"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background:
                    idx === 0 && r
                      ? "linear-gradient(180deg, #323232 0%, #585858 100%)"
                      : r
                        ? "#303030"
                        : "#cbd5e1",
                  color: r ? "#ffffff" : "#323232",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                {(() => {
                  const cur = r ? Number(r.requests ?? 0) : null;
                  const credits = r ? Number(r.credits ?? r.tokens ?? 0) : null;

                  return (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#515151",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            opacity: r ? 1 : 0.8,
                            minWidth: 0,
                          }}
                          title={r?.username}
                        >
                          {r ? r.username || "(unknown)" : idx === 0 ? emptyLabel : ""}
                        </div>

                        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0, opacity: r ? 1 : 0.35 }}>
                          <div className="topusers-stat" style={{ color: "#343434", display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span>{cur !== null ? `${cur} req` : "—"}</span>
                          </div>

                          <div className="topusers-stat" title={credits !== null ? `Credits ${credits}` : undefined}>
                            Credits {credits !== null ? credits : "—"}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", opacity: r ? 1 : 0.35 }}>
                        <div className="topusers-bar" style={{ flex: 1, minWidth: 0 }} aria-hidden="true">
                          <div
                            className="topusers-barFill"
                            style={{
                              width: r
                                ? `${Math.max(0, Math.min(100, Math.round((Number(r.requests ?? 0) / maxRequests) * 100)))}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
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
                  "--rdp-day-height": "30px",
                  "--rdp-day-width": "30px",
                  "--rdp-day_button-height": "28px",
                  "--rdp-day_button-width": "28px",
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
