import { useEffect, useState } from 'react';
import { useDemoStore } from './lib/store.js';
import { loadDeployment, type Deployment, explorerContract } from './lib/config.js';
import OrgAdmin from './surfaces/OrgAdmin.js';
import Beneficiary from './surfaces/Beneficiary.js';
import Auditor from './surfaces/Auditor.js';

type Tab = 'org' | 'beneficiary' | 'auditor';

const TABS: { id: Tab; label: string; num: string }[] = [
  { id: 'org', label: 'Org admin', num: '01' },
  { id: 'beneficiary', label: 'Beneficiary', num: '02' },
  { id: 'auditor', label: 'Auditor', num: '03' },
];

export default function App() {
  const store = useDemoStore();
  const [tab, setTab] = useState<Tab>('org');
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadDeployment().then((d) => {
      setDeployment(d);
      setLoaded(true);
    });
  }, []);

  return (
    <div className="wrap">
      <header className="masthead">
        <div>
          <div className="eyebrow">Stellar Hacks · Real-World ZK</div>
          <div className="brand">
            Almoner<span className="dot">.</span>
          </div>
          <div className="tagline">Private to the world. Provable to the donor.</div>
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
              <button className="ghost" style={{ marginLeft: 10, padding: '4px 10px' }} onClick={store.reset}>
                Reset demo
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
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="num">{t.num}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {deployment && tab === 'org' && <OrgAdmin store={store} deployment={deployment} />}
      {deployment && tab === 'beneficiary' && <Beneficiary store={store} deployment={deployment} />}
      {deployment && tab === 'auditor' && <Auditor store={store} deployment={deployment} />}
    </div>
  );
}
