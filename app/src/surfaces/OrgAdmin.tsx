import { useEffect, useState, type CSSProperties } from 'react';
import QRCode from 'qrcode';
import { buildCohort } from '@almoner/lib';
import type { DemoStore } from '../lib/store.js';
import type { Deployment } from '../lib/config.js';
import { registerCohort, fundProgram, runAudit, toRecord, DEMO } from '../lib/demo.js';
import { buildCredential, credentialUrl } from '../lib/credential.js';
import { ActivityLog, Disclosure, Meta, useLog, usdc } from '../lib/ui.js';
import ClaimLinkDrawer, { type ActiveCred } from '../components/ClaimLinkDrawer.js';
import { IconSend, IconCheck } from '../landing/icons.js';

type Filter = 'all' | 'unsent' | 'claimed';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unsent', label: 'Not sent' },
  { id: 'claimed', label: 'Claimed' },
];

export default function OrgAdmin({ store, deployment }: { store: DemoStore; deployment: Deployment }) {
  const { lines, log, clear } = useLog();
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<ActiveCred | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [issued, setIssued] = useState<Set<number>>(new Set());
  const [claimedSet, setClaimedSet] = useState<Set<number>>(new Set());
  const { state } = store;
  const hasError = lines.some((l) => l.kind === 'err');

  useEffect(() => {
    let alive = true;
    if (!state.program) {
      setClaimedSet(new Set());
      return;
    }
    runAudit(store)
      .then((rep) => alive && setClaimedSet(new Set(rep.rows.filter((r) => r.claimed).map((r) => r.index))))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.program?.programId, state.records.length]);

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
    const { tree } = await buildCohort(state.records.map(toRecord));
    const cred = await buildCredential(
      state.records[index],
      index,
      tree,
      state.program!,
      deployment.auditorPublicKey ?? '',
    );
    const url = credentialUrl(cred);
    const qr = await QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'L',
      color: { dark: '#0d0909', light: '#f2eeec' },
    });
    setIssued((s) => new Set(s).add(index));
    setDrawer({ index, name: state.records[index].name, url, qr });
  }

  const rows = state.records
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => {
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (filter === 'claimed' && !claimedSet.has(i)) return false;
      if (filter === 'unsent' && (claimedSet.has(i) || issued.has(i))) return false;
      return true;
    });

  function statusChip(i: number) {
    if (claimedSet.has(i))
      return (
        <span className="pill ok">
          <IconCheck size={12} /> Claimed
        </span>
      );
    if (issued.has(i)) return <span className="pill sent">Link issued</span>;
    return (
      <span className="pill" style={{ background: 'var(--bg-subtle)', color: 'var(--faint)' }}>
        Not sent
      </span>
    );
  }

  return (
    <>
      <div className="panel">
        <h2>New disbursement program</h2>
        <p className="sub">
          Set who's eligible and how much each person receives. Everyone gets a private link to claim
          their aid — no wallet, no fees, no crypto know-how on their end. Eligibility and payout are
          handled for you behind the scenes.
        </p>
        <div className="grid">
          <Stat label="Recipients" value={String(DEMO.cohortSize)} />
          <Stat label="Eligible region" value={DEMO.regionLabel} />
          <Stat label="Age requirement" value="18 or older" />
          <Stat label="Amount each" value={`${usdc(DEMO.entitlementBaseUnits)} USDC`} />
        </div>
        <div className="spacer" />
        <div className="row">
          <button className="primary" onClick={() => run(() => registerCohort(store, log))} disabled={busy}>
            {busy && !state.createdOnChain
              ? 'Creating program…'
              : state.createdOnChain
                ? 'Start a new program'
                : 'Create program'}
          </button>
          <button
            className="ghost"
            onClick={() => run(() => fundProgram(store, 500, log))}
            disabled={busy || !state.createdOnChain}
          >
            Add 500 USDC
          </button>
        </div>
      </div>

      {state.program && (
        <div className="panel">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="tinylabel" style={{ marginBottom: 0 }}>Program #{state.program.programId}</div>
            <span className="statuspill"><span className="d" /> Live</span>
          </div>
          <div className="spacer" />
          <div className="grid">
            <Stat label="Recipients" value={String(state.records.length)} accent />
            <Stat label="Amount each" value={`${usdc(DEMO.entitlementBaseUnits)} USDC`} />
            <Stat label="Claimed" value={`${claimedSet.size} / ${state.records.length}`} />
            <Stat label="Eligibility" value="Region · 18+" />
          </div>
          <div className="divider" />

          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
            <div className="tinylabel" style={{ marginBottom: 0 }}>Recipients · send each their private claim link</div>
            <div className="row" style={{ gap: 8 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipients…"
                style={{
                  background: 'var(--bg-subtle)', border: '1px solid var(--line)', color: 'var(--text)',
                  borderRadius: 8, padding: '7px 11px', fontSize: 13, fontFamily: 'inherit', width: 170,
                }}
              />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  className="ghost"
                  onClick={() => setFilter(f.id)}
                  style={{
                    padding: '7px 11px', fontSize: 12,
                    ...(filter === f.id ? { borderColor: 'var(--accent-line)', color: 'var(--text)' } : {}),
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Recipient</th>
                <th>Region</th>
                <th>Born</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ r, i }) => (
                <tr key={i}>
                  <td>{i}</td>
                  <td>{r.name}</td>
                  <td>{r.regionCode}</td>
                  <td>{r.birthYear}</td>
                  <td>{usdc(r.entitlement)} USDC</td>
                  <td>{statusChip(i)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="rowactions">
                      <button className="ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => issueLink(i)}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <IconSend size={13} /> {issued.has(i) || claimedSet.has(i) ? 'Re-send' : 'Send link'}
                        </span>
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty" style={{ padding: 22 }}>
                    No recipients match “{query || filter}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            This recipient list stays with you — it never goes on the public ledger. Only you and the
            donor can ever see who claimed; to everyone else, payouts are unlinkable.
          </p>

          <div style={{ marginTop: 16 }}>
            <Disclosure summary="What's actually posted on-chain" tone="bare">
              <p className="note" style={{ margin: '2px 0 12px' }}>
                We bind every recipient's attributes into a Poseidon leaf commitment, build a Merkle
                tree, and post <b>only the root</b> on Stellar — never the list above. A claim proves
                membership against this root without revealing which leaf.
              </p>
              <Meta label="Program ID">#{state.program.programId}</Meta>
              <Meta label="Merkle root"><span className="mono">{short(state.root)}</span></Meta>
              <Meta label="Min birth year">{state.program.minBirthYear}</Meta>
              <Meta label="Required tier">{state.program.requiredTier}</Meta>
            </Disclosure>
          </div>
        </div>
      )}

      {lines.length > 0 && (
        <Disclosure
          key={busy || hasError ? 'open' : 'closed'}
          summary={busy ? 'Working…' : hasError ? 'Something went wrong — details' : 'Activity log'}
          defaultOpen={busy || hasError}
        >
          <ActivityLog lines={lines} />
        </Disclosure>
      )}

      <ClaimLinkDrawer cred={drawer} onClose={() => setDrawer(null)} />
    </>
  );
}

function Stat({ label, value, accent, mono }: { label: string; value: string; accent?: boolean; mono?: boolean }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ fontSize: 16, fontWeight: 700 } as CSSProperties} className={mono ? 'mono' : ''}>
        <span style={accent ? { color: 'var(--accent)' } : undefined}>{value}</span>
      </div>
    </div>
  );
}

const short = (s: string | null) => (s ? `${s.slice(0, 10)}…${s.slice(-6)}` : '—');
