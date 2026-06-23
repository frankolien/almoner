import type { ReactNode } from 'react';

// Faint background line-art that bleeds off the bottom-right of KPI cards.
const wrap = (children: ReactNode) => (
  <svg
    className="statcard-art"
    viewBox="0 0 120 120"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.25}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);

export const ArtShield = () =>
  wrap(
    <>
      <path d="M60 14l34 14v22c0 22-15 36-34 44-19-8-34-22-34-44V28z" />
      <path d="M44 58l12 12 22-24" />
    </>,
  );

export const ArtCoins = () =>
  wrap(
    <>
      <ellipse cx="60" cy="40" rx="30" ry="12" />
      <path d="M30 40v16c0 6.6 13.4 12 30 12s30-5.4 30-12V40" />
      <path d="M30 56v16c0 6.6 13.4 12 30 12s30-5.4 30-12V56" />
    </>,
  );

export const ArtMerkle = () =>
  wrap(
    <>
      <circle cx="60" cy="22" r="7" />
      <circle cx="34" cy="60" r="7" />
      <circle cx="86" cy="60" r="7" />
      <circle cx="22" cy="96" r="6" />
      <circle cx="46" cy="96" r="6" />
      <circle cx="74" cy="96" r="6" />
      <circle cx="98" cy="96" r="6" />
      <path d="M55 28l-16 26M65 28l16 26M30 66l-6 24M38 66l6 24M82 66l-6 24M90 66l6 24" />
    </>,
  );

export const ArtRoutes = () =>
  wrap(
    <>
      <circle cx="24" cy="60" r="8" />
      <circle cx="96" cy="32" r="6" />
      <circle cx="96" cy="88" r="6" />
      <path d="M32 56l54-22M32 64l54 22" strokeDasharray="3 5" />
      <path d="M83 28l8 4-2 8M83 92l8-4-2-8" />
    </>,
  );
