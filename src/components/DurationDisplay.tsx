import { useEffect, useRef } from "react";

/** Displays elapsed time with 100ms refresh. */
export function DurationDisplay({
  startedAt,
  duration,
}: {
  startedAt: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (duration != null) {
      if (ref.current) ref.current.textContent = `${duration.toFixed(1)}s`;
      return;
    }

    // No duration and no valid startedAt — nothing to display (restored history)
    if (!startedAt) {
      if (ref.current) ref.current.textContent = '';
      return;
    }

    const tick = () => {
      if (ref.current) {
        const elapsed = (Date.now() - startedAt) / 1000;
        ref.current.textContent = `${elapsed.toFixed(1)}s`;
      }
    };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [startedAt, duration]);

  return (
    <span ref={ref} className="tabular-nums text-[11px] text-slate-400">
      0.0s
    </span>
  );
}
