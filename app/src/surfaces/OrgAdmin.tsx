import { useState } from 'react';
import QRCode from 'qrcode';
import { buildCohort } from '@almoner/lib';
import type { DemoStore } from '../lib/store.js';
import type { Deployment } from '../lib/config.js';
import { registerCohort, fundProgram, toRecord, DEMO } from '../lib/demo.js';
import { buildCredential, credentialUrl } from '../lib/credential.js';
import { ActivityLog, useLog, usdc } from '../lib/ui.js';

interface ActiveCred {
  index: number;
  name: string;
  url: string;
  qr: string;
}

export default function OrgAdmin({ store, deployment }: { store: DemoStore; deployment: Deployment }) {
  const { lines, log, clear } = useLog();
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<ActiveCred | null>(null);
  const [copied, setCopied] = useState(false);
  const { state } = store;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    clear();
    try {
      await fn();
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function issueLink(index: number) {
    setActive(null);
    setCopied(false);
    const { tree } = await buildCohort(state.records.map(toRecord));
    const cred = await buildCredential(state.records[index], index, tree, state.program!);
    const url = credentialUrl(cred);
    const qr = await QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'L', // credential is ~2.6KB; L gives the headroom
      color: { dark: '#0d0909', light: '#f2eeec' },
    });
    setActive({ index, name: state.records[index].name, url, qr });
  }

  return (
    <>
      <div className="panel">
        <h2>Organization · register the eligible cohort</h2>
        <p className="sub">
          The org issues each beneficiary a secret, binds their attributes into a Poseidon leaf
          commitment, builds a Merkle tree, and posts only the <b>root</b> on Soroban — then funds the
          USDC pool and hands each beneficiary a claim credential.
        </p>
        <div className="grid">
          <Stat label="Cohort size" value={String(DEMO.cohortSize)} />
          <Stat label="Eligible region" value={DEMO.regionLabel} />
          <Stat label="Age gate" value="≥ 18" />
          <Stat label="Entitlement / tier" value={`${usdc(DEMO.entitlementBaseUnits)} USDC`} />
        </div>
        <div className="spacer" />
        <div className="row">
          <button className="primary" onClick={() => run(() => registerCohort(store, deployment, log))} disabled={busy}>
            {state.createdOnChain ? 'Re-register a fresh cohort' : 'Register cohort + post root on-chain'}
          </button>
          <button
            className="ghost"
            onClick={() => run(() => fundProgram(store, deployment, 500, log))}
            disabled={busy || !state.createdOnChain}
          >
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
          <div className="tinylabel">Beneficiaries · issue each a claim credential to distribute</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Beneficiary</th>
                <th>Region</th>
                <th>Birth year</th>
                <th>Entitlement</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.records.map((r, i) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>{r.name}</td>
                  <td>{r.regionCode}</td>
                  <td>{r.birthYear}</td>
                  <td>{usdc(r.entitlement)} USDC</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => issueLink(i)}>
                      Issue claim link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 14 }}>
            Only the Merkle root and policy are on-chain. The registration table never is — it is what
            later lets the donor (and only the donor) reconstruct who was paid.
          </p>
        </div>
      )}

      {active && (
        <div className="panel">
          <div className="tinylabel">Claim credential · {active.name} (beneficiary #{active.index})</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <img
              src={active.qr}
              alt="claim QR"
              width={180}
              height={180}
              style={{ borderRadius: 12, border: '1px solid var(--border)' }}
            />
            <div style={{ flex: 1, minWidth: 240 }}>
              <p className="note" style={{ marginTop: 0 }}>
                This is {active.name}’s self-contained aid voucher. In production it’s delivered
                privately — printed card, QR at a registration center, or encrypted SMS. Whoever holds
                it can claim <b>once</b>; the relayer sponsors all gas.
              </p>
              <div className="proofbox" style={{ marginBottom: 12 }}>{active.url.slice(0, 78)}…</div>
              <div className="row">
                <button
                  className="ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(active.url);
                    setCopied(true);
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy link'}
                </button>
                <button className="primary" onClick={() => window.open(active.url, '_blank')}>
                  Open claim app ↗
                </button>
              </div>
            </div>
          </div>
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
      <div style={{ fontSize: 16, fontWeight: 700 }} className={mono ? 'mono' : ''}>
        <span style={accent ? { color: 'var(--accent)' } : undefined}>{value}</span>
      </div>
    </div>
  );
}

const short = (s: string | null) => (s ? `${s.slice(0, 10)}…${s.slice(-6)}` : '—');
