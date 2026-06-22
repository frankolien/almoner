// Shared domain types for Almoner's crypto + proving layer.

export type FieldLike = bigint | number | string | Uint8Array | number[];

/** A beneficiary's private row in the org registration table. */
export interface BeneficiaryRecord {
  secret: bigint;
  nullifier: bigint;
  regionCode: bigint;
  programTier: bigint;
  birthYear: bigint;
  kycFlag: bigint;
  entitlement: bigint;
}

/** A program's public policy parameters (frozen on-chain at registration). */
export interface ProgramPolicy {
  programId: bigint;
  allowedRegion: bigint;
  minBirthYear: bigint;
  requiredTier: bigint;
}

export interface MerklePath {
  pathElements: bigint[];
  pathIndices: bigint[];
  root: bigint;
  leafIndex: number;
}

export interface Cohort {
  tree: import('./merkle.js').PoseidonMerkleTree;
  leaves: bigint[];
  root: bigint;
  depth: number;
}

export interface AuditRow {
  index: number;
  nullifierHash: bigint;
  claimed: boolean;
  entitlement: bigint;
}

export interface AuditReport {
  rows: AuditRow[];
  claimedCount: number;
  eligibleCount: number;
  totalClaimed: bigint;
}
