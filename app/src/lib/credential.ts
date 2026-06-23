// A bearer claim credential — the digital "aid voucher" the org hands a
// beneficiary (as a QR / link / card). It is fully self-contained: it carries
// the secret, the attributes, the program policy, and the Merkle path, so the
// beneficiary can prove + claim from any device with nothing else. Whoever
// holds the credential can claim once; in production it is delivered privately
// (in person, encrypted SMS) just like a cash voucher.
import type { BeneficiaryRecord, ProgramPolicy } from '@almoner/lib';
import type { PoseidonMerkleTree } from '@almoner/lib';
import type { StoredRecord, ProgramMeta } from './store.js';

export interface Credential {
  v: 1;
  programId: number;
  name: string;
  auditorPublicKey: string; // donor view key (public) — encrypt the audit memo to it
  policy: { allowedRegion: string; minBirthYear: string; requiredTier: string };
  entitlement: string;
  record: {
    secret: string;
    nullifier: string;
    regionCode: string;
    programTier: string;
    birthYear: string;
    kycFlag: string;
    entitlement: string;
  };
  path: { pathElements: string[]; pathIndices: string[]; root: string; leafIndex: number };
}

// --- compact binary wire format ---------------------------------------------
// A credential carries 19 BN254 field elements (secret, nullifier, root, and a
// depth-16 Merkle path), each a ~77-digit decimal string. As JSON+base64 the
// claim URL was ~3.1 KB — past the QR byte limit (2953 B), so the code either
// failed to encode or rendered at the densest version (unscannable). Packing each
// number big-endian with a 1-byte length prefix ~thirds the payload, dropping the
// QR to a low, scannable version. Stays fully self-contained (no server lookup).

function bigToBytes(v: bigint): number[] {
  const out: number[] = [];
  let n = v;
  while (n > 0n) {
    out.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  return out;
}
function bytesToBig(b: number[]): bigint {
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}
function hexToBytes(h: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
}
function bytesToHex(b: number[]): string {
  return b.map((x) => x.toString(16).padStart(2, '0')).join('');
}
function bytesToB64url(b: number[]): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(s: string): number[] {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out: number[] = [];
  for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
  return out;
}

class Writer {
  bytes: number[] = [];
  u8(x: number) {
    this.bytes.push(x & 0xff);
  }
  u16(x: number) {
    this.u8(x >> 8);
    this.u8(x);
  }
  blob(b: number[]) {
    this.u8(b.length); // field elements & small ints are <= 32 bytes
    for (const x of b) this.bytes.push(x);
  }
  num(v: bigint | number | string) {
    this.blob(bigToBytes(BigInt(v)));
  }
  str(s: string) {
    const b = [...new TextEncoder().encode(s)];
    this.u16(b.length);
    for (const x of b) this.bytes.push(x);
  }
}
class Reader {
  i = 0;
  constructor(public bytes: number[]) {}
  u8() {
    return this.bytes[this.i++];
  }
  u16() {
    return (this.u8() << 8) | this.u8();
  }
  take(n: number) {
    const b = this.bytes.slice(this.i, this.i + n);
    this.i += n;
    return b;
  }
  blob() {
    return this.take(this.u8());
  }
  num() {
    return bytesToBig(this.blob());
  }
  str() {
    return new TextDecoder().decode(new Uint8Array(this.take(this.u16())));
  }
}

const FORMAT = 1; // first byte; distinguishes from the legacy JSON form ('{' = 0x7b)

export function encodeCredential(c: Credential): string {
  const w = new Writer();
  w.u8(FORMAT);
  w.num(c.programId);
  w.str(c.name);
  w.blob(hexToBytes(c.auditorPublicKey || ''));
  w.num(c.policy.allowedRegion);
  w.num(c.policy.minBirthYear);
  w.num(c.policy.requiredTier);
  w.num(c.entitlement);
  const r = c.record;
  w.num(r.secret);
  w.num(r.nullifier);
  w.num(r.regionCode);
  w.num(r.programTier);
  w.num(r.birthYear);
  w.num(r.kycFlag);
  w.num(r.entitlement);
  const p = c.path;
  w.u8(p.pathElements.length);
  for (const e of p.pathElements) w.num(e);
  w.num(p.root);
  // pathIndices are 0/1 — pack into a bitfield
  const bf = new Array(Math.ceil(p.pathIndices.length / 8)).fill(0);
  p.pathIndices.forEach((bit, i) => {
    if (bit === '1') bf[i >> 3] |= 1 << (i & 7);
  });
  for (const x of bf) w.u8(x);
  w.num(p.leafIndex);
  return bytesToB64url(w.bytes);
}

export function decodeCredential(s: string): Credential {
  const raw = b64urlToBytes(s);
  // legacy JSON credential (links issued before the binary format)
  if (raw[0] === 0x7b) return JSON.parse(new TextDecoder().decode(new Uint8Array(raw))) as Credential;
  const r = new Reader(raw);
  r.u8(); // FORMAT
  const programId = Number(r.num());
  const name = r.str();
  const auditorPublicKey = bytesToHex(r.blob());
  const allowedRegion = r.num().toString();
  const minBirthYear = r.num().toString();
  const requiredTier = r.num().toString();
  const entitlement = r.num().toString();
  const record = {
    secret: r.num().toString(),
    nullifier: r.num().toString(),
    regionCode: r.num().toString(),
    programTier: r.num().toString(),
    birthYear: r.num().toString(),
    kycFlag: r.num().toString(),
    entitlement: r.num().toString(),
  };
  const depth = r.u8();
  const pathElements: string[] = [];
  for (let i = 0; i < depth; i++) pathElements.push(r.num().toString());
  const root = r.num().toString();
  const bf = r.take(Math.ceil(depth / 8));
  const pathIndices = Array.from({ length: depth }, (_, i) => ((bf[i >> 3] >> (i & 7)) & 1 ? '1' : '0'));
  const leafIndex = Number(r.num());
  return {
    v: 1,
    programId,
    name,
    auditorPublicKey,
    policy: { allowedRegion, minBirthYear, requiredTier },
    entitlement,
    record,
    path: { pathElements, pathIndices, root, leafIndex },
  };
}
export function credentialUrl(c: Credential): string {
  return `${window.location.origin}/#claim=${encodeCredential(c)}`;
}

/** Build a beneficiary's credential from the org's cohort tree. */
export async function buildCredential(
  rec: StoredRecord,
  leafIndex: number,
  tree: PoseidonMerkleTree,
  program: ProgramMeta,
  auditorPublicKey: string,
): Promise<Credential> {
  const { pathElements, pathIndices, root } = tree.proof(leafIndex);
  return {
    v: 1,
    programId: Number(program.programId),
    name: rec.name,
    auditorPublicKey,
    policy: {
      allowedRegion: program.allowedRegion,
      minBirthYear: program.minBirthYear,
      requiredTier: program.requiredTier,
    },
    entitlement: program.entitlement,
    record: {
      secret: rec.secret,
      nullifier: rec.nullifier,
      regionCode: rec.regionCode,
      programTier: rec.programTier,
      birthYear: rec.birthYear,
      kycFlag: rec.kycFlag,
      entitlement: rec.entitlement,
    },
    path: {
      pathElements: pathElements.map(String),
      pathIndices: pathIndices.map(String),
      root: root.toString(),
      leafIndex,
    },
  };
}

export function credToRecord(c: Credential): BeneficiaryRecord {
  const r = c.record;
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

export function credToPolicy(c: Credential): ProgramPolicy {
  return {
    programId: BigInt(c.programId),
    allowedRegion: BigInt(c.policy.allowedRegion),
    minBirthYear: BigInt(c.policy.minBirthYear),
    requiredTier: BigInt(c.policy.requiredTier),
  };
}
