// Orchestration shared by the surfaces. The org registers + funds + issues
// credentials; the beneficiary claims from a credential with the relayer
// sponsoring all gas; the auditor reconstructs. Thin glue over @almoner/lib
// (crypto/proving) and ./pool (the on-chain client validated by scripts/e2e.ts).
import {
  issueBeneficiary,
  buildCohort,
  buildClaimInputFromPath,
  generateProof,
  reconstruct,
  bytesToField,
  fieldToBytes32,
  proofToSorobanBytes,
  type BeneficiaryRecord,
  type AuditReport,
} from '@almoner/lib';
import { StrKey } from '@stellar/stellar-sdk';
import {
  Keypair,
  createProgram,
  fundPool,
  claim,
  spentNullifiers,
  sponsorFreshAccount,
  usdcBalance,
  xlmBalance,
} from './pool.js';
import type { Deployment } from './config.js';
import type { DemoStore, StoredRecord, ProgramMeta } from './store.js';
import { credToRecord, credToPolicy, type Credential } from './credential.js';

const WASM_URL = '/circuit/aid_claim.wasm';
const ZKEY_URL = '/circuit/aid_claim.zkey';

export const DEMO = {
  region: 963,
  regionLabel: 'Eligible region (demo cohort)',
  tier: 1,
  minBirthYear: 2008,
  entitlementBaseUnits: 100_0000000n, // 100 USDC
  cohortSize: 5,
};

export type Logger = (msg: string, kind?: 'step' | 'ok' | 'err' | 'info') => void;
const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

export const orgKeypair = (d: Deployment): Keypair => Keypair.fromSecret(d.adminSecret!);
export const relayerKeypair = (d: Deployment): Keypair =>
  Keypair.fromSecret((d.relayerSecret ?? d.adminSecret)!);

const NAMES = ['Amara', 'Bilal', 'Carmen', 'Dawit', 'Esra', 'Farid', 'Gita', 'Hassan'];

export function toRecord(r: StoredRecord): BeneficiaryRecord {
  return {
    secret: BigInt(r.secret),
    nullifier: BigInt(r.nullifier),
    regionCode: BigInt(r.regionCode),
    programTier: BigInt(r.programTier),
    birthYear: BigInt(r.birthYear),
    kycFlag: BigInt(r.kycFlag),
    entitlement: BigInt(r.entitlement),
  };
}

function storeRecord(r: BeneficiaryRecord, name: string): StoredRecord {
  return {
    secret: r.secret.toString(),
    nullifier: r.nullifier.toString(),
    regionCode: r.regionCode.toString(),
    programTier: r.programTier.toString(),
    birthYear: r.birthYear.toString(),
    kycFlag: r.kycFlag.toString(),
    entitlement: r.entitlement.toString(),
    name,
  };
}

function freshProgramId(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return 1000 + (a[0] % 9_000_000);
}

/** Org: issue a cohort, commit the Merkle root on-chain, register the program. */
export async function registerCohort(store: DemoStore, d: Deployment, log: Logger): Promise<void> {
  log('Issuing beneficiary secrets and computing leaf commitments…', 'step');
  const records: BeneficiaryRecord[] = Array.from({ length: DEMO.cohortSize }, (_, i) =>
    issueBeneficiary({
      regionCode: DEMO.region,
      programTier: DEMO.tier,
      birthYear: 1980 + i,
      kycFlag: 1,
      entitlement: DEMO.entitlementBaseUnits,
    }),
  );
  const { root } = await buildCohort(records);
  const merkleRootHex = hex(fieldToBytes32(root));
  const programId = freshProgramId();
  log(`Cohort root ${merkleRootHex.slice(0, 16)}… built (${DEMO.cohortSize} beneficiaries)`, 'info');

  log(`Posting root + policy on-chain (program #${programId})…`, 'step');
  await createProgram(orgKeypair(d), d.poolContractId, {
    programId,
    merkleRootHex,
    allowedRegion: DEMO.region,
    minBirthYear: DEMO.minBirthYear,
    requiredTier: DEMO.tier,
  });

  const program: ProgramMeta = {
    programId: String(programId),
    allowedRegion: String(DEMO.region),
    regionLabel: DEMO.regionLabel,
    minBirthYear: String(DEMO.minBirthYear),
    requiredTier: String(DEMO.tier),
    entitlement: DEMO.entitlementBaseUnits.toString(),
  };
  store.update({
    program,
    records: records.map((r, i) => storeRecord(r, NAMES[i % NAMES.length])),
    root: root.toString(),
    createdOnChain: true,
    claims: [],
  });
  log('Program registered. Issue claim credentials to your beneficiaries.', 'ok');
}

/** Org/donor: fund the USDC pool. */
export async function fundProgram(store: DemoStore, d: Deployment, usdcWhole: number, log: Logger): Promise<void> {
  const amount = BigInt(Math.round(usdcWhole * 1e7));
  log(`Funding pool with ${usdcWhole} USDC…`, 'step');
  await fundPool(orgKeypair(d), d.poolContractId, orgKeypair(d).publicKey(), amount);
  store.update((s) => ({ ...s, fundedAmount: (BigInt(s.fundedAmount) + amount).toString() }));
  log('Pool funded.', 'ok');
}

export interface ClaimResult {
  freshPublicKey: string;
  freshSecret: string;
  txHash: string;
  nullifierHashHex: string;
  usdcReceived: bigint;
}

async function proveFor(cred: Credential, freshPublicKey: string) {
  const record = credToRecord(cred);
  const policy = credToPolicy(cred);
  const recipientField = bytesToField(new Uint8Array(StrKey.decodeEd25519PublicKey(freshPublicKey)));
  const path = {
    pathElements: cred.path.pathElements.map(BigInt),
    pathIndices: cred.path.pathIndices.map(BigInt),
    root: BigInt(cred.path.root),
  };
  const { input, nullifierHash } = await buildClaimInputFromPath({ record, policy, recipientField, path });
  const { proof } = await generateProof(input, WASM_URL, ZKEY_URL);
  const sb = proofToSorobanBytes(proof);
  return {
    nullifierHashHex: hex(fieldToBytes32(nullifierHash)),
    proofHex: { a: hex(sb.a), b: hex(sb.b), c: hex(sb.c) },
  };
}

/** Beneficiary: claim from a credential. The relayer sponsors all gas. */
export async function claimFromCredential(cred: Credential, d: Deployment, log: Logger): Promise<ClaimResult> {
  const relayer = relayerKeypair(d);
  const issuer = d.adminPublicKey!;

  log('Creating a fresh, unlinkable wallet — gas sponsored, you pay nothing…', 'step');
  const fresh = Keypair.random();
  await sponsorFreshAccount(relayer, fresh, issuer);
  log(`Fresh wallet ${fresh.publicKey().slice(0, 10)}… ready (you hold 0 XLM).`, 'info');

  log('Generating your Groth16 proof on this device…', 'step');
  const t0 = performance.now();
  const { nullifierHashHex, proofHex } = await proveFor(cred, fresh.publicKey());
  log(`Proof generated in ${Math.round(performance.now() - t0)}ms — your secret never left this device.`, 'info');

  log('Submitting — proof verified on-chain by the Soroban pool…', 'step');
  const txHash = await claim(relayer, d.poolContractId, {
    programId: cred.programId,
    nullifierHashHex,
    recipient: fresh.publicKey(),
    payoutAmount: BigInt(cred.entitlement),
    proof: proofHex,
  });
  const usdcReceived = await usdcBalance(issuer, fresh.publicKey());
  log('USDC delivered to your fresh wallet.', 'ok');

  return {
    freshPublicKey: fresh.publicKey(),
    freshSecret: fresh.secret(),
    txHash,
    nullifierHashHex,
    usdcReceived,
  };
}

/** Beneficiary: a second claim from the same credential — must be rejected. */
export async function reclaimFromCredential(cred: Credential, d: Deployment, log: Logger): Promise<boolean> {
  const relayer = relayerKeypair(d);
  const issuer = d.adminPublicKey!;
  const fresh = Keypair.random();
  await sponsorFreshAccount(relayer, fresh, issuer);
  log('Re-proving to a brand-new wallet and trying to claim again…', 'step');
  const { nullifierHashHex, proofHex } = await proveFor(cred, fresh.publicKey());
  try {
    await claim(relayer, d.poolContractId, {
      programId: cred.programId,
      nullifierHashHex,
      recipient: fresh.publicKey(),
      payoutAmount: BigInt(cred.entitlement),
      proof: proofHex,
    });
    log('Unexpected: the second claim was accepted.', 'err');
    return false;
  } catch {
    log("Rejected — same nullifier, already spent. “We don’t know who you are, but you already claimed.”", 'ok');
    return true;
  }
}

export async function freshXlm(pk: string): Promise<number> {
  return xlmBalance(pk);
}

/** Auditor: reconstruct who claimed from the on-chain spent set + registration table. */
export async function runAudit(store: DemoStore, d: Deployment): Promise<AuditReport> {
  const s = store.state;
  if (!s.program) throw new Error('no program registered');
  const records = s.records.map(toRecord);
  const spent = (await spentNullifiers(d.poolContractId, orgKeypair(d), Number(s.program.programId))).map(
    (h) => BigInt('0x' + h),
  );
  return reconstruct(records, BigInt(s.program.programId), spent);
}
