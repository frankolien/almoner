// Encode snarkjs Groth16 artifacts (BN254) into the byte layout Soroban's
// native `env.crypto().bn254()` expects — Ethereum-compatible uncompressed:
//
//   G1  = be(x) || be(y)                                    (64 bytes)
//   G2  = be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0)      (128 bytes)
//
// snarkjs stores Fp2 coordinates as [c0, c1] (real first); the host wants
// [c1, c0] (imaginary first), so G2 needs the swap. This single helper is the
// one place that knows the convention — shared by the VK generator, the e2e
// harness, and the browser claim path so they can never disagree.
import { fieldToBytes32 } from './field.js';
import type { Groth16Proof } from './prover.js';

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** snarkjs G1 `[x, y, z]` (affine, z="1") -> 64 bytes. */
export function g1ToBytes(p: string[]): Uint8Array {
  return concat([fieldToBytes32(p[0]), fieldToBytes32(p[1])]);
}

/** snarkjs G2 `[[x_c0,x_c1],[y_c0,y_c1],[..]]` -> 128 bytes (with the c1||c0 swap). */
export function g2ToBytes(p: string[][]): Uint8Array {
  return concat([
    fieldToBytes32(p[0][1]),
    fieldToBytes32(p[0][0]),
    fieldToBytes32(p[1][1]),
    fieldToBytes32(p[1][0]),
  ]);
}

export interface SorobanProofBytes {
  a: Uint8Array; // 64
  b: Uint8Array; // 128
  c: Uint8Array; // 64
}

export function proofToSorobanBytes(proof: Groth16Proof): SorobanProofBytes {
  return {
    a: g1ToBytes(proof.pi_a),
    b: g2ToBytes(proof.pi_b),
    c: g1ToBytes(proof.pi_c),
  };
}

export interface SnarkVerificationKey {
  nPublic: number;
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  IC: string[][];
}

export interface SorobanVerificationKey {
  alpha: Uint8Array; // 64
  beta: Uint8Array; // 128
  gamma: Uint8Array; // 128
  delta: Uint8Array; // 128
  ic: Uint8Array[]; // (nPublic + 1) x 64
  nPublic: number;
}

export function vkToSorobanBytes(vk: SnarkVerificationKey): SorobanVerificationKey {
  return {
    alpha: g1ToBytes(vk.vk_alpha_1),
    beta: g2ToBytes(vk.vk_beta_2),
    gamma: g2ToBytes(vk.vk_gamma_2),
    delta: g2ToBytes(vk.vk_delta_2),
    ic: vk.IC.map(g1ToBytes),
    nPublic: vk.nPublic,
  };
}
