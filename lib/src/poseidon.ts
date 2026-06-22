import { buildPoseidon, type PoseidonFn } from 'circomlibjs';
import { toBigInt } from './field.js';
import type { FieldLike } from './types.js';

// circomlibjs Poseidon matches circomlib's poseidon.circom over BN254 exactly,
// so values hashed here in JS are identical to what the circuit recomputes.
let _poseidon: PoseidonFn | null = null;

export async function getPoseidon(): Promise<PoseidonFn> {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

// Hash 1..n field elements -> bigint. Mirrors `component h = Poseidon(n)`.
export async function poseidon(inputs: FieldLike[]): Promise<bigint> {
  const p = await getPoseidon();
  const res = p(inputs.map(toBigInt));
  return p.F.toObject(res);
}
