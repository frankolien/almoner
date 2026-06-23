import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { DemoStore } from '../lib/store.js';
import type { Deployment } from '../lib/config.js';
import { DEMO } from '../lib/demo.js';
import { apiSpent } from '../lib/serverApi.js';
import { usdc } from '../lib/ui.js';
import { useStagger, StatNum } from '../lib/motion.js';
import { ArtShield, ArtCoins, ArtMerkle, ArtRoutes } from '../lib/cardArt.js';
import { Donut } from '../lib/Charts.js';
import { PrivacyLens } from '../lib/PrivacyLens.js';
import { greeting } from '../lib/greeting.js';
import { IconUsers, IconWallet, IconProof, IconEye, IconLayers, IconArrow, IconPlus } from '../landing/icons.js';
import type { View } from '../App.js';
import type { PeekKind } from '../components/Peek.js';

const f2 = (n: number) => n.toFixed(2);

const FLOW: [string, string][] = [
  ['Register', 'Org commits the eligible cohort — only the root goes on-chain.'],
  ['Issue links', 'Each recipient gets a private, single-use claim credential.'],
  ['Claim', 'They prove eligibility on-device; USDC lands in a fresh wallet, gas-free.'],
  ['Audit', 'The donor reconstructs who was paid — invisible to everyone else.'],
];

export default function Dashboard({
  store,
  deployment,
  onNavigate,
  onPeek,
}: {
  store: DemoStore;
  deployment: Deployment;
  onNavigate: (v: View) => void;
  onPeek: (k: PeekKind) => void;
}) {
  const { state } = store;
  const [claimed, setClaimed] = useState<number | null>(null);
  const ref = useStagger<HTMLDivElement>([]);

  const live = state.createdOnChain && !!state.program;
  const recipients = live ? state.records.length : DEMO.cohortSize;
  const each = DEMO.entitlementBaseUnits;
  const eachWhole = Number(each) / 1e7;
  const committedWhole = recipients * eachWhole;
  const disbursedBase = claimed != null ? BigInt(claimed) * each : 0n;

  useEffect(() => {
    let alive = true;
    setClaimed(null);
    if (!state.program) return;
    apiSpent(Number(state.program.programId))
      .then((s) => alive && setClaimed(s.length))
      .catch(() => alive && setClaimed(0));
    return () => {
      alive = false;
    };
  }, [state.program?.programId]);

  const claimedNode: ReactNode = !live ? (
    '—'
  ) : claimed == null ? (
    <span className="skel skel-kpi" />
  ) : (
    <StatNum to={claimed} />
  );

  return (
    <div className="dash-wrap" ref={ref}>
      <div className="dash-hero reveal" style={{ '--i': 0 } as CSSProperties}>
          <div>
            <div className="greet">
              {greeting()}
              <span className="wave">.</span>
            </div>
            <div className="ctx">
              {live
                ? `Program #${state.program!.programId} is live — ${recipients} recipients, ${f2(committedWhole)} USDC committed. Send claim links or open the donor audit.`
                : "Let's set up your first private disbursement. Create a program to begin — we handle the cryptography."}
            </div>
          </div>
          <div className="row">
            <button className="primary" onClick={() => onPeek('programs')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {live ? 'Manage recipients' : (<><IconPlus size={16} /> Create a program</>)}
              </span>
            </button>
            <button className="ghost" onClick={() => onPeek('audit')}>
              Open donor audit
            </button>
          </div>
        </div>

        <div className="dash">
          <div className="dash-main">
        <div className="statcards">
          <Card i={1} icon={<IconUsers size={15} />} label="Recipients" art={<ArtShield />} cardClass="is-hero" vClass="accent"
            value={<StatNum to={recipients} />} />
          <Card i={2} icon={<IconMerkleish />} label="Amount each" art={<ArtMerkle />}
            value={<><StatNum to={eachWhole} format={f2} /> USDC</>} />
          <Card i={3} icon={<IconWallet size={15} />} label="Committed" art={<ArtCoins />}
            value={<><StatNum to={committedWhole} format={f2} /> USDC</>}
            detail={`${recipients} × ${f2(eachWhole)}`} />
          <Card i={4} icon={<IconProof size={15} />} label="Claimed" art={<ArtRoutes />} cardClass="is-success" vClass="green"
            value={claimedNode}
            detail={live && claimed != null ? `${usdc(disbursedBase)} USDC disbursed` : 'awaiting claims'} />
        </div>

        <div className="panel reveal" style={{ '--i': 5 } as CSSProperties}>
          <div className="tinylabel">The core idea</div>
          <p className="sub" style={{ marginBottom: 16 }}>
            Drag the seam — the same claim, two truths. The public sees an unlinkable, redacted record; the
            donor (and only the donor) can decrypt exactly who was paid.
          </p>
          <PrivacyLens />
        </div>

        <div className="panel reveal" style={{ '--i': 6 } as CSSProperties}>
          <div className="tinylabel">How a disbursement flows</div>
          <div className="flow">
            {FLOW.map(([t, s], i) => (
              <div className="flow-step" key={t}>
                <div className="top">
                  <span className="n">0{i + 1}</span>
                  <span className="ti">{t}</span>
                </div>
                <div className="note" style={{ margin: 0 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="rail">
        <div className="railcard reveal" style={{ '--i': 2 } as CSSProperties}>
          <div className="t" style={{ marginBottom: 14 }}>Claim progress</div>
          <Donut value={claimed ?? 0} total={recipients} label={`${claimed ?? 0} of ${recipients} claimed`} />
        </div>
        <div className="railcard promo reveal" style={{ '--i': 3 } as CSSProperties}>
          <div className="ic"><IconEye size={18} /></div>
          <div className="t">Provable to the donor</div>
          <div className="s">
            Every claim leaves an encrypted note only the donor's key can open — reconstruct the full
            picture without any recipient list.
          </div>
          <button className="more" onClick={() => onPeek('audit')}>
            Open donor audit <IconArrow size={13} />
          </button>
        </div>
        <div className="railcard proof reveal" style={{ '--i': 4 } as CSSProperties}>
          <div className="ic"><IconLayers size={18} /></div>
          <div className="t">Under the hood</div>
          <div className="s">
            Groth16 proofs over BN254, verified on-chain by a Soroban contract. See exactly what settles.
          </div>
          <button className="more" onClick={() => onNavigate('tech')}>
            View the details <IconArrow size={13} />
          </button>
        </div>
        <div className="railcard reveal" style={{ '--i': 5 } as CSSProperties}>
          <div className="t" style={{ fontSize: 13 }}>Network</div>
          <div className="s" style={{ marginBottom: 0 }}>
            Stellar testnet · USDC<br />
            Pool <span className="mono">{deployment.poolContractId.slice(0, 6)}…{deployment.poolContractId.slice(-4)}</span>
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}

function Card({
  i,
  icon,
  label,
  value,
  detail,
  art,
  cardClass,
  vClass,
}: {
  i: number;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: string;
  art?: ReactNode;
  cardClass?: string;
  vClass?: string;
}) {
  return (
    <div className={`statcard reveal ${cardClass ?? ''}`} style={{ '--i': i } as CSSProperties}>
      <div className="l">
        <span className="ic">{icon}</span>
        {label}
      </div>
      <div className={`v ${vClass ?? ''}`}>{value}</div>
      {detail && <div className="d">{detail}</div>}
      {art}
    </div>
  );
}

// small inline merkle/hash glyph for the "Amount each" KPI label
const IconMerkleish = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3L8 21M16 3l-2 18M3.5 9h17M2.5 15h17" />
  </svg>
);
