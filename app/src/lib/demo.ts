// Orchestration shared by the surfaces. The browser does only crypto + proving;
// every chain-signing op goes through the backend (./serverApi). The org's
// cohort secrets are generated here (operator device) and handed out as
// credentials; the eligibility proof is generated on the beneficiary's device
// and only submitted to the relayer — the secret never leaves the browser.
import {
  issueBeneficiary,
  buildCohort,
  buildClaimInputFromPath,
  generateProof,
  reconstruct,
  bytesToField,
  fieldToBytes32,
  proofToSorobanBytes,
  encryptMemo,
  decryptMemo,
  type BeneficiaryRecord,
  type AuditReport,
} from '@almoner/lib';
import { StrKey } from '@stellar/stellar-sdk';
import {
  apiCreateProgram,
  apiFund,
  apiSponsor,
  apiClaim,
  apiSpent,
  apiMemos,
  apiViewKey,
  apiBalance,
} from './serverApi.js';
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

/** Org: issue a cohort (operator device), then the backend posts the root + policy. */
export async function registerCohort(store: DemoStore, log: Logger): Promise<void> {
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
  await apiCreateProgram({
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

/** Org/donor: fund the USDC pool (operator-signed by the backend). */
export async function fundProgram(store: DemoStore, usdcWhole: number, log: Logger): Promise<void> {
  const amount = BigInt(Math.round(usdcWhole * 1e7));
  log(`Funding pool with ${usdcWhole} USDC…`, 'step');
  await apiFund(amount);
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

// Encrypt the audit memo to the donor's view key — opaque to the world, posted
// on-chain with the claim, decryptable only by the auditor.
function encryptAuditMemo(cred: Credential): string {
  if (!cred.auditorPublicKey) return '';
  return encryptMemo(cred.auditorPublicKey, {
    i: cred.path.leafIndex,
    n: cred.name,
    a: cred.entitlement,
  });
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

/** Beneficiary: claim from a credential. The relayer (backend) sponsors all gas. */
export async function claimFromCredential(cred: Credential, log: Logger): Promise<ClaimResult> {
  log('Creating a fresh, unlinkable wallet — gas sponsored, you pay nothing…', 'step');
  const { freshPublicKey, freshSecret } = await apiSponsor();
  log(`Fresh wallet ${freshPublicKey.slice(0, 10)}… ready (you hold 0 XLM).`, 'info');

  log('Generating your Groth16 proof on this device…', 'step');
  const t0 = performance.now();
  const { nullifierHashHex, proofHex } = await proveFor(cred, freshPublicKey);
  log(`Proof generated in ${Math.round(performance.now() - t0)}ms — your secret never left this device.`, 'info');

  log('Submitting — proof verified on-chain by the Soroban pool…', 'step');
  const { txHash } = await apiClaim({
    programId: cred.programId,
    nullifierHashHex,
    recipient: freshPublicKey,
    payoutAmount: BigInt(cred.entitlement),
    proof: proofHex,
    memoHex: encryptAuditMemo(cred),
  });
  const usdcReceived = await apiBalance(freshPublicKey);
  log('USDC delivered to your fresh wallet.', 'ok');

  return { freshPublicKey, freshSecret, txHash, nullifierHashHex, usdcReceived };
}

/** Beneficiary: a second claim from the same credential — must be rejected. */
export async function reclaimFromCredential(cred: Credential, log: Logger): Promise<boolean> {
  const { freshPublicKey } = await apiSponsor();
  log('Re-proving to a brand-new wallet and trying to claim again…', 'step');
  const { nullifierHashHex, proofHex } = await proveFor(cred, freshPublicKey);
  try {
    await apiClaim({
      programId: cred.programId,
      nullifierHashHex,
      recipient: freshPublicKey,
      payoutAmount: BigInt(cred.entitlement),
      proof: proofHex,
      memoHex: encryptAuditMemo(cred),
    });
    log('Unexpected: the second claim was accepted.', 'err');
    return false;
  } catch {
    log("Rejected — same nullifier, already spent. “We don’t know who you are, but you already claimed.”", 'ok');
    return true;
  }
}

/** Auditor v1: reconstruct from the on-chain spent set + the registration table. */
export async function runAudit(store: DemoStore): Promise<AuditReport> {
  const s = store.state;
  if (!s.program) throw new Error('no program registered');
  const records = s.records.map(toRecord);
  const spent = (await apiSpent(Number(s.program.programId))).map((h) => BigInt('0x' + h));
  return reconstruct(records, BigInt(s.program.programId), spent);
}

export interface ViewKeyAuditRow {
  leafIndex: number;
  name: string;
  amount: bigint;
}
export interface ViewKeyAudit {
  rows: ViewKeyAuditRow[];
  total: bigint;
  count: number;
}

/**
 * Auditor v2 — cryptographic selective disclosure. Reconstruct purely from the
 * on-chain encrypted memos + the donor's view key, WITHOUT the registration
 * table. The public sees the same memos as opaque bytes; only this key reads them.
 */
export async function runAuditViaViewKey(store: DemoStore): Promise<ViewKeyAudit> {
  const s = store.state;
  if (!s.program) throw new Error('no program registered');
  const viewKey = await apiViewKey(); // demo: served; production: held by the donor
  const memosHex = await apiMemos(Number(s.program.programId));
  const rows: ViewKeyAuditRow[] = [];
  let total = 0n;
  for (const m of memosHex) {
    const memo = decryptMemo(viewKey, m);
    if (!memo) continue;
    rows.push({ leafIndex: memo.i, name: memo.n, amount: BigInt(memo.a) });
    total += BigInt(memo.a);
  }
  rows.sort((a, b) => a.leafIndex - b.leafIndex);
  return { rows, total, count: rows.length };
}
