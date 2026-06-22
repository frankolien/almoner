import { leafCommitment, nullifierHash } from './commitment.js';
import { PoseidonMerkleTree } from './merkle.js';
import { randomFieldElement, toBigInt } from './field.js';
import type {
  AuditReport,
  AuditRow,
  BeneficiaryRecord,
  Cohort,
  FieldLike,
} from './types.js';

export const DEFAULT_DEPTH = 16;

export interface IssueParams {
  regionCode: FieldLike;
  programTier: FieldLike;
  birthYear: FieldLike;
  kycFlag: FieldLike;
  entitlement: FieldLike;
}

// Issue a fresh beneficiary record. `secret` and `nullifier` are random field
// elements held privately by the beneficiary; the org keeps the full row in its
// registration table so it can later reconstruct who claimed.
export function issueBeneficiary(p: IssueParams): BeneficiaryRecord {
  return {
    secret: randomFieldElement(),
    nullifier: randomFieldElement(),
    regionCode: toBigInt(p.regionCode),
    programTier: toBigInt(p.programTier),
    birthYear: toBigInt(p.birthYear),
    kycFlag: toBigInt(p.kycFlag),
    entitlement: toBigInt(p.entitlement),
  };
}

// Build a cohort: compute every leaf commitment and assemble the Merkle tree.
export async function buildCohort(
  records: BeneficiaryRecord[],
  depth: number = DEFAULT_DEPTH,
): Promise<Cohort> {
  const leaves: bigint[] = [];
  for (const rec of records) leaves.push(await leafCommitment(rec));
  const tree = await PoseidonMerkleTree.build(leaves, depth);
  return { tree, leaves, root: tree.root(), depth };
}

// Auditor reconstruction — the differentiator, no extra circuit needed.
// Given the registration table and the on-chain spent-nullifier set for a
// program, recompute each expected nullifier hash and match it against the set
// to learn exactly who claimed and the program total. Invisible to the public,
// who only ever see opaque one-way hashes.
export async function reconstruct(
  records: BeneficiaryRecord[],
  programId: FieldLike,
  spentNullifierHashes: FieldLike[],
): Promise<AuditReport> {
  const spent = new Set(spentNullifierHashes.map((x) => toBigInt(x).toString()));
  const rows: AuditRow[] = [];
  let totalClaimed = 0n;
  for (let i = 0; i < records.length; i++) {
    const nh = await nullifierHash(records[i].nullifier, programId);
    const claimed = spent.has(nh.toString());
    if (claimed) totalClaimed += toBigInt(records[i].entitlement);
    rows.push({
      index: i,
      nullifierHash: nh,
      claimed,
      entitlement: toBigInt(records[i].entitlement),
    });
  }
  return {
    rows,
    claimedCount: rows.filter((r) => r.claimed).length,
    eligibleCount: records.length,
    totalClaimed,
  };
}
