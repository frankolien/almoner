import { useState } from 'react';
import type { DemoStore } from '../lib/store.js';
import type { Deployment } from '../lib/config.js';
import { runAudit } from '../lib/demo.js';
import type { AuditReport } from '@almoner/lib';
import { usdc } from '../lib/ui.js';

export default function Auditor({ store, deployment }: { store: DemoStore; deployment: Deployment }) {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { state } = store;

  if (!state.program) {
    return (
      <div className="panel">
        <div className="empty">No program yet — register a cohort on the Org admin tab first.</div>
      </div>
    );
  }

  async function onAudit() {
    setBusy(true);
    setErr(null);
    try {
      setReport(await runAudit(store, deployment));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <h2>Auditor / donor · reconstruct who was paid</h2>
        <p className="sub">
          Holding the registration table, the donor recomputes each beneficiary's expected
          <span className="mono"> Poseidon(nullifier, programId)</span> and matches it against the
          on-chain spent set. That yields exactly who claimed and the program total — while the public
          sees only opaque hashes. <b>Private to the world, provable to the donor.</b>
        </p>
        <button className="primary" onClick={onAudit} disabled={busy}>
          {busy ? 'Reconstructing…' : 'Reconstruct from on-chain spent set'}
        </button>
        {err && <p className="note" style={{ color: 'var(--red)', marginTop: 10 }}>{err}</p>}
      </div>

      {report && (
        <div className="panel">
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
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Beneficiary</th>
                <th>Expected nullifier hash</th>
                <th>Entitlement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.index} className={row.claimed ? 'claimed' : ''}>
                  <td>{row.index}</td>
                  <td>{state.records[row.index]?.name ?? `#${row.index}`}</td>
                  <td className="hash">
                    {row.nullifierHash.toString(16).slice(0, 14)}…
                  </td>
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
          <p className="note" style={{ marginTop: 14 }}>
            The public cannot do this: <span className="mono">nullifierHash</span> is a one-way
            Poseidon of a secret. They see only opaque hashes and payouts to fresh addresses.
          </p>
        </div>
      )}
    </>
  );
}
