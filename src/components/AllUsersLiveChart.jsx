import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function floorTo(ms, bucketMs) {
  return Math.floor(ms / bucketMs) * bucketMs;
}

function formatTimeLabel(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { minute: "2-digit", second: "2-digit" });
}

function formatDayLabel(ymd) {
  const d = new Date(ymd);
  if (Number.isNaN(d.getTime())) return String(ymd);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function addDays(d, days) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function toDateKey(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampToToday(d) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  if (d.getTime() > t.getTime()) return t;
  return d;
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

export default function AllUsersLiveChart({ token, usageEvent, refreshKey }) {
  const BUCKET_MS = 5000;
  const POINTS = 20;
  const DAY_POINTS = 20;
  const DAY_FETCH = DAY_POINTS - 1; // leave 1 future slot so "current" sits 2nd from right
  const MAX_RT_POINTS = 12 * 60; // 60 minutes @ 5s buckets
  const STEP_BUCKETS = 4; // 20 seconds

  const [xScale, setXScale] = useState("5s"); // 5s | day
  const [rtHistory, setRtHistory] = useState(() => {
    const now = Date.now();
    const anchor = floorTo(now, BUCKET_MS);
    const out = [];
    for (let i = MAX_RT_POINTS - 1; i >= 0; i--) {
      const t = anchor - i * BUCKET_MS;
      out.push({
        x: t,
        xLabel: formatTimeLabel(t),
        requests: 0,
        credits: 0,
      });
    }
    return out;
  });

  const [followLive, setFollowLive] = useState(true);
  const [rtWindowEnd, setRtWindowEnd] = useState(null); // ms

  const [daySeries, setDaySeries] = useState([]);
  const wrapRef = useRef(null);

  const [dayEndDate, setDayEndDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const calendarButtonRef = useRef(null);
  const [calendarPos, setCalendarPos] = useState({ top: 0, right: 0 });

  const tickRef = useRef(null);

  const scheduleTick = () => {
    if (tickRef.current) clearTimeout(tickRef.current);
    const now = Date.now();
    const next = floorTo(now, BUCKET_MS) + BUCKET_MS;
    const delay = Math.max(50, next - now + 10);
    tickRef.current = setTimeout(() => {
      setRtHistory((prev) => {
        const last = prev[prev.length - 1];
        const lastT = Number(last?.x || 0);
        const anchor = floorTo(Date.now(), BUCKET_MS);
        if (anchor <= lastT) return prev;
        const nextPoint = {
          x: anchor,
          xLabel: formatTimeLabel(anchor),
          requests: 0,
          credits: 0,
        };
        const nextArr = prev.concat(nextPoint).slice(-MAX_RT_POINTS);
        return nextArr;
      });

      scheduleTick();
    }, delay);
  };

  useEffect(() => {
    scheduleTick();
    return () => {
      if (tickRef.current) clearTimeout(tickRef.current);
      tickRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      setXScale((prev) => {
        if (e.deltaY < 0) return "5s";
        return "day";
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (xScale !== "day") return;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setDayEndDate(d);
  }, [xScale]);

  useEffect(() => {
    if (xScale !== "5s") return;
    setFollowLive(true);
    setRtWindowEnd(null);
  }, [xScale]);

  useEffect(() => {
    if (!usageEvent) return;
    if (String(usageEvent.type || "").toUpperCase() !== "USAGE") return;

    const atMs = (() => {
      const raw = usageEvent.at;
      if (!raw) return Date.now();
      const d = new Date(raw);
      const t = d.getTime();
      return Number.isFinite(t) ? t : Date.now();
    })();
    const bucket = floorTo(atMs, BUCKET_MS);
    const stage = String(usageEvent.stage || "").toLowerCase();
    if (stage !== "complete") return;

    const tokens = Number(usageEvent.tokensUsed ?? 0);
    const addReq = 1;
    const addCred = tokens;

    setRtHistory((prev) =>
      prev.map((p) =>
        Number(p.x) === bucket
          ? {
              ...p,
              requests: Number(p.requests ?? 0) + addReq,
              credits: Number(p.credits ?? 0) + addCred,
            }
          : p,
      ),
    );
  }, [usageEvent]);

  useEffect(() => {
    if (xScale !== "day") return;
    if (!token) return;

    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      days: String(DAY_FETCH),
      tzOffset: String(new Date().getTimezoneOffset()),
      end: toDateKey(dayEndDate),
    });

    fetch(`http://localhost:5000/api/admin/charts/tokens-daily?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const arr = Array.isArray(rows) ? rows : [];
        const byDay = new Map(
          arr
            .filter((r) => r && r.date)
            .map((r) => [
              String(r.date),
              {
                requests: Number(r.requests ?? 0),
                credits: Number(r.tokens ?? 0),
              },
            ]),
        );

        // Fill missing days so day navigation always visibly shifts.
        const end = new Date(dayEndDate);
        end.setHours(0, 0, 0, 0);
        // Show a 1-day future pad so the "current" day is the 2nd dot from the right.
        const start = addDays(end, -(DAY_POINTS - 2));

        const out = [];
        for (let i = 0; i < DAY_POINTS; i++) {
          const d = addDays(start, i);
          const key = toDateKey(d);
          const v = byDay.get(key) || { requests: 0, credits: 0 };
          out.push({
            x: key,
            xLabel: formatDayLabel(key),
            requests: i === DAY_POINTS - 1 ? null : v.requests,
            credits: i === DAY_POINTS - 1 ? null : v.credits,
          });
        }

        setDaySeries(out);
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [xScale, token, refreshKey, dayEndDate]);

  useEffect(() => {
    if (!calendarOpen) return;

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
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [calendarOpen]);

  const rtWindowSeries = useMemo(() => {
    const latest = rtHistory?.[rtHistory.length - 1]?.x;
    const end = followLive ? latest : rtWindowEnd ?? latest;
    if (!end) return [];

    // Keep "current" on the 2nd dot from the right by adding one future bucket.
    const displayEnd = Number(end) + BUCKET_MS;

    const byX = new Map(rtHistory.map((p) => [Number(p.x), p]));
    const out = [];
    for (let i = POINTS - 1; i >= 0; i--) {
      const x = Number(displayEnd) - i * BUCKET_MS;
      const p = byX.get(x);
      out.push(
        p
          ? p
          : {
              x,
              xLabel: formatTimeLabel(x),
              requests: x === displayEnd ? null : 0,
              credits: x === displayEnd ? null : 0,
            },
      );
    }
    return out;
  }, [rtHistory, followLive, rtWindowEnd]);

  const series = useMemo(() => (xScale === "day" ? daySeries : rtWindowSeries), [xScale, daySeries, rtWindowSeries]);

  const [reqDomain, credDomain] = useMemo(() => {
    const calc = (key) => {
      let min = Infinity;
      let max = -Infinity;
      for (const p of series || []) {
        const v = Number(p?.[key]);
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];

      // Use a padded min/max so the chart always breathes and the scale follows
      // the current window (instead of being locked to 0).
      if (min === max) {
        const pad = max === 0 ? 1 : Math.max(1, Math.ceil(max * 0.15));
        return [Math.max(0, min - pad), max + pad];
      }
      const range = max - min;
      const pad = Math.max(1, Math.ceil(range * 0.15));
      return [Math.max(0, min - pad), max + pad];
    };

    return [calc("requests"), calc("credits")];
  }, [series]);

  const currentMarkerXLabel = useMemo(() => {
    const n = series?.length || 0;
    if (!n) return null;
    // By design we keep a 1-point future pad, so "current" is 2nd from right.
    const idx = n >= 2 ? n - 2 : n - 1;
    return series?.[idx]?.xLabel || null;
  }, [series]);

  const headerLabel = useMemo(() => {
    if (xScale === "day") {
      const first = series?.[0]?.x;
      const last = series?.[Math.max(0, (series?.length || 1) - 2)]?.x;
      if (!first || !last) return "";
      const a = formatDayLabel(first);
      const b = formatDayLabel(last);
      return `${a} - ${b}`;
    }
    const first = series?.[0]?.x;
    const last = series?.[Math.max(0, (series?.length || 1) - 2)]?.x;
    if (!first || !last) return "Live";
    return `${formatTimeLabel(Number(first))} - ${formatTimeLabel(Number(last))}${followLive ? "" : ""}`;
  }, [xScale, series]);

  const latestRtBucket = useMemo(() => rtHistory?.[rtHistory.length - 1]?.x || null, [rtHistory]);
  const earliestRtBucket = useMemo(() => rtHistory?.[0]?.x || null, [rtHistory]);
  const rtEffectiveEnd = useMemo(() => {
    if (!latestRtBucket) return null;
    return followLive ? latestRtBucket : rtWindowEnd ?? latestRtBucket;
  }, [latestRtBucket, followLive, rtWindowEnd]);

  const canPrev5s = useMemo(() => {
    if (!rtEffectiveEnd || !earliestRtBucket) return false;
    const earliestEndAllowed = Number(earliestRtBucket) + (POINTS - 1) * BUCKET_MS;
    return Number(rtEffectiveEnd) > earliestEndAllowed;
  }, [rtEffectiveEnd, earliestRtBucket]);

  const canNext5s = useMemo(() => {
    if (!latestRtBucket) return false;
    if (followLive) return false;
    return Number(rtEffectiveEnd || 0) < Number(latestRtBucket);
  }, [followLive, rtEffectiveEnd, latestRtBucket]);

  const moveWindowBack = () => {
    if (xScale === "day") {
      setDayEndDate((d) => {
        const n = new Date(d);
        n.setDate(n.getDate() - 4);
        n.setHours(0, 0, 0, 0);
        return n;
      });
      return;
    }

    if (!latestRtBucket) return;
    setFollowLive(false);
    setRtWindowEnd((cur) => {
      const base = cur == null ? latestRtBucket : cur;
      const next = Number(base) - STEP_BUCKETS * BUCKET_MS;
      return floorTo(next, BUCKET_MS);
    });
  };

  const moveWindowForward = () => {
    if (xScale === "day") {
      setDayEndDate((d) => {
        const n = new Date(d);
        n.setDate(n.getDate() + 4);
        n.setHours(0, 0, 0, 0);
        return clampToToday(n);
      });
      return;
    }

    if (!latestRtBucket) return;
    setRtWindowEnd((cur) => {
      const base = cur == null ? latestRtBucket : cur;
      const next = floorTo(Number(base) + STEP_BUCKETS * BUCKET_MS, BUCKET_MS);
      if (next >= Number(latestRtBucket)) {
        setFollowLive(true);
        return null;
      }
      return next;
    });
  };

  const canMoveForwardDay = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return dayEndDate.getTime() < t.getTime();
  }, [dayEndDate]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        borderRadius: 16,
        border: "none",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "6px 6px 2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#111827",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={headerLabel}
        >
          {headerLabel}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Previous"
            title={xScale === "day" ? "Back 4 days" : "Back 20 seconds"}
            disabled={xScale === "day" ? false : !canPrev5s}
            onClick={moveWindowBack}
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: xScale === "day" ? 1 : canPrev5s ? 1 : 0.45,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Next"
            title={xScale === "day" ? "Forward 4 days" : "Forward 20 seconds"}
            disabled={xScale === "day" ? !canMoveForwardDay : !canNext5s}
            onClick={moveWindowForward}
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              opacity: xScale === "day" ? (canMoveForwardDay ? 1 : 0.45) : canNext5s ? 1 : 0.45,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <button
            ref={calendarButtonRef}
            type="button"
            aria-label="Open calendar"
            title="Pick date"
            onClick={() => {
              const next = !calendarOpen;
              if (next) {
                const rect = calendarButtonRef.current?.getBoundingClientRect();
                if (rect) {
                  setCalendarPos({
                    top: Math.round(rect.bottom + 8),
                    right: Math.max(8, Math.round(window.innerWidth - rect.right)),
                  });
                }
              }
              setCalendarOpen(next);
            }}
            style={{
              padding: "5px 6px",
              borderRadius: 10,
              border: "none",
              background: "transparent",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ThreeDotsIcon />
          </button>
        </div>
      </div>

      {calendarOpen &&
        createPortal(
          <div
            ref={calendarRef}
            style={{
              position: "fixed",
              top: calendarPos.top,
              right: calendarPos.right,
              zIndex: 10000,
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              padding: 8,
              fontSize: 12,
              fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
              maxHeight: `calc(100vh - ${calendarPos.top}px - 12px)`,
              overflow: "auto",
            }}
          >
            <DayPicker
              mode="single"
              selected={dayEndDate}
              onSelect={(d) => {
                if (!d) return;
                const n = new Date(d);
                n.setHours(0, 0, 0, 0);
                setXScale("day");
                setDayEndDate(clampToToday(n));
                setCalendarOpen(false);
              }}
              captionLayout="dropdown"
              fromYear={2020}
              toYear={2035}
              showOutsideDays
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
          </div>,
          document.body,
        )}

      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, padding: 8 }} title="Scroll to zoom (5s/day)">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 10, left: 0, bottom: 6 }}>
            <defs>
              <linearGradient id="allReqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="allCredGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="xLabel"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              minTickGap={xScale === "day" ? 8 : 12}
              height={22}
            />

            <YAxis yAxisId="req" hide domain={reqDomain} />
            <YAxis yAxisId="cred" hide orientation="right" domain={credDomain} />

            {currentMarkerXLabel && (
              <ReferenceLine x={currentMarkerXLabel} stroke="#111827" strokeDasharray="3 3" />
            )}

            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                borderRadius: 10,
                border: "none",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              }}
            />

            <Area
              type="monotone"
              dataKey="requests"
              name="Requests"
              stroke="#6366f1"
              strokeWidth={3}
              fill="url(#allReqGrad)"
              isAnimationActive={false}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4.5 }}
              yAxisId="req"
            />
            <Area
              type="monotone"
              dataKey="credits"
              name="Credits"
              stroke="#06b6d4"
              strokeWidth={3}
              fill="url(#allCredGrad)"
              isAnimationActive={false}
              dot={{ r: 2.5 }}
              activeDot={{ r: 4.5 }}
              yAxisId="cred"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
