import { useMemo, useState } from 'react';
import './claim.css';
import { Logo, IconArrow } from '../landing/icons.js';
import { decodeCredential, type Credential } from '../lib/credential.js';
import { claimFromCredential, reclaimFromCredential, type ClaimResult } from '../lib/demo.js';
import type { Deployment } from '../lib/config.js';
import { explorerAccount, explorerTx } from '../lib/config.js';
import { useLog, usdc } from '../lib/ui.js';

export default function Claim({ credentialStr, deployment }: { credentialStr: string; deployment: Deployment | null }) {
  const { lines, log, clear } = useLog();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [doubleClaim, setDoubleClaim] = useState<boolean | null>(null);

  const cred: Credential | null = useMemo(() => {
    try {
      return decodeCredential(credentialStr);
    } catch {
      return null;
    }
  }, [credentialStr]);

  const goHome = () => {
    window.location.hash = '';
    window.location.reload();
  };

  if (!cred) {
    return (
      <div className="claim">
        <div className="claim-card">
          <Brand />
          <div className="claim-err">This claim link is invalid or has expired.</div>
          <a className="claim-back" onClick={goHome}>
            ← Back to Almoner
          </a>
        </div>
      </div>
    );
  }

  async function onClaim() {
    if (!deployment) return;
    setBusy(true);
    setResult(null);
    setDoubleClaim(null);
    clear();
    try {
      setResult(await claimFromCredential(cred!, deployment, log));
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onDouble() {
    if (!deployment) return;
    setBusy(true);
    try {
      setDoubleClaim(await reclaimFromCredential(cred!, deployment, log));
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  const amount = usdc(cred.entitlement);

  return (
    <div className="claim">
      <div className="claim-card">
        <Brand />

        {!result ? (
          <>
            <div className="claim-eyebrow">
              <span className="d" /> Confidential aid · program #{cred.programId}
            </div>
            <h1>
              {cred.name}, you qualify for <span className="amt">{amount} USDC</span>
            </h1>
            <p className="sub">
              Claim it privately to a fresh wallet. Your identity never touches the public ledger, and
              you pay no fees — gas is sponsored for you.
            </p>
            <div className="claim-attrs">
              {['Cohort member', 'Region eligible', 'Age ≥ 18', 'Tier + KYC'].map((a) => (
                <div className="claim-attr" key={a}>
                  <span className="c">✓</span>
                  {a}
                </div>
              ))}
            </div>
            <button className="claim-btn" onClick={onClaim} disabled={busy || !deployment}>
              {busy ? 'Proving & claiming…' : 'Claim my aid'} <IconArrow size={17} />
            </button>
            {!deployment && (
              <p className="claim-meta">Deployment not found — run the org console first.</p>
            )}
          </>
        ) : (
          <>
            <div className="claim-amount">+{usdc(result.usdcReceived)} USDC</div>
            <div className="claim-amount-l">delivered to your fresh wallet</div>
            <div className="claim-callout">
              We never saw your identity, not even once. The public ledger shows only an opaque hash
              and a payout to a brand-new address.
            </div>
            <div className="claim-receipt">
              wallet&nbsp;&nbsp;
              <a href={explorerAccount(result.freshPublicKey)} target="_blank" rel="noreferrer">
                {result.freshPublicKey.slice(0, 10)}…{result.freshPublicKey.slice(-6)} ↗
              </a>
              <br />
              nullifier {result.nullifierHashHex.slice(0, 22)}…
              <br />
              tx&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <a href={explorerTx(result.txHash)} target="_blank" rel="noreferrer">
                {result.txHash.slice(0, 16)}… ↗
              </a>
            </div>
            <div className="claim-meta">↳ Withdraw to local cash at any Stellar anchor, or spend the USDC directly.</div>

            <div className="claim-row">
              <button className="claim-btn ghost" style={{ width: 'auto', flex: 1 }} onClick={onDouble} disabled={busy}>
                {busy ? 'Trying…' : 'Try to claim again'}
              </button>
              {doubleClaim === true && <span className="pillx no">Rejected — already claimed</span>}
              {doubleClaim === false && <span className="pillx ok">Accepted (unexpected)</span>}
            </div>
          </>
        )}

        {lines.length > 0 && (
          <div className="claim-log">
            {lines.map((l, i) => (
              <div key={i} className={l.kind}>
                {{ step: '▸', ok: '✓', err: '✗', info: '·' }[l.kind]} {l.msg}
              </div>
            ))}
          </div>
        )}

        <a className="claim-back" onClick={goHome}>
          ← Almoner
        </a>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="claim-top">
      <div className="claim-brand">
        <Logo size={22} />
        Almoner<span className="dot">.</span>
      </div>
      <div className="claim-net">Stellar testnet</div>
    </div>
  );
}
