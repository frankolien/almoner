// Stellar testnet configuration + deployment lookup.

export const NETWORK = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  friendbotUrl: 'https://friendbot.stellar.org',
  explorer: 'https://stellar.expert/explorer/testnet',
} as const;

// Origin of the backend (relayer + operator API). Empty in local dev and on the
// server itself → same-origin, so the Vite dev proxy handles `/api`. In a split
// deploy (frontend on Vercel, backend on Railway) set `VITE_API_BASE` to the
// Railway URL (e.g. https://almoner.up.railway.app, no trailing slash) and the
// browser calls it directly (CORS is enabled server-side). The `import.meta`
// guard keeps this safe when the Node backend imports this module via pool.ts.
export const API_BASE: string =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE) || '';

export interface Deployment {
  poolContractId: string;
  usdcTokenId: string;
  adminPublicKey?: string;
  relayerPublicKey?: string;
  auditorPublicKey?: string;
  network?: string;
}

// Public config comes from the backend (/api/config) — no secrets ever reach
// the browser. Falls back to the committed public deployment.json if the
// backend isn't running (read-only display only; signing needs the server).
export async function loadDeployment(): Promise<Deployment | null> {
  try {
    const res = await fetch(`${API_BASE}/api/config`, { cache: 'no-store' });
    if (res.ok) return (await res.json()) as Deployment;
  } catch {
    /* backend not up — fall through */
  }
  try {
    const res = await fetch('/deployment.json', { cache: 'no-store' });
    if (res.ok) return (await res.json()) as Deployment;
  } catch {
    /* no public config */
  }
  return null;
}

export const explorerTx = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
export const explorerContract = (id: string) => `${NETWORK.explorer}/contract/${id}`;
export const explorerAccount = (id: string) => `${NETWORK.explorer}/account/${id}`;
