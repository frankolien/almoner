import { useEffect, useState } from 'react';
import { useDemoStore } from './lib/store.js';
import { loadDeployment, type Deployment, explorerContract } from './lib/config.js';
import Landing from './landing/Landing.js';
import { Logo } from './landing/icons.js';
import OrgAdmin from './surfaces/OrgAdmin.js';
import Auditor from './surfaces/Auditor.js';
import Claim from './surfaces/Claim.js';

type Tab = 'org' | 'auditor';

const TABS: { id: Tab; label: string; num: string }[] = [
  { id: 'org', label: 'Org console', num: '01' },
  { id: 'auditor', label: 'Auditor', num: '02' },
];

export default function App() {
  const store = useDemoStore();
  const [route, setRoute] = useState(() => (typeof window !== 'undefined' ? window.location.hash : ''));
  const [tab, setTab] = useState<Tab>('org');
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  // ---- beneficiary claim app (standalone, credential-driven) ----
  if (route.startsWith('#claim=')) {
    return <Claim credentialStr={route.slice('#claim='.length)} deployment={deployment} />;
  }

  const inApp = route === '#app' || route === '#org' || route === '#audit';
  const go = (target: 'landing' | 'app' | 'audit') => {
    window.location.hash = target === 'landing' ? '' : target === 'audit' ? 'audit' : 'app';
    window.scrollTo(0, 0);
    if (target === 'audit') setTab('auditor');
    setRoute(window.location.hash);
  };

  if (!inApp) {
    return <Landing onLaunch={() => go('app')} />;
  }

  const activeTab: Tab = route === '#audit' ? 'auditor' : tab;

  return (
    <div className="wrap">
      <header className="masthead">
        <div
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          onClick={() => go('landing')}
        >
          <span style={{ color: 'var(--text)', display: 'grid', placeItems: 'center' }}>
            <Logo size={30} />
          </span>
          <div>
            <div className="brand" style={{ fontSize: 26 }}>
              Almoner<span className="dot">.</span>
            </div>
            <div className="tagline">Private to the world. Provable to the donor.</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="netbadge">
            Stellar <b>testnet</b> · Groth16 / BN254
          </div>
          {deployment && (
            <div style={{ marginTop: 8 }}>
              <a className="link" href={explorerContract(deployment.poolContractId)} target="_blank" rel="noreferrer">
                pool {deployment.poolContractId.slice(0, 6)}…{deployment.poolContractId.slice(-4)} ↗
              </a>
              {'   '}
              <button
                className="ghost"
                style={{ marginLeft: 10, padding: '4px 10px' }}
                onClick={store.reset}
                title="Clears your local browser session (cohort + claims) to start a fresh program. Does not touch on-chain state."
              >
                Clear session
              </button>
            </div>
          )}
        </div>
      </header>

      {loaded && !deployment && (
        <div className="panel" style={{ borderColor: 'var(--red)' }}>
          <h2>No deployment found</h2>
          <p className="sub">
            <code>app/public/deployment.json</code> is missing. Run{' '}
            <code>npm run deploy:testnet</code> to deploy the pool + USDC token and write it.
          </p>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={activeTab === t.id ? 'active' : ''}
            onClick={() => {
              setTab(t.id);
              window.location.hash = t.id === 'auditor' ? 'audit' : 'app';
              setRoute(window.location.hash);
            }}
          >
            <span className="num">{t.num}</span>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={{ color: 'var(--muted)' }} onClick={() => go('landing')}>
          ← Home
        </button>
      </nav>

      {deployment && activeTab === 'org' && <OrgAdmin store={store} />}
      {deployment && activeTab === 'auditor' && <Auditor store={store} />}
    </div>
  );
}
