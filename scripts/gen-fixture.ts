// Generate a real cohort + Groth16 proof bound to a given recipient address,
// and emit everything the contract `claim` needs as hex. Used to de-risk and
// then drive on-chain verification.
//
//   tsx scripts/gen-fixture.ts <recipient-G-address> [outfile]
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrKey } from '@stellar/stellar-sdk';
import {
  issueBeneficiary,
  buildCohort,
  buildClaimInput,
  generateProof,
  bytesToField,
  fieldToBytes32,
  proofToSorobanBytes,
  type BeneficiaryRecord,
  type ProgramPolicy,
} from '../lib/src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM = path.join(ROOT, 'circuits/build/aid_claim_js/aid_claim.wasm');
const ZKEY = path.join(ROOT, 'circuits/build/aid_claim.zkey');

const recipientG = process.argv[2];
const outFile = process.argv[3] ?? '/tmp/almoner-fixture.json';
if (!recipientG) throw new Error('usage: tsx scripts/gen-fixture.ts <recipient-G-address> [outfile]');

// Demo program parameters
const REGION = 963n;
const TIER = 1n;
const PROGRAM_ID = 42n;
const MIN_BIRTH_YEAR = 2008n;
const ENTITLEMENT = 100_0000000n; // 100 USDC

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

async function main(): Promise<void> {
  const pubkey = new Uint8Array(StrKey.decodeEd25519PublicKey(recipientG));
  const recipientField = bytesToField(pubkey);

  const records: BeneficiaryRecord[] = Array.from({ length: 5 }, (_, i) =>
    issueBeneficiary({
      regionCode: REGION,
      programTier: TIER,
      birthYear: 1985 + i,
      kycFlag: 1,
      entitlement: ENTITLEMENT,
    }),
  );
  const claimant = 2;
  const { tree, root } = await buildCohort(records);
  const policy: ProgramPolicy = {
    programId: PROGRAM_ID,
    allowedRegion: REGION,
    minBirthYear: MIN_BIRTH_YEAR,
    requiredTier: TIER,
  };
  const { input, nullifierHash } = await buildClaimInput({
    record: records[claimant],
    policy,
    recipientField,
    tree,
    leafIndex: claimant,
  });
  const { proof, publicSignals } = await generateProof(input, WASM, ZKEY);
  const sb = proofToSorobanBytes(proof);

  const out = {
    programId: Number(PROGRAM_ID),
    merkleRoot: hex(fieldToBytes32(root)),
    allowedRegion: Number(REGION),
    minBirthYear: Number(MIN_BIRTH_YEAR),
    requiredTier: Number(TIER),
    nullifierHash: hex(fieldToBytes32(nullifierHash)),
    recipient: recipientG,
    payoutAmount: ENTITLEMENT.toString(),
    proof: { a: hex(sb.a), b: hex(sb.b), c: hex(sb.c) },
    publicSignals,
    // full registration table so the auditor demo can reconstruct
    records: records.map((r) => ({
      secret: r.secret.toString(),
      nullifier: r.nullifier.toString(),
      regionCode: r.regionCode.toString(),
      programTier: r.programTier.toString(),
      birthYear: r.birthYear.toString(),
      kycFlag: r.kycFlag.toString(),
      entitlement: r.entitlement.toString(),
    })),
  };
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log('wrote', outFile);
  console.log('merkleRoot   :', out.merkleRoot);
  console.log('nullifierHash:', out.nullifierHash);
  console.log('recipient    :', out.recipient);
  console.log('proof.a len  :', out.proof.a.length / 2, 'bytes');
  console.log('proof.b len  :', out.proof.b.length / 2, 'bytes');
  console.log('proof.c len  :', out.proof.c.length / 2, 'bytes');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
