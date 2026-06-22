// Stellar testnet configuration + deployment lookup.

export const NETWORK = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  friendbotUrl: 'https://friendbot.stellar.org',
  explorer: 'https://stellar.expert/explorer/testnet',
} as const;

export interface Deployment {
  poolContractId: string;
  usdcTokenId: string;
  adminPublicKey?: string;
  adminSecret?: string; // testnet-only convenience for the demo org account
  relayerPublicKey?: string;
  relayerSecret?: string; // pays fees + sponsors fresh accounts (server-side in prod)
  programId?: number;
}

// The deploy script writes app/public/deployment.json; the app reads it at
// runtime so a redeploy doesn't require rebuilding the frontend.
export async function loadDeployment(): Promise<Deployment | null> {
  try {
    const res = await fetch('/deployment.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Deployment;
  } catch {
    return null;
  }
}

export const explorerTx = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
export const explorerContract = (id: string) => `${NETWORK.explorer}/contract/${id}`;
export const explorerAccount = (id: string) => `${NETWORK.explorer}/account/${id}`;
