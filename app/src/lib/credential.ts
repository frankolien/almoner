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

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  return atob(s.replace(/-/g, '+').replace(/_/g, '/'));
}

export function encodeCredential(c: Credential): string {
  return b64urlEncode(JSON.stringify(c));
}
export function decodeCredential(s: string): Credential {
  return JSON.parse(b64urlDecode(s)) as Credential;
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
): Promise<Credential> {
  const { pathElements, pathIndices, root } = tree.proof(leafIndex);
  return {
    v: 1,
    programId: Number(program.programId),
    name: rec.name,
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
