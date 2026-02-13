import { useEffect, useRef, useState } from "react";

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function AnimatedNumber({
  value,
  duration = 320,
  decimals = 0,
  format,
}) {
  const isNum = typeof value === "number" && Number.isFinite(value);
  const [display, setDisplay] = useState(() => (isNum ? value : value));
  const rafRef = useRef(null);
  const fromRef = useRef(isNum ? value : 0);

  useEffect(() => {
    if (!isNum) {
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const k = easeOutCubic(t);
      const cur = from + (to - from) * k;
      const rounded = decimals > 0 ? Number(cur.toFixed(decimals)) : Math.round(cur);
      setDisplay(rounded);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, isNum, duration, decimals]);

  if (!isNum) return <>{value}</>;

  const out = format ? format(display) : String(display);
  return <>{out}</>;
}
