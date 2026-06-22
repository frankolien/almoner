import { poseidon } from './poseidon.js';
import type { BeneficiaryRecord, FieldLike } from './types.js';

// Leaf commitment — binds every beneficiary attribute into one field element.
// MUST stay in lockstep with `component leaf = Poseidon(7)` in aid_claim.circom.
export async function leafCommitment(rec: BeneficiaryRecord): Promise<bigint> {
  return poseidon([
    rec.secret,
    rec.nullifier,
    rec.regionCode,
    rec.programTier,
    rec.birthYear,
    rec.kycFlag,
    rec.entitlement,
  ]);
}

// Per-program nullifier hash. MUST match `component nh = Poseidon(2)`.
// Same (nullifier, programId) -> same hash -> the pool rejects the second claim.
export async function nullifierHash(nullifier: FieldLike, programId: FieldLike): Promise<bigint> {
  return poseidon([nullifier, programId]);
}
