import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './docs.css';
import { Logo, IconArrow, IconCopy, IconCheck, IconSearch } from '../landing/icons.js';
import { SECTIONS, GROUPS, GITHUB_URL } from './content.js';

const LAST_UPDATED = 'June 2026';

interface Heading {
  id: string;
  text: string;
}

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

  const bodyRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState('');
  const [copied, setCopied] = useState(false);
  const [helpful, setHelpful] = useState<null | boolean>(null);
  const [query, setQuery] = useState('');

  const go = (s: string) => {
    window.location.hash = `docs/${s}`;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setCopied(false);
    setHelpful(null);
  }, [slug]);

  // Build the "On this page" rail from the rendered headings, assigning ids.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const seen = new Set<string>();
    const found: Heading[] = Array.from(root.querySelectorAll('h3')).map((h) => {
      const text = h.textContent ?? '';
      let id = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '') || 'section';
      while (seen.has(id)) id += '-x';
      seen.add(id);
      h.id = id;
      return { id, text };
    });
    setHeadings(found);
    setActiveId(found[0]?.id ?? 'top');
  }, [slug]);

  // Scroll-spy — the active heading is the last one whose top has passed under
  // the header. Position-based (not IntersectionObserver) so it stays correct
  // when you jump via the rail or scroll past every heading.
  useEffect(() => {
    if (!headings.length) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = headings[0].id;
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= 96) current = h.id;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [headings]);

  const onPage: Heading[] = headings.length ? headings : [{ id: 'top', text: 'Overview' }];

  const goHeading = (id: string) => {
    const el = id === 'top' ? bodyRef.current : document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  const copyPage = () => {
    const md = `# ${section.title}\n\n${section.lede ?? ''}\n\n${bodyRef.current?.innerText ?? ''}`.trim();
    navigator.clipboard?.writeText(md);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const nav = useMemo(
    () =>
      GROUPS.map((g) => ({
        group: g,
        items: SECTIONS.filter((s) => s.group === g),
      })),
    [],
  );
  const q = query.trim().toLowerCase();
  const filtered = q
    ? nav.map((n) => ({ ...n, items: n.items.filter((s) => s.title.toLowerCase().includes(q)) })).filter((n) => n.items.length)
    : nav;

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
          <div className="doc-search">
            <IconSearch size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs"
              spellCheck={false}
            />
            <span className="doc-search-k">⌘K</span>
          </div>
          {filtered.map(({ group, items }) => (
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
          {!filtered.length && <div className="doc-side-empty">No matches</div>}
        </aside>

        <main className="doc-main">
          <article className="doc-article">
            <div className="doc-eyebrow">{section.group}</div>
            <div className="doc-title-row">
              <h1>{section.title}</h1>
              <button className="doc-copy" onClick={copyPage} aria-label="Copy page as Markdown">
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                {copied ? 'Copied' : 'Copy page'}
              </button>
            </div>
            {section.lede && <p className="doc-lede">{section.lede}</p>}
            <div className="doc-body" ref={bodyRef}>{section.body()}</div>

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

            <footer className="doc-foot">
              <div className="doc-helpful">
                {helpful === null ? (
                  <>
                    <span>Was this helpful?</span>
                    <button onClick={() => setHelpful(true)} aria-label="Yes">👍</button>
                    <button onClick={() => setHelpful(false)} aria-label="No">👎</button>
                  </>
                ) : (
                  <span className="doc-helpful-thanks">Thanks for the feedback.</span>
                )}
              </div>
              <div className="doc-updated">Last updated {LAST_UPDATED}</div>
            </footer>
          </article>
        </main>

        <aside className="doc-toc">
          <div className="doc-toc-h">On this page</div>
          <nav>
            {onPage.map((h) => (
              <button
                key={h.id}
                className={`doc-toc-item ${activeId === h.id ? 'active' : ''}`}
                onClick={() => goHeading(h.id)}
              >
                {h.text}
              </button>
            ))}
          </nav>
        </aside>
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
