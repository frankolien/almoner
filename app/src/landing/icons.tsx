// Small inline icon set (stroke-based, inherit currentColor).
type P = { size?: number };
const base = (size = 20) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconProof = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3l7 4v5c0 4.2-2.8 7.5-7 9-4.2-1.5-7-4.8-7-9V7l7-4z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconHash = ({ size }: P) => (
  <svg {...base(size)}><path d="M10 3L8 21M16 3l-2 18M3.5 9h17M2.5 15h17" /></svg>
);
export const IconChip = ({ size }: P) => (
  <svg {...base(size)}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></svg>
);
export const IconWallet = ({ size }: P) => (
  <svg {...base(size)}><path d="M3 7a2 2 0 012-2h11a2 2 0 012 2v1" /><path d="M3 7v10a2 2 0 002 2h13a2 2 0 002-2v-6a2 2 0 00-2-2H5" /><circle cx="16" cy="13" r="1.3" /></svg>
);
export const IconEye = ({ size }: P) => (
  <svg {...base(size)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconLayers = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5M3 18l9 5 9-5" /></svg>
);
export const IconArrow = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconPlus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconStar = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M12 2l2 7h7l-5.5 4 2 7-5.5-4-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
  </svg>
);

export const IconGrid = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
);
export const IconDoc = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 2h7l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" /><path d="M13 2v5h5M8 13h8M8 17h5" /></svg>
);
export const IconUsers = ({ size }: P) => (
  <svg {...base(size)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0111 0" /><path d="M16 5.2a3.2 3.2 0 010 5.6M17.5 20a5.5 5.5 0 00-2.2-4.4" /></svg>
);
export const IconHome = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 11l8-7 8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></svg>
);
export const IconSearch = ({ size }: P) => (
  <svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);
export const IconCopy = ({ size }: P) => (
  <svg {...base(size)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>
);
export const IconQR = ({ size }: P) => (
  <svg {...base(size)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-7" /></svg>
);
export const IconCheck = ({ size }: P) => (
  <svg {...base(size)}><path d="M4 12l5 5L20 6" /></svg>
);
export const IconSend = ({ size }: P) => (
  <svg {...base(size)}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
);

export const Logo = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <g
      className="logo-rays"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    >
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2" />
    </g>
    <circle
      className="logo-core"
      cx="12"
      cy="12"
      r="2.4"
      fill="#ff6240"
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
    />
  </svg>
);
