import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Command {
  id: string;
  group: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  run: () => void;
  keywords?: string;
}

export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      // focus after paint
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase().includes(needle));
  }, [q, commands]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const groups: { group: string; items: Command[] }[] = [];
  for (const c of filtered) {
    const g = groups.find((x) => x.group === c.group);
    if (g) g.items.push(c);
    else groups.push({ group: c.group, items: [c] });
  }
  // flat index for keyboard selection
  const flat = groups.flatMap((g) => g.items);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => (s + 1) % Math.max(1, flat.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => (s - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flat[sel];
      if (cmd) {
        onClose();
        cmd.run();
      }
    }
  };

  return (
    <div className="cmdk-scrim" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search actions, pages, recipients…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="cmdk-list">
          {flat.length === 0 && <div className="cmdk-empty">No matches for “{q}”.</div>}
          {groups.map((g) => (
            <div key={g.group}>
              <div className="cmdk-group">{g.group}</div>
              {g.items.map((c) => {
                const idx = flat.indexOf(c);
                return (
                  <div
                    key={c.id}
                    className={`cmdk-item ${idx === sel ? 'sel' : ''}`}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => {
                      onClose();
                      c.run();
                    }}
                  >
                    {c.icon && <span className="ci">{c.icon}</span>}
                    <span>{c.label}</span>
                    {c.hint && <span className="hint">{c.hint}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
