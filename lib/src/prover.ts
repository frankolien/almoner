import * as snarkjs from 'snarkjs';
import type { Groth16Proof, PublicSignals } from 'snarkjs';
import { nullifierHash } from './commitment.js';
import { toBigInt } from './field.js';
import type { PoseidonMerkleTree } from './merkle.js';
import type { BeneficiaryRecord, FieldLike, ProgramPolicy } from './types.js';

export type { Groth16Proof, PublicSignals };

// The public-signal order the circuit emits and the Soroban contract consumes.
export const PUBLIC_SIGNALS = [
  'merkleRoot',
  'programId',
  'nullifierHash',
  'recipient',
  'payoutAmount',
  'allowedRegion',
  'minBirthYear',
  'requiredTier',
] as const;

export type CircuitInput = Record<string, string | string[]>;

export interface BuildClaimArgs {
  record: BeneficiaryRecord;
  policy: ProgramPolicy;
  recipientField: FieldLike;
  tree: PoseidonMerkleTree;
  leafIndex: number;
}

// A Merkle authentication path (bundled into a credential so the beneficiary
// can prove without holding the whole tree).
export interface ClaimPath {
  pathElements: FieldLike[];
  pathIndices: FieldLike[];
  root: FieldLike;
}

// Assemble the full witness input for one claim. Every value is reduced to a
// decimal string, which is what snarkjs expects.
export async function buildClaimInput(
  args: BuildClaimArgs,
): Promise<{ input: CircuitInput; nullifierHash: bigint }> {
  const { record, policy, recipientField, tree, leafIndex } = args;
  const { pathElements, pathIndices } = tree.proof(leafIndex);
  return buildClaimInputFromPath({
    record,
    policy,
    recipientField,
    path: { pathElements, pathIndices, root: tree.root() },
  });
}

// Same, but from a precomputed path — the credential-driven beneficiary flow.
export async function buildClaimInputFromPath(args: {
  record: BeneficiaryRecord;
  policy: ProgramPolicy;
  recipientField: FieldLike;
  path: ClaimPath;
}): Promise<{ input: CircuitInput; nullifierHash: bigint }> {
  const { record, policy, recipientField, path } = args;
  const nh = await nullifierHash(record.nullifier, policy.programId);

  const raw: Record<string, FieldLike | FieldLike[]> = {
    // private witness
    secret: record.secret,
    nullifier: record.nullifier,
    regionCode: record.regionCode,
    programTier: record.programTier,
    birthYear: record.birthYear,
    kycFlag: record.kycFlag,
    entitlement: record.entitlement,
    pathElements: path.pathElements,
    pathIndices: path.pathIndices,
    // public inputs
    merkleRoot: path.root,
    programId: policy.programId,
    nullifierHash: nh,
    recipient: recipientField,
    payoutAmount: record.entitlement,
    allowedRegion: policy.allowedRegion,
    minBirthYear: policy.minBirthYear,
    requiredTier: policy.requiredTier,
  };
  return { input: stringify(raw), nullifierHash: nh };
}

function stringify(obj: Record<string, FieldLike | FieldLike[]>): CircuitInput {
  const conv = (v: FieldLike): string => toBigInt(v).toString();
  const out: CircuitInput = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = Array.isArray(v) ? v.map(conv) : conv(v);
  }
  return out;
}

// Generate a Groth16 proof. `wasm` / `zkey` are file paths (Node) or URLs /
// buffers (browser) — snarkjs accepts either.
export async function generateProof(
  input: CircuitInput,
  wasm: string | Uint8Array,
  zkey: string | Uint8Array,
): Promise<{ proof: Groth16Proof; publicSignals: PublicSignals }> {
  return snarkjs.groth16.fullProve(input, wasm, zkey);
}

export async function verifyProof(
  vkey: unknown,
  publicSignals: PublicSignals,
  proof: Groth16Proof,
): Promise<boolean> {
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

// Map the flat publicSignals array back to named fields for display / debugging.
export function labelPublicSignals(publicSignals: PublicSignals): Record<string, string> {
  const out: Record<string, string> = {};
  PUBLIC_SIGNALS.forEach((name, i) => (out[name] = publicSignals[i]));
  return out;
}
