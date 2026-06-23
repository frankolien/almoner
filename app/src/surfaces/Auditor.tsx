import { useState } from 'react';
import type { DemoStore } from '../lib/store.js';
import { runAudit, runAuditViaViewKey, type ViewKeyAudit } from '../lib/demo.js';
import type { AuditReport } from '@almoner/lib';
import { Disclosure, usdc } from '../lib/ui.js';
import { PrivacyLens } from '../lib/PrivacyLens.js';

export default function Auditor({ store }: { store: DemoStore }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [vk, setVk] = useState<ViewKeyAudit | null>(null);
  const [busy, setBusy] = useState<'' | 'v1' | 'v2'>('');
  const [err, setErr] = useState<string | null>(null);
  const { state } = store;

  if (!state.program) {
    return (
      <div className="panel">
        <div className="empty">No program yet — create one on the Programs tab first.</div>
      </div>
    );
  }

  async function run(which: 'v1' | 'v2') {
    setBusy(which);
    setErr(null);
    try {
      if (which === 'v1') setReport(await runAudit(store));
      else setVk(await runAuditViaViewKey(store));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Donor view · who received aid</h2>
        <p className="sub">
          See exactly who claimed and how much — visible only to you. To the public, every payout is
          unlinkable. <b>Private to the world, provable to the donor.</b>
        </p>
        <div className="callout" style={{ marginBottom: 16 }}>
          <b>Proven, not trusted.</b> Every claim left a private note on the ledger that only your key can
          open. Reconstruct the full picture here — <b>without ever needing the organization's recipient
          list</b>. No one else can read a single note.
        </div>
        <div style={{ margin: '4px 0 16px' }}>
          <PrivacyLens height={188} />
        </div>
        <div className="row">
          <button className="primary" onClick={() => run('v2')} disabled={!!busy}>
            {busy === 'v2' ? 'Reading the ledger…' : 'Show who received aid'}
          </button>
          <button className="ghost" onClick={() => run('v1')} disabled={!!busy}>
            {busy === 'v1' ? 'Matching…' : 'Cross-check against your records'}
          </button>
        </div>
        {err && <p className="note" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</p>}
      </div>

      {vk && (
        <div className="panel">
          <div className="tinylabel">Opened with your private key — no recipient list used</div>
          <div className="kpis">
            <div className="kpi">
              <div className="v accent">{vk.count}</div>
              <div className="l">people received aid</div>
            </div>
            <div className="kpi">
              <div className="v green">{usdc(vk.total)} USDC</div>
              <div className="l">total disbursed</div>
            </div>
            <div className="kpi">
              <div className="v">0</div>
              <div className="l">of your records needed</div>
            </div>
          </div>
          <div className="divider" />
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Recipient</th>
                <th>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {vk.rows.map((row, idx) => (
                <tr
                  key={row.leafIndex}
                  className="claimed"
                  style={{ animation: 'fade var(--dur-base) var(--ease-soft) both', animationDelay: `${idx * 90}ms` }}
                >
                  <td>{row.leafIndex}</td>
                  <td>{row.name}</td>
                  <td>{usdc(row.amount)} USDC</td>
                  <td className="hash">from private note</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <Disclosure summary="How only you can read this" tone="bare">
            <p className="note" style={{ margin: '2px 0 4px' }}>
              Each claim posted a note <i>encrypted to your key</i> (NaCl box — X25519 +
              XSalsa20-Poly1305, with a fresh ephemeral sender key so notes can't be linked to each
              other). The contract stored the opaque bytes; only your private key opens them. The public
              sees the same bytes as meaningless ciphertext — selective disclosure, not trust.
            </p>
          </Disclosure>
        </div>
      )}

      {report && (
        <div className="panel">
          <div className="tinylabel">Cross-checked against your own recipient records</div>
          <div className="kpis">
            <div className="kpi">
              <div className="v accent">
                {report.claimedCount}/{report.eligibleCount}
              </div>
              <div className="l">eligible recipients claimed</div>
            </div>
            <div className="kpi">
              <div className="v green">{usdc(report.totalClaimed)} USDC</div>
              <div className="l">total disbursed</div>
            </div>
            <div className="kpi">
              <div className="v">100%</div>
              <div className="l">payouts matched to an eligible beneficiary</div>
            </div>
          </div>
          <div className="divider" />
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Recipient</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.index} className={row.claimed ? 'claimed' : ''}>
                  <td>{row.index}</td>
                  <td>{state.records[row.index]?.name ?? `#${row.index}`}</td>
                  <td className="hash">{row.nullifierHash.toString(16).slice(0, 14)}…</td>
                  <td>{usdc(row.entitlement)} USDC</td>
                  <td>
                    {row.claimed ? (
                      <span className="pill ok">claimed</span>
                    ) : (
                      <span className="pill wait">not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}
