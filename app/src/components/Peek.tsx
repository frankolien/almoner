import { useState } from 'react';
import type { DemoStore } from '../lib/store.js';
import { type Deployment, explorerContract } from '../lib/config.js';
import { DEMO } from '../lib/demo.js';
import { usdc, Meta } from '../lib/ui.js';
import { PrivacyLens } from '../lib/PrivacyLens.js';
import { IconArrow, IconCopy, IconHome, IconCheck, Logo } from '../landing/icons.js';
import type { View } from '../App.js';

export type PeekKind = 'programs' | 'audit' | 'profile';

const META: Record<PeekKind, { title: string; expand: View | null }> = {
  programs: { title: 'Programs', expand: 'programs' },
  audit: { title: 'Donor audit', expand: 'audit' },
  profile: { title: 'Organization', expand: null },
};

export default function Peek({
  kind,
  store,
  deployment,
  setView,
  onClose,
  onHome,
}: {
  kind: PeekKind;
  store: DemoStore;
  deployment: Deployment;
  setView: (v: View) => void;
  onClose: () => void;
  onHome: () => void;
}) {
  const meta = META[kind];
  const onExpand = meta.expand ? () => setView(meta.expand as View) : undefined;

  return (
    <>
      <div className="peek-scrim" onClick={onClose} />
      <aside className="peek" role="dialog" aria-label={meta.title}>
        <div className="peek-head">
          <div className="peek-title">{meta.title}</div>
          <div className="peek-actions">
            {onExpand && (
              <button className="ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={onExpand}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  Expand <IconArrow size={13} />
                </span>
              </button>
            )}
            <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>
        <div className="peek-body">
          {kind === 'programs' && <ProgramsPeek store={store} onExpand={() => setView('programs')} />}
          {kind === 'audit' && <AuditPeek onExpand={() => setView('audit')} />}
          {kind === 'profile' && <ProfilePeek store={store} deployment={deployment} onHome={onHome} />}
        </div>
      </aside>
    </>
  );
}

function ProgramsPeek({ store, onExpand }: { store: DemoStore; onExpand: () => void }) {
  const { state } = store;
  if (!state.program) {
    return (
      <>
        <div className="peek-empty">
          <div className="peek-empty-ic"><Logo size={26} /></div>
          <div className="peek-empty-t">No program yet</div>
          <p className="note" style={{ textAlign: 'center', maxWidth: 240, margin: '0 auto 16px' }}>
            Commit your eligible cohort, fund the pool, and hand each recipient a private claim link.
          </p>
          <button className="primary" onClick={onExpand}>Create a program</button>
        </div>
      </>
    );
  }
  const each = usdc(DEMO.entitlementBaseUnits);
  const committed = usdc(BigInt(state.records.length) * DEMO.entitlementBaseUnits);
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div className="tinylabel" style={{ margin: 0 }}>Program #{state.program.programId}</div>
        <span className="statuspill"><span className="d" /> Live</span>
      </div>
      <div className="peek-stats">
        <PeekStat label="Recipients" value={String(state.records.length)} accent />
        <PeekStat label="Amount each" value={`${each} USDC`} />
        <PeekStat label="Committed" value={`${committed} USDC`} />
      </div>
      <div className="divider" />
      <div className="tinylabel">Recipients</div>
      <div className="peek-list">
        {state.records.slice(0, 6).map((r, i) => (
          <div className="peek-row" key={i}>
            <span className="peek-row-i">{i}</span>
            <span className="peek-row-n">{r.name}</span>
            <span className="peek-row-a tnum">{usdc(r.entitlement)} USDC</span>
          </div>
        ))}
        {state.records.length > 6 && (
          <div className="peek-row peek-row-more">+{state.records.length - 6} more recipients</div>
        )}
      </div>
      <button className="primary" style={{ width: '100%', marginTop: 16 }} onClick={onExpand}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
          Manage all recipients <IconArrow size={14} />
        </span>
      </button>
    </>
  );
}

function AuditPeek({ onExpand }: { onExpand: () => void }) {
  return (
    <>
      <div className="callout" style={{ marginBottom: 14 }}>
        <b>Proven, not trusted.</b> Every claim left a private note on the ledger that only your key can
        open — reconstruct who was paid without any recipient list.
      </div>
      <PrivacyLens height={172} />
      <p className="note" style={{ margin: '14px 0' }}>
        The public sees the left side: redacted, unlinkable. You see the right: decrypted, exact.
      </p>
      <button className="primary" style={{ width: '100%' }} onClick={onExpand}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'center' }}>
          Open full audit <IconArrow size={14} />
        </span>
      </button>
    </>
  );
}

function ProfilePeek({ store, deployment, onHome }: { store: DemoStore; deployment: Deployment; onHome: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="peek-profile">
        <div className="peek-avatar"><Logo size={26} /></div>
        <div>
          <div className="peek-profile-name">Aid organization</div>
          <div className="t-small">Stellar testnet · operator</div>
        </div>
      </div>
      <div className="divider" />
      <Meta label="Pool contract"><span className="mono">{deployment.poolContractId.slice(0, 8)}…{deployment.poolContractId.slice(-6)}</span></Meta>
      <Meta label="USDC token"><span className="mono">{deployment.usdcTokenId.slice(0, 8)}…{deployment.usdcTokenId.slice(-6)}</span></Meta>
      <div className="divider" />
      <div className="peek-actionlist">
        <button
          className="peek-action"
          onClick={() => {
            navigator.clipboard?.writeText(deployment.poolContractId);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          {copied ? 'Copied' : 'Copy pool contract ID'}
        </button>
        <a className="peek-action" href={explorerContract(deployment.poolContractId)} target="_blank" rel="noreferrer">
          <IconArrow size={16} /> View pool on explorer
        </a>
        <button className="peek-action" onClick={store.reset}>
          <Logo size={16} /> Start a new session
        </button>
        <button className="peek-action" onClick={onHome}>
          <IconHome size={16} /> Back to home
        </button>
      </div>
    </>
  );
}

function PeekStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="peek-stat">
      <div className="peek-stat-l">{label}</div>
      <div className={`peek-stat-v ${accent ? 'accent' : ''}`}>{value}</div>
    </div>
  );
}
