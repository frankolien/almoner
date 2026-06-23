import { useEffect, useRef, useState, type RefObject } from 'react';

// Shared, dependency-free motion primitives. Everything respects reduced-motion.

const prefersReduced = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Mount-based staggered reveal: attach the returned ref to a container; every
 * descendant with `.reveal` gets `.in` on the next frame, transitioning in with
 * a per-element delay driven by its `--i` CSS variable.
 */
export function useStagger<T extends HTMLElement>(deps: unknown[] = []): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (prefersReduced()) {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    els.forEach((e) => e.classList.remove('in'));
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => els.forEach((e) => e.classList.add('in'))),
    );
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Scroll-based one-shot reveal across the document for any `.reveal:not(.in)`. */
export function useReveal(deps: unknown[] = []): void {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.in)'));
    if (prefersReduced() || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** rAF count-up from the previous value to `to`, easeOutExpo. Snaps under reduced-motion. */
export function useCountUp(to: number, durationMs = 900): number {
  const [val, setVal] = useState<number>(prefersReduced() ? to : 0);
  const from = useRef(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (prefersReduced()) {
      setVal(to);
      from.current = to;
      return;
    }
    const start = performance.now();
    const f = from.current;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / durationMs);
      setVal(f + (to - f) * easeOutExpo(p));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      from.current = to;
    };
  }, [to, durationMs]);
  return val;
}

/** Count-up number, formatted, with tabular figures so digits don't jitter. */
export function StatNum({
  to,
  format,
  className,
}: {
  to: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const v = useCountUp(to);
  return <span className={`tnum ${className ?? ''}`}>{format ? format(v) : String(Math.round(v))}</span>;
}
