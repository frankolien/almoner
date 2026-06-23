import { useEffect, useState, type CSSProperties } from 'react';

const COLORS = ['#ff6240', '#4fd1c5', '#6ea8fe', '#45c98a', '#8b7cf6', '#e0b341'];

/** One-shot celebratory confetti burst (auto-removes; respects reduced-motion). */
export default function Confetti({ count = 84 }: { count?: number }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(false), 2800);
    return () => window.clearTimeout(t);
  }, []);
  if (!on) return null;
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <i
          key={i}
          style={
            {
              left: `${(i * 53) % 100}%`,
              background: COLORS[i % COLORS.length],
              '--d': `${1800 + (i % 7) * 230}ms`,
              animationDelay: `${(i % 12) * 55}ms`,
              opacity: 0.9,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
