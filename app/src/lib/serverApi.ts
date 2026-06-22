// Frontend client for the Almoner backend. The browser holds NO keys — every
// chain-signing operation goes through the server (relayer + operator). The
// privacy-critical proof is still generated on-device and only posted here.
import type { ProofHex } from './pool.js';

const API = '/api';

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error ?? `request to ${path} failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`request to ${path} failed (${r.status})`);
  return r.json() as Promise<T>;
}

export interface ServerConfig {
  poolContractId: string;
  usdcTokenId: string;
  adminPublicKey: string;
  relayerPublicKey: string;
  network: string;
}

export const apiConfig = () => get<ServerConfig>('/config');

export interface CreateProgramBody {
  programId: number;
  merkleRootHex: string;
  allowedRegion: number;
  minBirthYear: number;
  requiredTier: number;
}
export const apiCreateProgram = (b: CreateProgramBody) => post<{ ok: true }>('/program', b);

export const apiFund = (amount: bigint) => post<{ ok: true }>('/fund', { amount: amount.toString() });

export const apiSponsor = () => post<{ freshPublicKey: string; freshSecret: string }>('/sponsor', {});

export interface ClaimBody {
  programId: number;
  nullifierHashHex: string;
  recipient: string;
  payoutAmount: bigint;
  proof: ProofHex;
}
export const apiClaim = (b: ClaimBody) =>
  post<{ txHash: string }>('/claim', { ...b, payoutAmount: b.payoutAmount.toString() });

export const apiSpent = async (programId: number): Promise<string[]> =>
  (await get<{ spent: string[] }>(`/spent/${programId}`)).spent;

export const apiBalance = async (account: string): Promise<bigint> =>
  BigInt((await get<{ usdc: string }>(`/balance/${account}`)).usdc);
