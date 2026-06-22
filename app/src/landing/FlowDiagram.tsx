// Animated hub-and-spoke of the Almoner protocol: the org commits a cohort root
// and funds the pool; a beneficiary sends a proof + claim; the pool pays a fresh
// wallet and the donor reconstructs totals. Flowing dots make it feel alive.

const PATHS = [
  { id: 'p1', d: 'M250,112 C322,122 344,196 390,208', label: 'cohort root + fund', lx: 300, ly: 150, dir: 1 },
  { id: 'p2', d: 'M250,404 C322,394 344,322 390,312', label: 'proof + claim', lx: 300, ly: 380, dir: 1 },
  { id: 'p3', d: 'M610,208 C682,198 690,124 750,112', label: 'USDC payout', lx: 700, ly: 150, dir: 1, warm: true },
  { id: 'p4', d: 'M610,312 C682,322 690,394 750,404', label: 'view-key recon', lx: 700, ly: 380, dir: 1 },
];

function Node({
  x,
  y,
  w,
  title,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={64} rx={12} className={`fd-node ${accent ? 'fd-accent' : ''}`} />
      <text x={x + 16} y={y + 27} className="fd-title">
        {title}
      </text>
      <text x={x + 16} y={y + 46} className="fd-sub">
        {sub}
      </text>
    </g>
  );
}

export default function FlowDiagram() {
  return (
    <svg className="flow-diagram" viewBox="0 0 1000 484" role="img" aria-label="Almoner protocol flow">
      <defs>
        <linearGradient id="fd-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#45c6d8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ff5c39" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="fd-pool" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#1a1d24" />
          <stop offset="100%" stopColor="#0e1015" />
        </radialGradient>
        <filter id="fd-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* connectors */}
      {PATHS.map((p) => (
        <g key={p.id}>
          <path id={p.id} d={p.d} className="fd-conn" />
          <path d={p.d} className="fd-flow" />
          <text x={p.lx} y={p.ly} className="fd-label" textAnchor="middle">
            {p.label}
          </text>
          <circle r="3.4" className={`fd-dot ${p.warm ? 'warm' : ''}`}>
            <animateMotion dur="2.6s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href={`#${p.id}`} />
            </animateMotion>
          </circle>
        </g>
      ))}

      {/* pool (center) */}
      <rect x="390" y="170" width="220" height="184" rx="16" fill="url(#fd-pool)" stroke="#2a2f3a" />
      <rect x="390" y="170" width="220" height="184" rx="16" className="fd-pool-glow" />
      <text x="500" y="198" className="fd-pool-title" textAnchor="middle">
        SOROBAN POOL
      </text>
      {['Merkle root', 'Nullifier set', 'USDC vault', 'BN254 verifier'].map((t, i) => (
        <g key={t}>
          <circle cx="412" cy={228 + i * 28} r="2.6" fill="#ff5c39" />
          <text x="424" y={232 + i * 28} className="fd-pool-row">
            {t}
          </text>
        </g>
      ))}

      <Node x={70} y={80} w={180} title="Org / Issuer" sub="registers cohort · funds" />
      <Node x={70} y={372} w={180} title="Beneficiary" sub="proves in-browser" />
      <Node x={750} y={80} w={180} title="Fresh wallet" sub="receives USDC · unlinkable" accent />
      <Node x={750} y={372} w={180} title="Auditor / Donor" sub="reconstructs totals" />
    </svg>
  );
}
