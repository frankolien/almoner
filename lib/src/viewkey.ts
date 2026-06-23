// Cryptographic selective disclosure — the brief's "stronger version".
//
// Each claim posts an audit memo (beneficiary id + amount) encrypted to the
// donor/auditor's public key. It rides on the public ledger as opaque bytes;
// only the holder of the matching view (secret) key can decrypt it. This lets
// the donor reconstruct exactly who was paid WITHOUT the org's plaintext
// registration table — true selective disclosure, proving the data to the donor
// while revealing nothing to the world.
//
// Uses NaCl `box` (X25519 + XSalsa20-Poly1305) with an ephemeral sender key, so
// the ciphertext is unlinkable and forward-secret per memo.
import nacl from 'tweetnacl';

export interface AuditMemo {
  i: number; // leaf index in the cohort
  n: string; // beneficiary label (demo)
  a: string; // amount, USDC base units
}

export interface ViewKeypair {
  publicKey: string; // hex (32 bytes) — shared with the org, used to encrypt
  secretKey: string; // hex (32 bytes) — the donor's view key, kept private
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
function fromHex(h: string): Uint8Array {
  const s = h.replace(/^0x/, '');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function generateViewKeypair(): ViewKeypair {
  const kp = nacl.box.keyPair();
  return { publicKey: toHex(kp.publicKey), secretKey: toHex(kp.secretKey) };
}

/** Encrypt an audit memo to the auditor's public key. Returns hex bytes:
 *  ephemeralPublicKey(32) || nonce(24) || ciphertext. */
export function encryptMemo(auditorPublicKeyHex: string, memo: AuditMemo): string {
  const auditorPub = fromHex(auditorPublicKeyHex);
  const eph = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msg = enc.encode(JSON.stringify(memo));
  const cipher = nacl.box(msg, nonce, auditorPub, eph.secretKey);
  const out = new Uint8Array(eph.publicKey.length + nonce.length + cipher.length);
  out.set(eph.publicKey, 0);
  out.set(nonce, eph.publicKey.length);
  out.set(cipher, eph.publicKey.length + nonce.length);
  return toHex(out);
}

/** Decrypt an audit memo with the auditor's view (secret) key. null if it
 *  isn't ours / is malformed. */
export function decryptMemo(viewSecretKeyHex: string, memoHex: string): AuditMemo | null {
  try {
    const sk = fromHex(viewSecretKeyHex);
    const bytes = fromHex(memoHex);
    const ephPub = bytes.slice(0, 32);
    const nonce = bytes.slice(32, 32 + nacl.box.nonceLength);
    const cipher = bytes.slice(32 + nacl.box.nonceLength);
    const msg = nacl.box.open(cipher, nonce, ephPub, sk);
    if (!msg) return null;
    return JSON.parse(dec.decode(msg)) as AuditMemo;
  } catch {
    return null;
  }
}
