// Thin wrapper over the generated pool bindings + a few classic/token helpers.
// Framework-agnostic so both the e2e harness (Node) and the React surfaces
// (browser, in-app keypairs) drive the exact same client code.
//
// Every RPC operation is wrapped in `withRetry` because transient DNS/network
// blips are common; all failures here happen during simulate/assemble (before
// submission), so retrying the whole operation is safe.
import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  contract,
} from '@stellar/stellar-sdk';
import { Client as PoolContract, type Proof } from '../bindings/pool/src/index.js';
import { NETWORK } from './config.js';

export { Keypair };

const TRANSIENT =
  /ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|ECONNRESET|ECONNREFUSED|socket hang up|network|timeout|Account not found|502|503|504|destructure/i;

export async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!TRANSIENT.test(msg) || i === attempts - 1) throw e;
      await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
    }
  }
  throw lastErr;
}

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/, ''), 'hex');
}
export function bufToHex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

export interface ProofHex {
  a: string;
  b: string;
  c: string;
}

function proofFromHex(p: ProofHex): Proof {
  return { a: hexToBuffer(p.a), b: hexToBuffer(p.b), c: hexToBuffer(p.c) };
}

function rpcServer(): rpc.Server {
  return new rpc.Server(NETWORK.rpcUrl);
}

/** A pool contract client bound to a keypair signer (works in Node and browser). */
export function poolClient(contractId: string, keypair: Keypair): PoolContract {
  const signer = contract.basicNodeSigner(keypair, NETWORK.networkPassphrase);
  return new PoolContract({
    contractId,
    networkPassphrase: NETWORK.networkPassphrase,
    rpcUrl: NETWORK.rpcUrl,
    publicKey: keypair.publicKey(),
    signTransaction: signer.signTransaction,
  });
}

function txHash(sent: {
  getTransactionResponse?: { txHash?: string };
  sendTransactionResponse?: { hash?: string };
}): string {
  return sent.getTransactionResponse?.txHash ?? sent.sendTransactionResponse?.hash ?? '';
}

// ----------------------------- writes -----------------------------

export interface CreateProgramArgs {
  programId: number;
  merkleRootHex: string;
  allowedRegion: number;
  minBirthYear: number;
  requiredTier: number;
}

export async function createProgram(
  kp: Keypair,
  contractId: string,
  p: CreateProgramArgs,
): Promise<string> {
  return withRetry('create_program', async () => {
    const c = poolClient(contractId, kp);
    const tx = await c.create_program({
      program_id: p.programId,
      merkle_root: hexToBuffer(p.merkleRootHex),
      allowed_region: p.allowedRegion,
      min_birth_year: p.minBirthYear,
      required_tier: p.requiredTier,
    });
    return txHash(await tx.signAndSend());
  });
}

export async function fundPool(
  kp: Keypair,
  contractId: string,
  from: string,
  amount: bigint,
): Promise<string> {
  return withRetry('fund', async () => {
    const c = poolClient(contractId, kp);
    const tx = await c.fund({ from, amount });
    return txHash(await tx.signAndSend());
  });
}

export interface ClaimArgs {
  programId: number;
  nullifierHashHex: string;
  recipient: string;
  payoutAmount: bigint;
  proof: ProofHex;
  memoHex: string; // encrypted audit memo (opaque on-chain; donor view-key decrypts)
}

/** Submit a claim. The submitter `kp` only pays the fee — the proof authorizes. */
export async function claim(kp: Keypair, contractId: string, p: ClaimArgs): Promise<string> {
  return withRetry('claim', async () => {
    const c = poolClient(contractId, kp);
    const tx = await c.claim({
      program_id: p.programId,
      nullifier_hash: hexToBuffer(p.nullifierHashHex),
      recipient: p.recipient,
      payout_amount: p.payoutAmount,
      proof: proofFromHex(p.proof),
      memo: hexToBuffer(p.memoHex),
    });
    return txHash(await tx.signAndSend());
  });
}

/** The on-chain encrypted audit memos (hex), decryptable only by the donor view key. */
export async function claimMemos(contractId: string, kp: Keypair, programId: number): Promise<string[]> {
  return withRetry('claim_memos', async () => {
    const c = poolClient(contractId, kp);
    const res = (await c.claim_memos({ program_id: programId })).result;
    return res.map((b) => bufToHex(b));
  });
}

// ----------------------------- reads ------------------------------

export async function isSpent(
  contractId: string,
  kp: Keypair,
  programId: number,
  nullifierHashHex: string,
): Promise<boolean> {
  return withRetry('is_spent', async () => {
    const c = poolClient(contractId, kp);
    return (
      await c.is_spent({ program_id: programId, nullifier_hash: hexToBuffer(nullifierHashHex) })
    ).result;
  });
}

export async function spentNullifiers(
  contractId: string,
  kp: Keypair,
  programId: number,
): Promise<string[]> {
  return withRetry('spent_nullifiers', async () => {
    const c = poolClient(contractId, kp);
    const res = (await c.spent_nullifiers({ program_id: programId })).result;
    return res.map((b) => bufToHex(b));
  });
}

export async function poolBalance(contractId: string, kp: Keypair): Promise<bigint> {
  return withRetry('pool_balance', async () => {
    const c = poolClient(contractId, kp);
    return (await c.pool_balance()).result;
  });
}

export async function getProgram(contractId: string, kp: Keypair, programId: number) {
  return withRetry('get_program', async () => {
    const c = poolClient(contractId, kp);
    return (await c.get_program({ program_id: programId })).result;
  });
}

// --------------------- token / classic helpers --------------------

export async function fundWithFriendbot(publicKey: string): Promise<void> {
  return withRetry('friendbot', async () => {
    const r = await fetch(`${NETWORK.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`);
    if (!r.ok && r.status !== 400) throw new Error(`friendbot status ${r.status}`); // 400 == already funded
  });
}

/**
 * Create + fund a brand-new account via a classic createAccount op from
 * `funder`. Fallback for when the friendbot faucet is unreachable. (In
 * production, fresh wallets would be funded by a relayer, not the org.)
 */
export async function createFundedAccount(funder: Keypair, startingXlm = '5'): Promise<Keypair> {
  const kp = Keypair.random();
  await withRetry('createAccount', async () => {
    const server = rpcServer();
    const acct = await server.getAccount(funder.publicKey());
    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(
        Operation.createAccount({ destination: kp.publicKey(), startingBalance: startingXlm }),
      )
      .setTimeout(60)
      .build();
    tx.sign(funder);
    const sent = await server.sendTransaction(tx);
    await pollTx(server, sent.hash);
  });
  return kp;
}

/**
 * Real-deployment zero-gas onboarding: a RELAYER creates the beneficiary's
 * fresh account and its USDC trustline using Stellar **sponsored reserves**, so
 * the beneficiary holds no XLM and never needs to acquire crypto. The relayer
 * pays the fee and the base reserves; the fresh account only co-signs to
 * authorize its own trustline. In production the relayer is a server-side
 * service; here it is a funded relayer keypair.
 */
export async function sponsorFreshAccount(
  relayer: Keypair,
  fresh: Keypair,
  issuer: string,
): Promise<void> {
  return withRetry('sponsorFresh', async () => {
    const server = rpcServer();
    const relayerAccount = await server.getAccount(relayer.publicKey());
    const usdc = new Asset('USDC', issuer);
    const tx = new TransactionBuilder(relayerAccount, {
      fee: String(Number(BASE_FEE) * 20),
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: fresh.publicKey() }))
      .addOperation(Operation.createAccount({ destination: fresh.publicKey(), startingBalance: '0' }))
      .addOperation(Operation.changeTrust({ asset: usdc, source: fresh.publicKey() }))
      .addOperation(Operation.endSponsoringFutureReserves({ source: fresh.publicKey() }))
      .setTimeout(120)
      .build();
    tx.sign(relayer, fresh); // relayer: fee + reserves; fresh: authorizes its trustline
    const sent = await server.sendTransaction(tx);
    await pollTx(server, sent.hash);
  });
}

/** XLM balance (stroops as a decimal string is returned by Horizon as native). */
export async function xlmBalance(accountId: string): Promise<number> {
  return withRetry('xlmBalance', async () => {
    const r = await fetch(`${NETWORK.horizonUrl}/accounts/${accountId}`);
    if (r.status === 404) return 0;
    if (!r.ok) throw new Error(`horizon ${r.status}`);
    const j = (await r.json()) as { balances?: { asset_type: string; balance: string }[] };
    const native = (j.balances ?? []).find((b) => b.asset_type === 'native');
    return native ? parseFloat(native.balance) : 0;
  });
}

/** A fresh classic account must trust the USDC asset before it can receive it. */
export async function addUsdcTrustline(kp: Keypair, issuer: string): Promise<void> {
  return withRetry('changeTrust', async () => {
    const server = rpcServer();
    const account = await server.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: new Asset('USDC', issuer) }))
      .setTimeout(60)
      .build();
    tx.sign(kp);
    const sent = await server.sendTransaction(tx);
    await pollTx(server, sent.hash);
  });
}

async function pollTx(server: rpc.Server, hash: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const r = await server.getTransaction(hash);
    if (r.status === 'SUCCESS') return;
    if (r.status === 'FAILED') throw new Error(`tx ${hash} failed`);
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`tx ${hash} not confirmed in time`);
}

interface HorizonBalance {
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

/**
 * USDC balance (base units) for a classic account, via Horizon. We avoid
 * `contract.Client.from` on the token because a Stellar Asset Contract has no
 * wasm, so the SDK's wasm fetch trips over an undefined hash.
 */
export async function usdcBalance(issuer: string, accountId: string): Promise<bigint> {
  return withRetry('usdcBalance', async () => {
    const r = await fetch(`${NETWORK.horizonUrl}/accounts/${accountId}`);
    if (r.status === 404) return 0n; // account not created yet
    if (!r.ok) throw new Error(`horizon ${r.status}`);
    const j = (await r.json()) as { balances?: HorizonBalance[] };
    const row = (j.balances ?? []).find(
      (b) => b.asset_code === 'USDC' && b.asset_issuer === issuer,
    );
    if (!row) return 0n;
    const [whole, frac = ''] = row.balance.split('.');
    return BigInt(whole) * 10_000_000n + BigInt(frac.padEnd(7, '0').slice(0, 7));
  });
}

export function newAccount(): Keypair {
  return Keypair.random();
}
