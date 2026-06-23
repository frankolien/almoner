import { useCallback, useState, type ReactNode } from 'react';
import type { Logger } from './demo.js';

export interface LogLine {
  msg: string;
  kind: 'step' | 'ok' | 'err' | 'info';
}

/**
 * A "Web2 by default" reveal: copy reads in plain language up top, and the
 * cryptographic / on-chain machinery lives behind this collapsed disclosure.
 * Closed → consumer SaaS. Open → the proof it's real ZK on Stellar.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  tone = 'plain',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: 'plain' | 'bare';
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`disclosure ${tone === 'bare' ? 'bare' : ''} ${open ? 'open' : ''}`}>
      <button type="button" className="disclosure-head" onClick={() => setOpen((o) => !o)}>
        <span className="disclosure-chevron">{open ? '▾' : '▸'}</span>
        {summary}
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  );
}

/** A label/value row for the "under the hood" technical panels. */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="metarow">
      <span className="metarow-l">{label}</span>
      <span className="metarow-v">{children}</span>
    </div>
  );
}

export function useLog() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const log = useCallback<Logger>((msg, kind = 'info') => {
    setLines((prev) => [...prev, { msg, kind }]);
  }, []);
  const clear = useCallback(() => setLines([]), []);
  return { lines, log, clear };
}

export function ActivityLog({ lines }: { lines: LogLine[] }) {
  if (lines.length === 0) return null;
  const mark = { step: '▸', ok: '✓', err: '✗', info: '·' } as const;
  return (
    <div className="log">
      {lines.map((l, i) => (
        <div key={i} className={l.kind}>
          <span className={l.kind === 'step' ? 'step' : ''}>{mark[l.kind]}</span> {l.msg}
        </div>
      ))}
    </div>
  );
}

export const usdc = (base: bigint | string): string => (Number(BigInt(base)) / 1e7).toFixed(2);
