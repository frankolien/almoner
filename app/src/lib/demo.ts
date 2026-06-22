// Orchestration shared by the three surfaces: register a cohort, prove + claim
// in-browser, and reconstruct as the auditor. Thin glue over @almoner/lib
// (crypto/proving) and ./pool (the on-chain client validated by scripts/e2e.ts).
import {
  issueBeneficiary,
  buildCohort,
  buildClaimInput,
  generateProof,
  reconstruct,
  bytesToField,
  fieldToBytes32,
  proofToSorobanBytes,
  type BeneficiaryRecord,
  type ProgramPolicy,
  type AuditReport,
} from '@almoner/lib';
import { StrKey } from '@stellar/stellar-sdk';
import {
  Keypair,
  createProgram,
  fundPool,
  claim,
  spentNullifiers,
  fundWithFriendbot,
  createFundedAccount,
  addUsdcTrustline,
  usdcBalance,
} from './pool.js';
import type { Deployment } from './config.js';
import type { DemoStore, StoredRecord, ProgramMeta } from './store.js';

// In-browser proving: snarkjs fetches these from app/public/circuit.
const WASM_URL = '/circuit/aid_claim.wasm';
const ZKEY_URL = '/circuit/aid_claim.zkey';

// Fixed demo policy — identity-private, amount standardized per tier.
export const DEMO = {
  region: 963,
  regionLabel: 'Eligible region (demo cohort)',
  tier: 1,
  minBirthYear: 2008, // born in/before 2008 => >= 18 in 2026
  entitlementBaseUnits: 100_0000000n, // 100 USDC
  cohortSize: 5,
};

export type Logger = (msg: string, kind?: 'step' | 'ok' | 'err' | 'info') => void;

export const orgKeypair = (d: Deployment): Keypair => Keypair.fromSecret(d.adminSecret!);

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
  // small u32, unlikely to collide across demo runs
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return 1000 + (a[0] % 9_000_000);
}

/** Org: issue a cohort, commit the Merkle root on-chain, register the program. */
export async function registerCohort(
  store: DemoStore,
  d: Deployment,
  log: Logger,
): Promise<void> {
  log('Issuing beneficiary secrets and computing leaf commitments…', 'step');
  const records: BeneficiaryRecord[] = Array.from({ length: DEMO.cohortSize }, (_, i) =>
    issueBeneficiary({
      regionCode: DEMO.region,
      programTier: DEMO.tier,
      birthYear: 1980 + i, // all adults
      kycFlag: 1,
      entitlement: DEMO.entitlementBaseUnits,
    }),
  );
  const { root } = await buildCohort(records);
  const merkleRootHex = Buffer.from(fieldToBytes32(root)).toString('hex');
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
  log('Program registered. Cohort is now eligible to claim.', 'ok');
}

/** Org/donor: fund the USDC pool. */
export async function fundProgram(
  store: DemoStore,
  d: Deployment,
  usdcWhole: number,
  log: Logger,
): Promise<void> {
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

/** Beneficiary: prove eligibility in-browser and claim to a fresh wallet. */
export async function proveAndClaim(
  store: DemoStore,
  d: Deployment,
  index: number,
  log: Logger,
): Promise<ClaimResult> {
  const s = store.state;
  if (!s.program) throw new Error('no program registered yet');
  const records = s.records.map(toRecord);

  log('Spinning up a fresh, unlinkable wallet…', 'step');
  let fresh: Keypair;
  try {
    fresh = Keypair.random();
    await fundWithFriendbot(fresh.publicKey());
  } catch {
    log('Friendbot unreachable — funding fresh wallet via org fallback.', 'info');
    fresh = await createFundedAccount(orgKeypair(d), '5');
  }
  await addUsdcTrustline(fresh, orgKeypair(d).publicKey());
  log(`Fresh wallet ${fresh.publicKey().slice(0, 10)}… ready`, 'info');

  log('Generating Groth16 proof locally (nothing leaves this browser)…', 'step');
  const recipientField = bytesToField(new Uint8Array(StrKey.decodeEd25519PublicKey(fresh.publicKey())));
  const { tree } = await buildCohort(records);
  const policy: ProgramPolicy = {
    programId: BigInt(s.program.programId),
    allowedRegion: BigInt(s.program.allowedRegion),
    minBirthYear: BigInt(s.program.minBirthYear),
    requiredTier: BigInt(s.program.requiredTier),
  };
  const { input, nullifierHash } = await buildClaimInput({
    record: records[index],
    policy,
    recipientField,
    tree,
    leafIndex: index,
  });
  const t0 = performance.now();
  const { proof } = await generateProof(input, WASM_URL, ZKEY_URL);
  log(`Proof generated in ${Math.round(performance.now() - t0)}ms`, 'info');

  const nullifierHashHex = Buffer.from(fieldToBytes32(nullifierHash)).toString('hex');
  const sb = proofToSorobanBytes(proof);
  const proofHex = {
    a: Buffer.from(sb.a).toString('hex'),
    b: Buffer.from(sb.b).toString('hex'),
    c: Buffer.from(sb.c).toString('hex'),
  };

  log('Submitting claim — proof verified ON-CHAIN by the Soroban pool…', 'step');
  const programId = Number(s.program.programId);
  const txHash = await claim(fresh, d.poolContractId, {
    programId,
    nullifierHashHex,
    recipient: fresh.publicKey(),
    payoutAmount: BigInt(s.program.entitlement),
    proof: proofHex,
  });
  const usdcReceived = await usdcBalance(orgKeypair(d).publicKey(), fresh.publicKey());
  log(`USDC delivered to the fresh wallet. tx ${txHash.slice(0, 12)}…`, 'ok');

  store.update((st) => ({
    ...st,
    claims: [
      ...st.claims.filter((c) => c.leafIndex !== index),
      {
        leafIndex: index,
        nullifierHash: nullifierHashHex,
        recipient: fresh.publicKey(),
        recipientSecret: fresh.secret(),
        amount: s.program!.entitlement,
        txHash,
        at: Date.now(),
      },
    ],
  }));

  return {
    freshPublicKey: fresh.publicKey(),
    freshSecret: fresh.secret(),
    txHash,
    nullifierHashHex,
    usdcReceived,
  };
}

/** Beneficiary: attempt a second claim (must be rejected by the nullifier). */
export async function attemptDoubleClaim(
  store: DemoStore,
  d: Deployment,
  index: number,
  log: Logger,
): Promise<boolean> {
  const s = store.state;
  const claimRec = s.claims.find((c) => c.leafIndex === index);
  if (!s.program || !claimRec) throw new Error('this beneficiary has not claimed yet');
  const records = s.records.map(toRecord);
  const { tree } = await buildCohort(records);

  // Re-prove to a brand-new wallet — even a fresh address cannot reuse the nullifier.
  const fresh = await (async () => {
    try {
      const k = Keypair.random();
      await fundWithFriendbot(k.publicKey());
      return k;
    } catch {
      return createFundedAccount(orgKeypair(d), '5');
    }
  })();
  const recipientField = bytesToField(new Uint8Array(StrKey.decodeEd25519PublicKey(fresh.publicKey())));
  const policy: ProgramPolicy = {
    programId: BigInt(s.program.programId),
    allowedRegion: BigInt(s.program.allowedRegion),
    minBirthYear: BigInt(s.program.minBirthYear),
    requiredTier: BigInt(s.program.requiredTier),
  };
  const { input, nullifierHash } = await buildClaimInput({
    record: records[index],
    policy,
    recipientField,
    tree,
    leafIndex: index,
  });
  log('Re-proving and submitting a SECOND claim for the same beneficiary…', 'step');
  const { proof } = await generateProof(input, WASM_URL, ZKEY_URL);
  const sb = proofToSorobanBytes(proof);
  try {
    await addUsdcTrustline(fresh, orgKeypair(d).publicKey());
    await claim(fresh, d.poolContractId, {
      programId: Number(s.program.programId),
      nullifierHashHex: Buffer.from(fieldToBytes32(nullifierHash)).toString('hex'),
      recipient: fresh.publicKey(),
      payoutAmount: BigInt(s.program.entitlement),
      proof: {
        a: Buffer.from(sb.a).toString('hex'),
        b: Buffer.from(sb.b).toString('hex'),
        c: Buffer.from(sb.c).toString('hex'),
      },
    });
    log('Unexpected: the second claim was accepted!', 'err');
    return false;
  } catch {
    log("Rejected: same nullifier, already spent. “We don't know who you are, but you already claimed.”", 'ok');
    return true;
  }
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
