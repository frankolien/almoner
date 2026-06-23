import { useEffect, useMemo, useState } from 'react';
import { useDemoStore } from './lib/store.js';
import { loadDeployment, type Deployment, explorerContract } from './lib/config.js';
import Landing from './landing/Landing.js';
import { IconGrid, IconDoc, IconEye, IconLayers, IconHome, IconCopy } from './landing/icons.js';
import OrgAdmin from './surfaces/OrgAdmin.js';
import Auditor from './surfaces/Auditor.js';
import Claim from './surfaces/Claim.js';
import Dashboard from './surfaces/Dashboard.js';
import Sidebar from './components/Sidebar.js';
import Topbar from './components/Topbar.js';
import MobileNav from './components/MobileNav.js';
import CommandPalette, { type Command } from './components/CommandPalette.js';
import Peek, { type PeekKind } from './components/Peek.js';
import Docs from './docs/Docs.js';
import { Meta } from './lib/ui.js';

export type View = 'dashboard' | 'programs' | 'audit' | 'tech';

const VIEW_BY_HASH: Record<string, View> = {
  '#app': 'dashboard',
  '#dashboard': 'dashboard',
  '#programs': 'programs',
  '#org': 'programs',
  '#audit': 'audit',
  '#tech': 'tech',
};

const HASH_BY_VIEW: Record<View, string> = {
  dashboard: 'app',
  programs: 'programs',
  audit: 'audit',
  tech: 'tech',
};

const TITLE: Record<View, string> = {
  dashboard: 'Dashboard',
  programs: 'Programs',
  audit: 'Donor audit',
  tech: 'Under the hood',
};

export default function App() {
  const store = useDemoStore();
  const [route, setRoute] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [peek, setPeek] = useState<PeekKind | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    loadDeployment().then((d) => {
      setDeployment(d);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setPeek(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const inApp = route in VIEW_BY_HASH;
  const view: View = VIEW_BY_HASH[route] ?? 'dashboard';

  const goLanding = () => {
    window.location.hash = '';
    window.scrollTo(0, 0);
    setRoute('');
  };
  const setView = (v: View) => {
    window.location.hash = HASH_BY_VIEW[v];
    window.scrollTo(0, 0);
    setRoute(window.location.hash);
    setPeek(null);
  };

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [
      { id: 'go-dash', group: 'Go to', label: 'Dashboard', icon: <IconGrid size={16} />, hint: 'Overview', run: () => setView('dashboard') },
      { id: 'go-prog', group: 'Go to', label: 'Programs', icon: <IconDoc size={16} />, run: () => setView('programs') },
      { id: 'go-audit', group: 'Go to', label: 'Donor audit', icon: <IconEye size={16} />, run: () => setView('audit') },
      { id: 'go-tech', group: 'Go to', label: 'Under the hood', icon: <IconLayers size={16} />, run: () => setView('tech') },
      { id: 'act-home', group: 'Actions', label: 'Back to home', icon: <IconHome size={16} />, run: goLanding },
      { id: 'act-reset', group: 'Actions', label: 'New session', hint: 'Reset', run: store.reset, keywords: 'reset clear' },
    ];
    if (deployment) {
      list.push({
        id: 'act-copy-pool',
        group: 'Actions',
        label: 'Copy pool contract ID',
        icon: <IconCopy size={16} />,
        run: () => navigator.clipboard?.writeText(deployment.poolContractId),
        keywords: 'contract address',
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment]);

  // ---- beneficiary claim app (standalone, credential-driven) ----
  if (route.startsWith('#claim=')) {
    return <Claim credentialStr={route.slice('#claim='.length)} deployment={deployment} />;
  }

  if (route.startsWith('#docs')) {
    return <Docs route={route} onHome={goLanding} onLaunch={() => setView('dashboard')} />;
  }

  if (!inApp) {
    return <Landing onLaunch={() => setView('dashboard')} />;
  }

  return (
    <div className="shell">
      <div className="aurora" aria-hidden />

      <Sidebar
        view={view}
        setView={setView}
        goLanding={goLanding}
        badge={store.state.createdOnChain ? store.state.records.length : null}
        poolId={deployment?.poolContractId ?? null}
        onProfile={() => setPeek('profile')}
      />

      <div className="shell-main">
        <Topbar
          title={TITLE[view]}
          live={!!deployment}
          onHome={goLanding}
          onNewSession={store.reset}
          onOpenCmdk={() => setCmdkOpen(true)}
        />

        <div className={`main-split ${peek ? 'peeking' : ''}`}>
          <main className="content">
            {loaded && !deployment && (
              <div className="panel" style={{ borderColor: 'var(--danger)' }}>
                <h2>No deployment found</h2>
                <p className="sub">
                  <code>app/public/deployment.json</code> is missing. Run <code>npm run deploy:testnet</code>{' '}
                  to deploy the pool + USDC token and write it.
                </p>
              </div>
            )}

            {deployment && (
              <div className="view-anim" key={view}>
                {view === 'dashboard' && (
                  <Dashboard store={store} deployment={deployment} onNavigate={setView} onPeek={setPeek} />
                )}
                {view === 'programs' && <OrgAdmin store={store} deployment={deployment} />}
                {view === 'audit' && <Auditor store={store} />}
                {view === 'tech' && <TechPage deployment={deployment} />}
              </div>
            )}
          </main>

          {peek && deployment && (
            <Peek
              kind={peek}
              store={store}
              deployment={deployment}
              setView={setView}
              onClose={() => setPeek(null)}
              onHome={goLanding}
            />
          )}
        </div>
      </div>

      <MobileNav view={view} setView={setView} />
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} commands={commands} />
    </div>
  );
}

function TechPage({ deployment }: { deployment: Deployment }) {
  return (
    <div className="content-narrow">
      <div className="panel">
        <h2>Under the hood</h2>
        <p className="sub">
          You never touch any of this. Recipients prove they qualify with a zero-knowledge proof — they
          reveal nothing about who they are — and the payout settles on Stellar in USDC. This is what
          makes Almoner private to the public yet provable to the donor.
        </p>
        <Meta label="Network">Stellar testnet</Meta>
        <Meta label="Proof system">Groth16 · BN254 (verified on-chain)</Meta>
        <Meta label="Settlement contract">
          <a className="link mono" href={explorerContract(deployment.poolContractId)} target="_blank" rel="noreferrer">
            {deployment.poolContractId.slice(0, 8)}…{deployment.poolContractId.slice(-6)} ↗
          </a>
        </Meta>
        <Meta label="USDC token">
          <a className="link mono" href={explorerContract(deployment.usdcTokenId)} target="_blank" rel="noreferrer">
            {deployment.usdcTokenId.slice(0, 8)}…{deployment.usdcTokenId.slice(-6)} ↗
          </a>
        </Meta>
      </div>
      <div className="panel">
        <div className="tinylabel">What's posted on-chain</div>
        <p className="note" style={{ margin: 0 }}>
          Only the cohort's Merkle root and the program's public policy go on-chain — never the recipient
          list. A claim proves membership against that root without revealing which person claimed, and a
          per-program nullifier blocks any second claim. The audit memo each claim posts is encrypted to
          the donor's view key, so only the donor can ever read who was paid.
        </p>
      </div>
    </div>
  );
}
