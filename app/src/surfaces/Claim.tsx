import { useMemo, useState, type CSSProperties } from 'react';
import './claim.css';
import { Logo, IconArrow, IconCheck } from '../landing/icons.js';
import { decodeCredential, type Credential } from '../lib/credential.js';
import { claimFromCredential, reclaimFromCredential, type ClaimResult } from '../lib/demo.js';
import type { Deployment } from '../lib/config.js';
import { explorerAccount, explorerTx } from '../lib/config.js';
import { useLog, usdc } from '../lib/ui.js';
import { StatNum } from '../lib/motion.js';
import Confetti from '../lib/Confetti.js';

const RITUAL = ['Creating your private wallet', 'Proving you qualify', 'Settling on Stellar'];

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
      <div className="claim" data-warm>
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
      setResult(await claimFromCredential(cred!, log));
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
      setDoubleClaim(await reclaimFromCredential(cred!, log));
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  const amount = usdc(cred.entitlement);
  const hasErr = lines.some((l) => l.kind === 'err');
  const stepCount = lines.filter((l) => l.kind === 'step').length;
  const effStep = Math.max(stepCount, busy ? 1 : 0);
  const showRitual = busy && !result;

  return (
    <div className="claim" data-warm>
      {result && <Confetti />}
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

            {!showRitual && (
              <div className="claim-attrs">
                {['On the list', 'Region verified', 'Age verified', 'Identity verified'].map((a, i) => (
                  <div className="claim-attr" key={a} style={{ '--i': i } as CSSProperties}>
                    <span className="c">
                      <IconCheck size={13} />
                    </span>
                    {a}
                  </div>
                ))}
              </div>
            )}

            {showRitual && (
              <div className="ritual">
                {RITUAL.map((label, i) => {
                  const done = i < effStep - 1;
                  const active = i === effStep - 1;
                  return (
                    <div className={`ritual-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} key={label}>
                      <span className="ritual-dot">
                        {done ? (
                          <svg className="ritual-tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12l5 5L20 6" />
                          </svg>
                        ) : active ? (
                          <span className="ritual-spin" />
                        ) : null}
                      </span>
                      <span className="ritual-label">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {!showRitual && (
              <button className="claim-btn" onClick={onClaim} disabled={busy || !deployment}>
                Claim my aid <IconArrow size={17} />
              </button>
            )}
            {!deployment && <p className="claim-meta">Deployment not found — run the org console first.</p>}
          </>
        ) : (
          <>
            <div className="claim-success-ring">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </div>
            <div className="claim-amount">
              +<StatNum to={Number(usdc(result.usdcReceived))} format={(n) => n.toFixed(2)} /> USDC
            </div>
            <div className="claim-amount-l">delivered to your fresh wallet</div>
            <div className="claim-callout">
              We never saw your identity, not even once. The public ledger shows only an opaque hash
              and a payout to a brand-new address.
            </div>
            <div className="claim-receipt">
              your wallet&nbsp;&nbsp;
              <a href={explorerAccount(result.freshPublicKey)} target="_blank" rel="noreferrer">
                {result.freshPublicKey.slice(0, 10)}…{result.freshPublicKey.slice(-6)} ↗
              </a>
              <br />
              receipt&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <a href={explorerTx(result.txHash)} target="_blank" rel="noreferrer">
                {result.txHash.slice(0, 16)}… ↗
              </a>
            </div>
            <div className="claim-meta">↳ Withdraw to local cash at any Stellar anchor, or spend the USDC directly.</div>

            <div className="claim-row">
              <button className="claim-btn ghost" style={{ width: 'auto', flex: 1 }} onClick={onDouble} disabled={busy}>
                {busy ? 'Trying…' : 'Try to claim again'}
              </button>
              {doubleClaim === true && <span className="reject-stamp">Rejected — already claimed</span>}
              {doubleClaim === false && <span className="pillx ok">Accepted (unexpected)</span>}
            </div>
          </>
        )}

        {hasErr && (
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
