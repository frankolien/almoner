import { useState } from 'react';
import type { DemoStore } from '../lib/store.js';
import type { Deployment } from '../lib/config.js';
import { registerCohort, fundProgram, DEMO } from '../lib/demo.js';
import { ActivityLog, useLog, usdc } from '../lib/ui.js';

export default function OrgAdmin({ store, deployment }: { store: DemoStore; deployment: Deployment }) {
  const { lines, log, clear } = useLog();
  const [busy, setBusy] = useState(false);
  const { state } = store;

  async function onRegister() {
    setBusy(true);
    clear();
    try {
      await registerCohort(store, deployment, log);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onFund() {
    setBusy(true);
    try {
      await fundProgram(store, deployment, 500, log);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Organization · register the eligible cohort</h2>
        <p className="sub">
          The org issues each beneficiary a secret, binds their attributes into a Poseidon leaf
          commitment, builds a Merkle tree of the cohort, and posts only the <b>root</b> on Soroban —
          then funds the USDC pool. No beneficiary identity ever touches the chain.
        </p>

        <div className="grid">
          <Stat label="Cohort size" value={String(DEMO.cohortSize)} />
          <Stat label="Eligible region" value={DEMO.regionLabel} />
          <Stat label="Age gate" value="≥ 18" />
          <Stat label="Entitlement / tier" value={`${usdc(DEMO.entitlementBaseUnits)} USDC`} />
        </div>

        <div className="spacer" />
        <div className="row">
          <button className="primary" onClick={onRegister} disabled={busy}>
            {state.createdOnChain ? 'Re-register a fresh cohort' : 'Register cohort + post root on-chain'}
          </button>
          <button className="ghost" onClick={onFund} disabled={busy || !state.createdOnChain}>
            Fund pool (+500 USDC)
          </button>
        </div>
      </div>

      {state.program && (
        <div className="panel">
          <div className="tinylabel">Registered program</div>
          <div className="grid">
            <Stat label="Program ID" value={`#${state.program.programId}`} accent />
            <Stat label="Merkle root" value={short(state.root)} mono />
            <Stat label="Min birth year" value={state.program.minBirthYear} />
            <Stat label="Required tier" value={state.program.requiredTier} />
          </div>
          <div className="divider" />
          <div className="tinylabel">Registration table (private to the org + auditor)</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Beneficiary</th>
                <th>Region</th>
                <th>Birth year</th>
                <th>KYC</th>
                <th>Entitlement</th>
              </tr>
            </thead>
            <tbody>
              {state.records.map((r, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>{r.name}</td>
                  <td>{r.regionCode}</td>
                  <td>{r.birthYear}</td>
                  <td>{r.kycFlag === '1' ? '✓' : '—'}</td>
                  <td>{usdc(r.entitlement)} USDC</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 14 }}>
            Only the Merkle root and the policy parameters are on-chain. This table never is — it is
            what later lets the donor (and only the donor) reconstruct who was paid.
          </p>
        </div>
      )}

      <ActivityLog lines={lines} />
    </>
  );
}

function Stat({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ fontSize: 16, fontWeight: 700 }} className={`${accent ? '' : ''} ${mono ? 'mono' : ''}`}>
        <span style={accent ? { color: 'var(--accent)' } : undefined}>{value}</span>
      </div>
    </div>
  );
}

const short = (s: string | null) => (s ? `${s.slice(0, 10)}…${s.slice(-6)}` : '—');
