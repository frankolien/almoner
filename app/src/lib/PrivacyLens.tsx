import { useCallback, useRef, useState, type CSSProperties } from 'react';

/**
 * A draggable seam that scrubs between two truths about the SAME claim:
 *   left  "the world"  → redacted, unlinkable (drifting hash particles)
 *   right "the donor"  → decrypted, readable, ✓ proven
 * Dramatizes the tagline. Pointer + keyboard driven, dependency-free.
 */
export function PrivacyLens({ height = 264 }: { height?: number }) {
  const [pos, setPos] = useState(0.5);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);

  const set = useCallback((x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(1, Math.max(0, (x - r.left) / r.width)));
  }, []);

  return (
    <div
      className="lens"
      ref={box}
      style={{ height }}
      onPointerDown={(e) => {
        drag.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        set(e.clientX);
      }}
      onPointerMove={(e) => {
        if (drag.current) set(e.clientX);
      }}
      onPointerUp={() => {
        drag.current = false;
      }}
    >
      <Side variant="donor" />
      <div className="lens-clip" style={{ clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}>
        <Side variant="world" />
      </div>
      <div className="lens-seam" style={{ left: `${pos * 100}%` }}>
        <button
          className="lens-handle"
          role="slider"
          aria-label="Reveal: world vs donor"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos * 100)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 0.05));
            if (e.key === 'ArrowRight') setPos((p) => Math.min(1, p + 0.05));
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="2">
            <path d="M9 6l-4 6 4 6M15 6l4 6-4 6" />
          </svg>
        </button>
      </div>
      <span className="lens-tag lens-tag-l">Private to the world</span>
      <span className="lens-tag lens-tag-r">Provable to the donor</span>
    </div>
  );
}

function Side({ variant }: { variant: 'world' | 'donor' }) {
  const w = variant === 'world';
  return (
    <div className={`lens-side ${w ? 'is-world' : 'is-donor'}`}>
      <div className="lens-card">
        <div className="lens-avatar">{w ? <Hashglyph /> : <KeyGlyph />}</div>
        <Field label="Recipient" value={w ? '████ ██████' : 'Amara N.'} world={w} />
        <Field label="Wallet" value={w ? '0x··· redacted' : 'GA7…K9F'} world={w} />
        <Field label="Amount" value={w ? '•••••' : '100.00 USDC'} world={w} />
        <div className={`lens-stamp ${w ? '' : 'ok'}`}>{w ? 'UNLINKABLE' : '✓ PROVEN'}</div>
      </div>
      {w && <Particles />}
    </div>
  );
}

const Field = ({ label, value, world }: { label: string; value: string; world: boolean }) => (
  <div className="lens-field">
    <span className="lens-k">{label}</span>
    <span className={`lens-v ${world ? 'redacted' : ''}`}>{value}</span>
  </div>
);

const Hashglyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M10 3L8 21M16 3l-2 18M3.5 9h17M2.5 15h17" />
  </svg>
);
const KeyGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="4" />
    <path d="M11 11l9 9M17 17l2-2M14 14l2-2" />
  </svg>
);
const Particles = () => (
  <div className="lens-particles" aria-hidden>
    {Array.from({ length: 14 }).map((_, i) => (
      <span
        key={i}
        style={{ '--i': i, left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` } as CSSProperties}
      >
        {['a3', '7f', '0x', 'e1', 'b9', '4c'][i % 6]}
      </span>
    ))}
  </div>
);
