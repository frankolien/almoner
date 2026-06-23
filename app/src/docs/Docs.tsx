import { useEffect, useMemo, type ReactNode } from 'react';
import './docs.css';
import { Logo, IconArrow } from '../landing/icons.js';
import { SECTIONS, GROUPS, GITHUB_URL } from './content.js';

export default function Docs({
  route,
  onHome,
  onLaunch,
}: {
  route: string;
  onHome: () => void;
  onLaunch: () => void;
}) {
  const slug = route.startsWith('#docs/') ? route.slice('#docs/'.length) : SECTIONS[0].slug;
  const idx = Math.max(0, SECTIONS.findIndex((s) => s.slug === slug));
  const section = SECTIONS[idx];
  const prev = idx > 0 ? SECTIONS[idx - 1] : null;
  const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null;

  const go = (s: string) => {
    window.location.hash = `docs/${s}`;
  };

  useEffect(() => {
    const el = document.querySelector('.doc-main');
    if (el) el.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [slug]);

  const nav = useMemo(
    () =>
      GROUPS.map((g) => ({
        group: g,
        items: SECTIONS.filter((s) => s.group === g),
      })),
    [],
  );

  return (
    <div className="docs">
      <header className="doc-top">
        <button className="doc-brand" onClick={onHome}>
          <Logo size={22} />
          <span>Almoner<span className="dot">.</span></span>
          <span className="doc-top-sep">/</span>
          <span className="doc-top-docs">Docs</span>
        </button>
        <div className="doc-top-actions">
          <a className="doc-toplink" href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub ↗</a>
          <button className="doc-launch" onClick={onLaunch}>
            Launch app <IconArrow size={14} />
          </button>
        </div>
      </header>

      <div className="doc-shell">
        <aside className="doc-side">
          {nav.map(({ group, items }) => (
            <div className="doc-side-group" key={group}>
              <div className="doc-side-h">{group}</div>
              {items.map((s) => (
                <button
                  key={s.slug}
                  className={`doc-side-item ${s.slug === slug ? 'active' : ''}`}
                  onClick={() => go(s.slug)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="doc-main">
          <article className="doc-article">
            <div className="doc-eyebrow">{section.group}</div>
            <h1>{section.title}</h1>
            {section.lede && <p className="doc-lede">{section.lede}</p>}
            <div className="doc-body">{section.body()}</div>

            <nav className="doc-pager">
              {prev ? (
                <button className="doc-pager-btn" onClick={() => go(prev.slug)}>
                  <span className="l">← Previous</span>
                  <span className="t">{prev.title}</span>
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button className="doc-pager-btn right" onClick={() => go(next.slug)}>
                  <span className="l">Next →</span>
                  <span className="t">{next.title}</span>
                </button>
              )}
            </nav>
          </article>
        </main>
      </div>
    </div>
  );
}

// ── shared doc building blocks (used by content.tsx) ────────────────────────
export function Note({ kind = 'note', title, children }: { kind?: 'note' | 'tip' | 'key' | 'warn'; title?: string; children: ReactNode }) {
  const label = title ?? { note: 'Note', tip: 'Tip', key: 'Key idea', warn: 'Heads up' }[kind];
  return (
    <div className={`doc-note ${kind}`}>
      <div className="doc-note-h">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <pre className="doc-code" data-lang={lang}>
      <code>{children}</code>
    </pre>
  );
}

export function Eq({ children }: { children: ReactNode }) {
  return <div className="doc-eq">{children}</div>;
}

export function Steps({ items }: { items: [string, ReactNode][] }) {
  return (
    <ol className="doc-steps">
      {items.map(([t, d], i) => (
        <li key={i}>
          <span className="doc-step-n">{i + 1}</span>
          <div>
            <b>{t}</b>
            <div className="doc-step-d">{d}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
