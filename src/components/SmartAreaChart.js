import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { API_BASE } from "../lib/net";
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

function formatAxisDate(d) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatAxisHourLabel(d) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampToToday(d) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() > today.getTime()) return today;
  return d;
}

function formatSelectedDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ThreeDotsIcon({ size = 18, color = "currentColor" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

function LegendOnly({ showRequests, showCredits }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 2,
        paddingBottom: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          fontSize: 12,
          color: "#6b7280",
          lineHeight: 1,
        }}
      >
        {showRequests && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#6366f1",
                display: "inline-block",
              }}
            />
            <span>Requests</span>
          </div>
        )}
        {showCredits && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#06b6d4",
                display: "inline-block",
              }}
            />
            <span>Credits</span>
          </div>
        )}
      </div>

    </div>
  );
}

// data items: { date: 'YYYY-MM-DD', requests?: number, tokens?: number }
export default function SmartAreaChart({
  label,
  data = [],
  syncId = "analytics",
  showRequests = true,
  showCredits = true,
  token,
  userId,
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const userTouchedDateRef = useRef(false);
  const calendarRef = useRef(null);
  const calendarButtonRef = useRef(null);
  const [calendarPos, setCalendarPos] = useState({ top: 0, left: 0 });
  const [xScale, setXScale] = useState("hour"); // day | hour (hour view shows a 2-hour window)
  const [hourlyData, setHourlyData] = useState([]);
  const chartWrapRef = useRef(null);
  const [hourOffsetMin, setHourOffsetMin] = useState(0);

  const HOUR_BUCKET_MIN = 120;
  const HOUR_STEP_MIN = 240; // 4 hours
  const DAY_STEP_DAYS = 4;

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

  const byDate = useMemo(() => {
    const map = new Map();
    for (const r of data || []) {
      if (!r?.date) continue;
      map.set(r.date, {
        requests: Number(r.requests ?? 0),
        credits: Number(r.tokens ?? r.credits ?? 0),
      });
    }
    return map;
  }, [data]);

  const dayKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  useEffect(() => {
    // New data context: allow auto-jump again.
    userTouchedDateRef.current = false;
  }, [userId]);

  const maxDataDayKey = useMemo(() => {
    let max = null;
    for (const r of data || []) {
      const k = r?.date;
      if (!k) continue;
      if (max === null || k > max) max = k;
    }
    return max;
  }, [data]);

  useEffect(() => {
    // If the chart looks empty (date chosen outside usage), snap to latest day with data.
    if (userTouchedDateRef.current) return;
    if (!maxDataDayKey) return;
    if (maxDataDayKey === dayKey) return;

    const d = new Date(maxDataDayKey);
    if (Number.isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  }, [maxDataDayKey, dayKey]);

  useEffect(() => {
    // Reset hour navigation when switching day/user/zoom.
    setHourOffsetMin(0);
  }, [dayKey, userId, xScale]);

  useEffect(() => {
    if (xScale !== "hour") return;
    if (!token) return;

    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      date: dayKey,
      tzOffset: String(new Date().getTimezoneOffset()),
      bucketMin: String(HOUR_BUCKET_MIN),
    });
    if (userId) qs.set("userId", userId);

    fetch(`${API_BASE}/admin/charts/tokens-hourly?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setHourlyData(Array.isArray(rows) ? rows : []))
      .catch(() => {});

    return () => ctrl.abort();
  }, [xScale, token, userId, dayKey]);

  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;

    const onWheel = (e) => {
      // zoom x-axis: day <-> hour
      if (Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      userTouchedDateRef.current = true;
      setXScale((prev) => {
        if (e.deltaY < 0) return "hour"; // zoom in
        return "day"; // zoom out
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const series = useMemo(() => {
    if (xScale === "hour") {
      const map = new Map();
      for (const r of hourlyData || []) {
        const minute = Number(r?.minute);
        if (!Number.isFinite(minute)) continue;
        map.set(minute, {
          requests: Number(r.requests ?? 0),
          credits: Number(r.tokens ?? r.credits ?? 0),
        });
      }

      const isToday = dayKey === toDateKey(new Date());
      const now = new Date();
      const nowMinute = now.getHours() * 60 + now.getMinutes();
      const bucketMin = HOUR_BUCKET_MIN;
      const currentBucket = Math.floor(nowMinute / bucketMin) * bucketMin;
      const maxBucket = 1440 - bucketMin;

      const lastDataBucket = (() => {
        let max = null;
        for (const k of map.keys()) {
          if (max === null || k > max) max = k;
        }
        return max;
      })();

      // 7 points: 5 buckets before anchor, anchor bucket, 1 future bucket
      const baseAnchorMinute = (() => {
        if (isToday) {
          // If there was no activity in the last few hours, anchor to last activity
          // so the chart doesn't look "broken" (flat zeros).
          if (
            typeof lastDataBucket === "number" &&
            currentBucket - lastDataBucket > HOUR_STEP_MIN
          ) {
            return lastDataBucket;
          }
          return currentBucket;
        }
        if (typeof lastDataBucket === "number") return lastDataBucket;
        return maxBucket;
      })();

      const maxAnchor = isToday ? currentBucket : maxBucket;
      const safeAnchor = Math.max(0, Math.min(maxAnchor, baseAnchorMinute + hourOffsetMin));

      const out = [];
      for (let i = -5; i <= 1; i++) {
        const minute = safeAnchor + i * bucketMin;
        const inRange = minute >= 0 && minute <= maxBucket;

        const clamped = Math.max(0, Math.min(maxBucket, minute));
        const hh = Math.floor(clamped / 60);
        const mm = clamped - hh * 60;

        const d = new Date(selectedDate);
        d.setHours(hh, mm, 0, 0);

        const v = inRange ? map.get(minute) || { requests: 0, credits: 0 } : { requests: 0, credits: 0 };
        const allowed = inRange && (!isToday || minute <= currentBucket);

        out.push({
          dateKey: `${dayKey}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
          dateLabel: formatAxisHourLabel(d),
          requests: allowed ? v.requests : null,
          credits: allowed ? v.credits : null,
        });
      }

      return out;
    }

    // day scale
    // Show 7 days with the selected day at the 2nd dot from the right
    // (i.e. 1 day after selected, 5 days before selected)
    const anchor = new Date(selectedDate);
    anchor.setHours(0, 0, 0, 0);

    const out = [];
    for (let i = -5; i <= 1; i++) {
      const d = addDays(anchor, i);
      const key = toDateKey(d);
      const v = byDate.get(key) || { requests: 0, credits: 0 };
      // Do not draw past the selected day (today by default)
      out.push({
        dateKey: key,
        dateLabel: formatAxisDate(d),
        requests: i <= 0 ? v.requests : null,
        credits: i <= 0 ? v.credits : null,
      });
    }
    return out;
  }, [xScale, hourlyData, dayKey, byDate, selectedDate, hourOffsetMin, HOUR_BUCKET_MIN, HOUR_STEP_MIN]);

  const centerKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);
  const dualAxis = showRequests && showCredits;

  const hourNav = useMemo(() => {
    if (xScale !== "hour") return null;
    const bucketMin = HOUR_BUCKET_MIN;
    const maxBucket = 1440 - bucketMin;

    const now = new Date();
    const nowMinute = now.getHours() * 60 + now.getMinutes();
    const currentBucket = Math.floor(nowMinute / bucketMin) * bucketMin;

    const isToday = dayKey === toDateKey(new Date());

    let last = null;
    for (const r of hourlyData || []) {
      const m = Number(r?.minute);
      if (!Number.isFinite(m)) continue;
      if (last === null || m > last) last = m;
    }

    const baseAnchor = (() => {
      if (isToday) {
        if (typeof last === "number" && currentBucket - last > HOUR_STEP_MIN) return last;
        return currentBucket;
      }
      return typeof last === "number" ? last : maxBucket;
    })();
    const maxAnchor = isToday ? currentBucket : maxBucket;
    const anchor = Math.max(0, Math.min(maxAnchor, baseAnchor + hourOffsetMin));

    return {
      isToday,
      baseAnchor,
      anchor,
      maxAnchor,
    };
  }, [xScale, HOUR_BUCKET_MIN, dayKey, hourlyData, hourOffsetMin]);

  const canMoveForwardDay = useMemo(() => {
    if (xScale !== "day") return false;
    const todayKey = toDateKey(new Date());
    return toDateKey(selectedDate) < todayKey;
  }, [xScale, selectedDate]);

  const moveWindowBack = () => {
    userTouchedDateRef.current = true;
    if (xScale === "hour") {
      setHourOffsetMin((prev) => {
        const next = prev - HOUR_STEP_MIN;
        if (!hourNav) return next;
        const clampedAnchor = Math.max(
          0,
          Math.min(hourNav.maxAnchor, hourNav.baseAnchor + next),
        );
        return clampedAnchor - hourNav.baseAnchor;
      });
      return;
    }

    const d = new Date(selectedDate);
    d.setDate(d.getDate() - DAY_STEP_DAYS);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  };

  const moveWindowForward = () => {
    userTouchedDateRef.current = true;
    if (xScale === "hour") {
      setHourOffsetMin((prev) => {
        const next = prev + HOUR_STEP_MIN;
        if (!hourNav) return next;
        const clampedAnchor = Math.max(
          0,
          Math.min(hourNav.maxAnchor, hourNav.baseAnchor + next),
        );
        return clampedAnchor - hourNav.baseAnchor;
      });
      return;
    }

    const d = new Date(selectedDate);
    d.setDate(d.getDate() + DAY_STEP_DAYS);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(clampToToday(d));
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        padding: "0 5px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          paddingTop: 6,
          paddingBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280", paddingTop: 4, minWidth: 110 }}>
          {label}
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <LegendOnly showRequests={showRequests} showCredits={showCredits} />
        </div>

        {(xScale === "hour" || xScale === "day") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              aria-label="Previous"
              title={xScale === "hour" ? "Back 4 hours" : "Back 4 days"}
              disabled={xScale === "hour" ? !hourNav || hourNav.anchor <= 0 : false}
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
                opacity: !hourNav || hourNav.anchor <= 0 ? 0.45 : 1,
                transition: "background 160ms ease, border-color 160ms ease, opacity 160ms ease",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#e5e7eb";
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
              title={xScale === "hour" ? "Forward 4 hours" : "Forward 4 days"}
              disabled={xScale === "hour" ? !hourNav || hourNav.anchor >= hourNav.maxAnchor : !canMoveForwardDay}
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
                opacity: !hourNav || hourNav.anchor >= (hourNav?.maxAnchor ?? 0) ? 0.45 : 1,
                transition: "background 160ms ease, border-color 160ms ease, opacity 160ms ease",
              }}
              onMouseEnter={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.borderColor = "#d1d5db";
              }}
              onMouseLeave={(e) => {
                if (e.currentTarget.disabled) return;
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#e5e7eb";
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
          </div>
        )}

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
          title="Pick date"
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
                padding: 8,
                fontSize: 12,
                fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
                maxHeight: `calc(100vh - ${calendarPos.top}px - 12px)`,
                overflow: "auto",
              }}
            >
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (!d) return;
                  const n = new Date(d);
                  n.setHours(0, 0, 0, 0);
                  userTouchedDateRef.current = true;
                  setSelectedDate(n);
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
      </div>

      <div
        ref={chartWrapRef}
        style={{
          width: "100%",
          flex: 1,
          minHeight: 0,
          position: "relative",
          overscrollBehavior: "contain",
        }}
        title="Scroll to zoom (day/hour)"
      >
        <ResponsiveContainer>
          <AreaChart
            data={series}
            syncId={syncId}
            margin={{ top: 6, right: 10, left: 5, bottom: 6 }}
          >
            <defs>
              {showRequests && (
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              )}
              {showCredits && (
                <linearGradient id="credGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                </linearGradient>
              )}
            </defs>

            <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              minTickGap={xScale === "hour" ? 28 : 8}
              height={24}
              tickMargin={2}
            />
            {dualAxis ? (
              <>
                <YAxis yAxisId="req" hide padding={{ top: 8, bottom: 2 }} />
                <YAxis yAxisId="cred" hide orientation="right" padding={{ top: 8, bottom: 2 }} />
              </>
            ) : (
              <YAxis yAxisId="main" hide padding={{ top: 8, bottom: 2 }} />
            )}

            <ReferenceLine
              x={
                xScale === "hour"
                  ? series?.[Math.max(0, (series?.length || 0) - 2)]?.dateLabel
                  : formatAxisDate(selectedDate)
              }
              stroke="#111827"
              strokeDasharray="3 3"
            />

            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                borderRadius: 8,
                border: "none",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              }}
            />

            {showRequests && (
              <Area
                type="monotone"
                dataKey="requests"
                name="Requests"
                stroke="#6366f1"
                strokeWidth={3}
                fill="url(#reqGrad)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                yAxisId={dualAxis ? "req" : "main"}
              />
            )}
            {showCredits && (
              <Area
                type="monotone"
                dataKey="credits"
                name="Credits"
                stroke="#06b6d4"
                strokeWidth={3}
                fill="url(#credGrad)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                yAxisId={dualAxis ? "cred" : "main"}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
