import { Logo, IconSearch } from '../landing/icons.js';

export default function Topbar({
  title,
  live,
  onHome,
  onNewSession,
  onOpenCmdk,
}: {
  title: string;
  live: boolean;
  onHome: () => void;
  onNewSession: () => void;
  onOpenCmdk: () => void;
}) {
  return (
    <header className="topbar">
      <div className="crumbs">
        <button className="crumb-root" onClick={onHome}>
          <Logo size={17} />
          <span className="crumb-label">Almoner</span>
        </button>
        <span className="crumb-sep">/</span>
        <span className="crumb-leaf" key={title}>
          {title}
        </span>
      </div>
      <div className="topbar-actions">
        <button className="iconbtn" onClick={onOpenCmdk} title="Search & commands (⌘K)" aria-label="Open command palette">
          <IconSearch size={16} />
        </button>
        <span className={`statuspill ${live ? '' : 'off'}`}>
          <span className="d" />
          {live ? 'Live · testnet' : 'Connecting…'}
        </span>
        <button className="ghost" style={{ padding: '7px 13px' }} onClick={onNewSession} title="Start a fresh program in this browser. On-chain history is untouched.">
          New session
        </button>
      </div>
    </header>
  );
}
