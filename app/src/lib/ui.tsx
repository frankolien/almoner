import { useCallback, useState } from 'react';
import type { Logger } from './demo.js';

export interface LogLine {
  msg: string;
  kind: 'step' | 'ok' | 'err' | 'info';
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
