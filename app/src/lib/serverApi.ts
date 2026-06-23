// Frontend client for the Almoner backend. The browser holds NO keys — every
// chain-signing operation goes through the server (relayer + operator). The
// privacy-critical proof is still generated on-device and only posted here.
import type { ProofHex } from './pool.js';
import { API_BASE } from './config.js';

// In dev/same-origin this is `/api` (Vite proxy → backend). In a split deploy
// it's `https://<backend>/api` (Vercel frontend → Railway backend).
const API = `${API_BASE}/api`;

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
  auditorPublicKey: string;
  network: string;
}

export const apiConfig = () => get<ServerConfig>('/config');

// Demo-only: the auditor surface fetches its view (secret) key. Production: the
// donor holds it; it never leaves their device.
export const apiViewKey = async () => (await get<{ secretKey: string }>('/auditor-viewkey')).secretKey;

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
  memoHex: string;
}
export const apiClaim = (b: ClaimBody) =>
  post<{ txHash: string }>('/claim', { ...b, payoutAmount: b.payoutAmount.toString() });

export const apiSpent = async (programId: number): Promise<string[]> =>
  (await get<{ spent: string[] }>(`/spent/${programId}`)).spent;

export const apiMemos = async (programId: number): Promise<string[]> =>
  (await get<{ memos: string[] }>(`/memos/${programId}`)).memos;

export const apiBalance = async (account: string): Promise<bigint> =>
  BigInt((await get<{ usdc: string }>(`/balance/${account}`)).usdc);
