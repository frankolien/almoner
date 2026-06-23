import './landing.css';
import { Logo, IconArrow } from './icons.js';
import { GITHUB_URL, DORAHACKS_URL, STELLAR_URL, X_URL } from '../docs/content.js';

export default function Landing({ onLaunch }: { onLaunch: () => void }) {
  const go = (hash: string) => {
    window.location.hash = hash;
    window.scrollTo(0, 0);
  };
  return (
    <div className="landing">
      {/* moody mountain backdrop */}
      <svg className="ls-mountains" viewBox="0 0 1440 460" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path
          d="M0,300 L130,232 L250,276 L380,190 L520,252 L660,170 L800,244 L940,182 L1080,262 L1230,196 L1340,250 L1440,206 L1440,460 L0,460 Z"
          fill="#1a0f0c"
        />
        <path
          d="M0,356 L170,300 L310,344 L470,278 L630,336 L780,268 L930,336 L1090,280 L1250,344 L1390,292 L1440,332 L1440,460 L0,460 Z"
          fill="#0e0807"
        />
      </svg>

      {/* nav */}
      <nav className="lwrap ls-nav">
        <div className="ls-nav-inner">
          <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="mark" style={{ color: 'var(--text)' }}>
              <Logo size={24} />
            </span>
            Almoner<span className="dot">.</span>
          </div>
          <button className="btn btn-primary btn-nav" onClick={onLaunch}>
            Launch app
          </button>
        </div>
      </nav>

      {/* hero */}
      <main className="lwrap ls-hero">
        <div className="ls-eyebrow">
          <span className="dot-live" /> Confidential aid disbursement · Stellar · ZK
        </div>
        <h1>
          <span className="accent-t">Aid that proves itself.</span>
          <br />
          <span className="white-t">Without exposing anyone.</span>
        </h1>
        <p>
          Beneficiaries prove they qualify and claim USDC to a fresh wallet — their identity never
          lands on a public ledger, yet the donor can still prove every dollar reached someone
          eligible. One Groth16 proof, verified on-chain by Stellar.
        </p>
        <div className="ls-cta">
          <button className="btn btn-primary btn-lg" onClick={onLaunch}>
            Launch the demo <IconArrow size={17} />
          </button>
          <a className="btn btn-ghost btn-lg" href="#docs/how-it-works" onClick={(e) => { e.preventDefault(); go('docs/how-it-works'); }}>
            How it works
          </a>
        </div>
      </main>

      {/* footer */}
      <footer className="lwrap ls-footer">
        <div className="ls-footer-cols">
          <div>
            <h4>Product</h4>
            <span className="fitem" onClick={onLaunch}>Launch app</span>
            <span className="fitem" onClick={() => go('programs')}>Org admin</span>
            <span className="fitem" onClick={() => go('docs/zero-gas')}>Beneficiary</span>
            <span className="fitem" onClick={() => go('audit')}>Auditor</span>
          </div>
          <div>
            <h4>Protocol</h4>
            <span className="fitem" onClick={() => go('docs/the-circuit')}>aid_claim circuit</span>
            <span className="fitem" onClick={() => go('docs/on-chain')}>Soroban pool</span>
            <span className="fitem" onClick={() => go('docs/on-chain')}>BN254 verifier</span>
            <span className="fitem" onClick={() => go('docs/nullifiers')}>Nullifier set</span>
          </div>
          <div>
            <h4>Developers</h4>
            <span className="fitem" onClick={() => go('docs/introduction')}>Documentation</span>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
            <span className="fitem" onClick={() => go('docs/how-it-works')}>Architecture</span>
            <span className="fitem" onClick={() => go('docs/quickstart')}>Demo script</span>
          </div>
          <div>
            <h4>Connect</h4>
            <a href={X_URL} target="_blank" rel="noreferrer">X / Twitter</a>
            <a href={STELLAR_URL} target="_blank" rel="noreferrer">
              Stellar <span className="soon">testnet</span>
            </a>
            <a href={DORAHACKS_URL} target="_blank" rel="noreferrer">DoraHacks</a>
          </div>
        </div>

        <div className="ls-footer-rule" />

        <div className="ls-footer-bottom">
          <div className="ls-footer-brand">
            <div className="brand">
              <span className="mark" style={{ color: 'var(--text)' }}>
                <Logo size={20} />
              </span>
              Almoner<span className="dot">.</span>
            </div>
            <p>
              Confidential, auditable aid disbursement on Stellar, powered by zero-knowledge proofs.
              Almoner runs on Stellar testnet — a hackathon prototype for Stellar Hacks: Real-World ZK,
              not for production use. Private to the world, provable to the donor.
            </p>
          </div>
          <div className="ls-footer-legal">
            <span className="fitem" onClick={() => go('docs/introduction')}>Terms</span>
            <span className="fitem" onClick={() => go('docs/selective-disclosure')}>Privacy</span>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">README</a>
          </div>
        </div>
        <div className="ls-copy">© 2026 Almoner · Stellar Hacks: Real-World ZK</div>
      </footer>
    </div>
  );
}
