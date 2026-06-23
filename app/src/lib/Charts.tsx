import { useEffect, useState } from 'react';

const prefersReduced = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A progress donut that draws its arc on mount. */
export function Donut({
  value,
  total,
  size = 96,
  stroke = 9,
  label,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const target = c * (1 - pct);
  const [off, setOff] = useState(prefersReduced() ? target : c);

  useEffect(() => {
    if (prefersReduced()) {
      setOff(target);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOff(target)));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="donut-wrap">
      <svg className="donut" width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="donut-label">
        <div className="pct tnum">{Math.round(pct * 100)}%</div>
        <div className="sub">{label ?? `${value} of ${total}`}</div>
      </div>
    </div>
  );
}
