import { useState } from 'react';
import type { DemoStore } from '../lib/store.js';
import type { Deployment } from '../lib/config.js';
import { explorerAccount, explorerTx } from '../lib/config.js';
import { proveAndClaim, attemptDoubleClaim, type ClaimResult } from '../lib/demo.js';
import { ActivityLog, useLog, usdc } from '../lib/ui.js';

export default function Beneficiary({ store, deployment }: { store: DemoStore; deployment: Deployment }) {
  const { lines, log, clear } = useLog();
  const [index, setIndex] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [doubleClaim, setDoubleClaim] = useState<null | boolean>(null);
  const { state } = store;

  if (!state.program) {
    return (
      <div className="panel">
        <div className="empty">No program yet — register a cohort on the Org admin tab first.</div>
      </div>
    );
  }

  const alreadyClaimed = state.claims.some((c) => c.leafIndex === index);

  async function onClaim() {
    setBusy(true);
    setResult(null);
    setDoubleClaim(null);
    clear();
    try {
      const r = await proveAndClaim(store, deployment, index, log);
      setResult(r);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onDoubleClaim() {
    setBusy(true);
    try {
      const rejected = await attemptDoubleClaim(store, deployment, index, log);
      setDoubleClaim(rejected);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Beneficiary · prove eligibility, claim privately</h2>
        <p className="sub">
          Everything below happens <b>in this browser</b>. The secret never leaves the device. One
          Groth16 proof attests cohort membership + four program conditions, and the USDC lands in a
          fresh address the public ledger cannot link back to you.
        </p>

        <div className="row">
          <div className="field" style={{ minWidth: 240 }}>
            <label>I am beneficiary</label>
            <select value={index} onChange={(e) => setIndex(Number(e.target.value))} disabled={busy}>
              {state.records.map((r, i) => (
                <option key={i} value={i}>
                  #{i} · {r.name} · born {r.birthYear}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          <button className="primary" onClick={onClaim} disabled={busy}>
            {busy ? 'Working…' : 'Prove eligibility & claim'}
          </button>
        </div>
        {alreadyClaimed && !result && (
          <p className="note" style={{ marginTop: 10 }}>
            This beneficiary has already claimed in this program. Proving again will be rejected on-chain.
          </p>
        )}
      </div>

      <ActivityLog lines={lines} />

      {result && (
        <div className="panel">
          <div className="callout">
            We never saw their identity, not even once. The public ledger shows a payout to a fresh
            address and an opaque nullifier hash — nothing that links back to the beneficiary.
          </div>
          <div className="spacer" />
          <div className="kpis">
            <div className="kpi">
              <div className="v green">+{usdc(result.usdcReceived)} USDC</div>
              <div className="l">delivered to the fresh wallet</div>
            </div>
            <div className="kpi">
              <div className="v" style={{ fontSize: 18 }}>
                <a className="link" href={explorerAccount(result.freshPublicKey)} target="_blank" rel="noreferrer">
                  {result.freshPublicKey.slice(0, 8)}…{result.freshPublicKey.slice(-6)} ↗
                </a>
              </div>
              <div className="l">fresh recipient (unlinkable)</div>
            </div>
            <div className="kpi">
              <div className="v" style={{ fontSize: 18 }}>
                <a className="link" href={explorerTx(result.txHash)} target="_blank" rel="noreferrer">
                  view tx ↗
                </a>
              </div>
              <div className="l">on-chain claim</div>
            </div>
          </div>
          <div className="divider" />
          <div className="tinylabel">What the public ledger sees</div>
          <div className="proofbox">
            nullifierHash = {result.nullifierHashHex}
            <br />
            recipient = {result.freshPublicKey}
            <br />
            payout = {usdc(result.usdcReceived)} USDC · <span style={{ color: 'var(--muted)' }}>no name, no leaf, no link</span>
          </div>

          <div className="spacer" />
          <div className="row">
            <button className="ghost" onClick={onDoubleClaim} disabled={busy}>
              Try to claim again (same beneficiary)
            </button>
            {doubleClaim === true && <span className="pill no">Rejected — already claimed</span>}
            {doubleClaim === false && <span className="pill ok">Accepted (unexpected)</span>}
          </div>
          {doubleClaim === true && (
            <p className="note" style={{ marginTop: 10 }}>
              The per-program nullifier recomputed to the same hash, which is already spent — so the
              contract rejects it. <i>We don't know who you are, but we know you already claimed.</i>
            </p>
          )}
        </div>
      )}
    </>
  );
}
