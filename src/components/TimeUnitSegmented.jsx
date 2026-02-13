import { useCallback, useLayoutEffect, useRef, useState } from "react";

export default function TimeUnitSegmented({
  value,
  onChange,
  padTop = 8,
  padBottom = 3,
  options = [
    { k: "day", label: "Day" },
    { k: "week", label: "Week" },
    { k: "month", label: "Month" },
    { k: "year", label: "Year" },
  ],
}) {
  const wrapRef = useRef(null);
  const btnRefs = useRef(new Map());
  const [underline, setUnderline] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const el = btnRefs.current.get(value);
    if (!el) return null;
    const wrapRect = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const left = Math.round(r.left - wrapRect.left);
    const width = Math.max(8, Math.round(r.width));
    return { left, width };
  }, [value]);

  useLayoutEffect(() => {
    const m = measure();
    if (!m) return;
    setUnderline((prev) => {
      if (prev.left === m.left && prev.width === m.width && prev.ready) return prev;
      return { left: m.left, width: m.width, ready: true };
    });
  }, [value, measure]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const update = () => {
      const m = measure();
      if (!m) return;
      setUnderline((prev) => {
        if (prev.left === m.left && prev.width === m.width && prev.ready) return prev;
        return { ...prev, left: m.left, width: m.width, ready: true };
      });
    };

    let ro;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(update);
      ro.observe(wrap);
    } else {
      window.addEventListener("resize", update);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", update);
    };
    // run once in case refs were late
    update();
  }, [value, measure]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "inline-flex",
        gap: 14,
        padding: 0,
        background: "transparent",
        border: "none",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: "#e5e7eb",
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          height: 2,
          background: "#111827",
          width: underline.width,
          transform: `translateX(${underline.left}px)`,
          transition: underline.ready
            ? "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), width 180ms cubic-bezier(0.2, 0.8, 0.2, 1)"
            : "none",
        }}
      />

      {options.map((b) => {
        const active = value === b.k;
        return (
          <button
            key={b.k}
            type="button"
            onClick={() => onChange(b.k)}
            ref={(node) => {
              if (!node) {
                btnRefs.current.delete(b.k);
                return;
              }
              btnRefs.current.set(b.k, node);
            }}
            style={{
              padding: `${padTop}px 2px ${padBottom}px`,
              borderRadius: 0,
              border: "none",
              borderBottom: "2px solid transparent",
              background: "transparent",
              color: "#111827",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              transition: "opacity 160ms ease, transform 160ms ease",
              opacity: active ? 1 : 0.6,
              transform: active ? "translateY(-1px)" : "translateY(0)",
            }}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
