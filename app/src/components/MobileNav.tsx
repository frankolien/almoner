import { IconGrid, IconDoc, IconEye, IconLayers } from '../landing/icons.js';
import type { View } from '../App.js';

const ITEMS: { view: View; label: string; Icon: typeof IconGrid }[] = [
  { view: 'dashboard', label: 'Home', Icon: IconGrid },
  { view: 'programs', label: 'Programs', Icon: IconDoc },
  { view: 'audit', label: 'Audit', Icon: IconEye },
  { view: 'tech', label: 'System', Icon: IconLayers },
];

export default function MobileNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="mobilenav" aria-label="Primary">
      {ITEMS.map(({ view: v, label, Icon }) => (
        <button key={v} className={`mnav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
          <span className="mnav-ic">
            <Icon size={20} />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
