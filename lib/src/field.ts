import type { FieldLike } from './types.js';

// BN254 scalar field — the field the circuit and snarkjs operate over.
export const FIELD_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function mod(x: bigint, p: bigint = FIELD_PRIME): bigint {
  const r = x % p;
  return r >= 0n ? r : r + p;
}

export function toBigInt(x: FieldLike): bigint {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') return BigInt(x);
  if (typeof x === 'string') return BigInt(x);
  if (x instanceof Uint8Array) return bytesToField(x);
  if (Array.isArray(x)) return bytesToField(Uint8Array.from(x));
  throw new Error('cannot convert to field element: ' + typeof x);
}

// Big-endian bytes -> field element (reduced mod r). Used to fold a 32-byte
// Stellar ed25519 public key into a single public input bound by the proof.
export function bytesToField(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b & 0xff);
  return mod(acc);
}

// Field element -> 32-byte big-endian array (the on-chain BytesN<32> form).
export function fieldToBytes32(x: FieldLike): Uint8Array {
  let v = mod(toBigInt(x));
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

const webcrypto: Crypto = globalThis.crypto;

// Uniform-ish random field element (32 bytes reduced mod r) for secrets/nullifiers.
export function randomFieldElement(): bigint {
  const bytes = new Uint8Array(32);
  webcrypto.getRandomValues(bytes);
  return mod(bytesToField(bytes));
}

export const toDecString = (x: FieldLike): string => mod(toBigInt(x)).toString();

export const bytesToHex = (b: Uint8Array): string =>
  '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
