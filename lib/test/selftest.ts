// End-to-end self-test: proves the JS crypto (Poseidon, Merkle, nullifier) is
// bit-for-bit identical to the circuit by generating and verifying a real
// Groth16 proof, then exercises auditor reconstruction and a negative case.
//
//   npm run lib:test     (runs `tsx lib/test/selftest.ts`)
//
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  issueBeneficiary,
  buildCohort,
  reconstruct,
  buildClaimInput,
  generateProof,
  verifyProof,
  randomFieldElement,
  labelPublicSignals,
  type BeneficiaryRecord,
  type ProgramPolicy,
} from '../src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WASM = path.join(ROOT, 'circuits/build/aid_claim_js/aid_claim.wasm');
const ZKEY = path.join(ROOT, 'circuits/build/aid_claim.zkey');
const VKEY = path.join(ROOT, 'circuits/build/aid_claim.vkey.json');

// Demo program parameters
const REGION = 963n; // e.g. region code for the program
const TIER = 1n; // "standard" enrollment tier
const PROGRAM_ID = 42n;
const MIN_BIRTH_YEAR = 2008n; // born in/before 2008 => >= 18 in 2026
const ENTITLEMENT = 100_0000000n; // 100 USDC (7 decimals)

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
}

async function main(): Promise<void> {
  for (const f of [WASM, ZKEY, VKEY]) {
    if (!fs.existsSync(f)) throw new Error(`missing artifact ${f} — run "npm run circuit:build" first`);
  }

  // 1. Org issues a cohort of eligible beneficiaries.
  const records: BeneficiaryRecord[] = Array.from({ length: 5 }, (_, i) =>
    issueBeneficiary({
      regionCode: REGION,
      programTier: TIER,
      birthYear: 1985 + i,
      kycFlag: 1,
      entitlement: ENTITLEMENT,
    }),
  );
  const { tree, root } = await buildCohort(records);
  console.log('cohort root        :', root.toString());

  // 2. A beneficiary builds a claim to a fresh (unlinkable) recipient address.
  const claimant = 2;
  const recipientField = randomFieldElement(); // stand-in for a fresh Stellar address
  const policy: ProgramPolicy = {
    programId: PROGRAM_ID,
    allowedRegion: REGION,
    minBirthYear: MIN_BIRTH_YEAR,
    requiredTier: TIER,
  };
  const { input, nullifierHash: nh } = await buildClaimInput({
    record: records[claimant],
    policy,
    recipientField,
    tree,
    leafIndex: claimant,
  });

  // 3. Prove in-process (same path the browser WASM runs).
  console.time('prove');
  const { proof, publicSignals } = await generateProof(input, WASM, ZKEY);
  console.timeEnd('prove');
  console.log('public signals     :', labelPublicSignals(publicSignals));

  // 4. Verify off-chain (snarkjs) — the on-chain Soroban verifier checks the same.
  const vkey = JSON.parse(fs.readFileSync(VKEY, 'utf8'));
  const ok = await verifyProof(vkey, publicSignals, proof);
  console.log('proof verifies     :', ok);
  assert(ok, 'valid proof failed to verify');

  // 5. Cross-check that the JS-computed root + nullifier match the proof's publics.
  assert(publicSignals[0] === root.toString(), 'merkleRoot signal != JS tree root');
  assert(publicSignals[2] === nh.toString(), 'nullifierHash signal != JS nullifier');

  // 6. Auditor reconstruction — recompute who claimed from the registration table.
  const recon = await reconstruct(records, PROGRAM_ID, [nh]);
  console.log(
    `audit              : ${recon.claimedCount}/${recon.eligibleCount} claimed, total ${recon.totalClaimed} base units`,
  );
  assert(recon.claimedCount === 1, 'audit should see exactly one claim');
  assert(recon.totalClaimed === ENTITLEMENT, 'audit total mismatch');

  // 7. Negative: an ineligible claim (wrong region policy) must be unprovable.
  let rejected = false;
  try {
    const badPolicy: ProgramPolicy = { ...policy, allowedRegion: 111n };
    const { input: badInput } = await buildClaimInput({
      record: records[claimant],
      policy: badPolicy,
      recipientField,
      tree,
      leafIndex: claimant,
    });
    await generateProof(badInput, WASM, ZKEY);
  } catch {
    rejected = true;
  }
  console.log('ineligible claim   :', rejected ? 'rejected by circuit ✓' : 'ACCEPTED ✗');
  assert(rejected, 'circuit accepted an ineligible (wrong-region) claim');

  console.log('\n✓ selftest passed — JS crypto matches the circuit, proof verifies, audit reconstructs.');
}

main().catch((e: unknown) => {
  console.error('\n✗ selftest failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
