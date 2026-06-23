import { useLayoutEffect, useRef } from 'react';
import { Logo, IconGrid, IconDoc, IconEye, IconLayers, IconHome } from '../landing/icons.js';
import type { View } from '../App.js';

type IconCmp = typeof IconGrid;

interface NavDef {
  view: View;
  label: string;
  Icon: IconCmp;
  section: string;
}

const NAV: NavDef[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: IconGrid, section: 'Overview' },
  { view: 'programs', label: 'Programs', Icon: IconDoc, section: 'Disbursement' },
  { view: 'audit', label: 'Donor audit', Icon: IconEye, section: 'Disbursement' },
  { view: 'tech', label: 'Under the hood', Icon: IconLayers, section: 'System' },
];

export default function Sidebar({
  view,
  setView,
  goLanding,
  badge,
  poolId,
  onProfile,
}: {
  view: View;
  setView: (v: View) => void;
  goLanding: () => void;
  badge: number | null;
  poolId: string | null;
  onProfile: () => void;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('.navitem.active');
    const pill = pillRef.current;
    if (!el || !pill) return;
    const top = el.offsetTop;
    const h = el.offsetHeight;
    const prev = last.current;
    pill.style.height = `${h}px`;
    pill.style.transform = `translateY(${top}px)`;
    if (prev !== null && prev !== top && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pill.animate(
        [{ transform: `translateY(${prev}px)` }, { transform: `translateY(${top}px)` }],
        { duration: 280, easing: 'cubic-bezier(.34,1.56,.64,1)' },
      );
    }
    last.current = top;
  }, [view]);

  // group consecutive items by section, preserving order
  const groups: { section: string; items: NavDef[] }[] = [];
  for (const item of NAV) {
    const g = groups[groups.length - 1];
    if (g && g.section === item.section) g.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" onClick={goLanding} title="Back to home">
        <span style={{ display: 'grid', placeItems: 'center' }}>
          <Logo size={26} />
        </span>
        <div className="brand">
          Almoner<span className="dot">.</span>
        </div>
      </div>

      <div className="sidebar-nav" ref={navRef}>
        <div className="nav-pill" ref={pillRef} aria-hidden />
        {groups.map((g) => (
          <div key={g.section}>
            <div className="sidebar-eyebrow">{g.section}</div>
            {g.items.map(({ view: v, label, Icon }) => (
              <button key={v} className={`navitem ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
                <span className="navitem-ic">
                  <Icon size={19} />
                </span>
                <span>{label}</span>
                {v === 'programs' && badge != null && <span className="navitem-badge">{badge}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="sidecard">
          <div className="t">Private to the world</div>
          <div className="s">Provable to the donor. Identity-private aid, auditable by funders.</div>
        </div>
        <button className="navitem" onClick={goLanding} style={{ paddingLeft: 12 }}>
          <span className="navitem-ic">
            <IconHome size={19} />
          </span>
          <span>Back to home</span>
        </button>
        <button className="userrow" onClick={onProfile} title="Organization profile">
          <div className="av">
            <Logo size={16} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="who">Aid organization</div>
            <div className="sub2">{poolId ? `${poolId.slice(0, 4)}…${poolId.slice(-4)}` : 'testnet'}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}
