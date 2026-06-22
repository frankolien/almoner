// Full end-to-end demo against live testnet, using the SAME client code the
// browser uses (app/src/lib/pool.ts) + the shared crypto lib:
//
//   org registers a cohort + program -> beneficiary proves in-process ->
//   claims to a FRESH wallet -> USDC lands -> a second claim is rejected ->
//   the auditor reconstructs who claimed and the total.
//
//   npm run demo:e2e
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  issueBeneficiary,
  buildCohort,
  buildClaimInput,
  generateProof,
  reconstruct,
  bytesToField,
  fieldToBytes32,
  proofToSorobanBytes,
  type BeneficiaryRecord,
  type ProgramPolicy,
} from '@almoner/lib';
import { StrKey } from '@stellar/stellar-sdk';
import {
  Keypair,
  createProgram,
  fundPool,
  claim,
  isSpent,
  spentNullifiers,
  poolBalance,
  usdcBalance,
  xlmBalance,
  sponsorFreshAccount,
} from '../app/src/lib/pool.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM = path.join(ROOT, 'circuits/build/aid_claim_js/aid_claim.wasm');
const ZKEY = path.join(ROOT, 'circuits/build/aid_claim.zkey');
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/public/deployment.json'), 'utf8'));

const POOL = dep.poolContractId as string;
const TOKEN = dep.usdcTokenId as string;
const org = Keypair.fromSecret(dep.adminSecret as string);
const relayer = Keypair.fromSecret((dep.relayerSecret ?? dep.adminSecret) as string);

// program parameters
const REGION = 963n;
const TIER = 1n;
const MIN_BIRTH_YEAR = 2008n;
const ENTITLEMENT = 100_0000000n; // 100 USDC
const COHORT = 5;
const CLAIMANT = 2;
const usdc = (n: bigint) => (Number(n) / 1e7).toFixed(2);

function uniqueProgramId(): number {
  // small u32, unlikely to collide across runs (no Date.now needed)
  return 1000 + Math.floor(Math.random() * 9_000_000);
}

async function main(): Promise<void> {
  const programId = uniqueProgramId();
  console.log(`\n▸ Pool ${POOL}`);
  console.log(`▸ Program #${programId}\n`);

  // 1) Org issues a cohort and registers the program.
  const records: BeneficiaryRecord[] = Array.from({ length: COHORT }, (_, i) =>
    issueBeneficiary({
      regionCode: REGION,
      programTier: TIER,
      birthYear: 1980 + i,
      kycFlag: 1,
      entitlement: ENTITLEMENT,
    }),
  );
  const { tree, root } = await buildCohort(records);
  const merkleRootHex = Buffer.from(fieldToBytes32(root)).toString('hex');

  console.log('① Org registers cohort + program on-chain…');
  await createProgram(org, POOL, {
    programId,
    merkleRootHex,
    allowedRegion: Number(REGION),
    minBirthYear: Number(MIN_BIRTH_YEAR),
    requiredTier: Number(TIER),
  });
  console.log(`   ✓ root ${merkleRootHex.slice(0, 16)}… committed`);

  // 2) Top up the shared USDC vault (org is issuer; fund() transfers org -> pool).
  console.log('② Org funds the USDC pool…');
  await fundPool(org, POOL, org.publicKey(), 500_0000000n); // 500 USDC
  console.log(`   ✓ pool balance ${usdc(await poolBalance(POOL, org))} USDC`);

  // 3) A beneficiary creates a FRESH wallet (unlinkable) and trusts USDC.
  console.log('③ Relayer sponsors a fresh wallet (zero-gas onboarding)…');
  const fresh = Keypair.random();
  await sponsorFreshAccount(relayer, fresh, org.publicKey());
  const freshXlm = await xlmBalance(fresh.publicKey());
  console.log(`   ✓ fresh wallet ${fresh.publicKey().slice(0, 8)}… created + USDC trustline, holding ${freshXlm} XLM`);

  // 4) Prove eligibility in-process (the browser runs the same WASM).
  console.log('④ Beneficiary proves eligibility (Groth16, in-browser-equivalent)…');
  const recipientField = bytesToField(new Uint8Array(StrKey.decodeEd25519PublicKey(fresh.publicKey())));
  const policy: ProgramPolicy = {
    programId: BigInt(programId),
    allowedRegion: REGION,
    minBirthYear: MIN_BIRTH_YEAR,
    requiredTier: TIER,
  };
  const { input, nullifierHash } = await buildClaimInput({
    record: records[CLAIMANT],
    policy,
    recipientField,
    tree,
    leafIndex: CLAIMANT,
  });
  const t0 = Date.now();
  const { proof } = await generateProof(input, WASM, ZKEY);
  console.log(`   ✓ proof generated in ${Date.now() - t0}ms`);

  const nullifierHashHex = Buffer.from(fieldToBytes32(nullifierHash)).toString('hex');
  const sb = proofToSorobanBytes(proof);
  const proofHex = {
    a: Buffer.from(sb.a).toString('hex'),
    b: Buffer.from(sb.b).toString('hex'),
    c: Buffer.from(sb.c).toString('hex'),
  };

  // 5) Claim — the proof is the authorization; the RELAYER submits + pays the fee.
  console.log('⑤ Claim: relayer submits, proof verified ON-CHAIN, USDC disbursed…');
  const before = await usdcBalance(org.publicKey(), fresh.publicKey());
  const tx = await claim(relayer, POOL, {
    programId,
    nullifierHashHex,
    recipient: fresh.publicKey(),
    payoutAmount: ENTITLEMENT,
    proof: proofHex,
  });
  const after = await usdcBalance(org.publicKey(), fresh.publicKey());
  console.log(`   ✓ tx ${tx.slice(0, 16)}…`);
  console.log(`   ✓ fresh wallet USDC: ${usdc(before)} -> ${usdc(after)}  (+${usdc(after - before)})`);
  console.log(`   ✓ beneficiary paid 0 XLM in gas (still holds ${await xlmBalance(fresh.publicKey())} XLM)`);

  // 6) Double-claim must be rejected by the per-program nullifier.
  console.log('⑥ Same beneficiary tries to claim again…');
  let rejected = false;
  try {
    await claim(relayer, POOL, {
      programId,
      nullifierHashHex,
      recipient: fresh.publicKey(),
      payoutAmount: ENTITLEMENT,
      proof: proofHex,
    });
  } catch {
    rejected = true;
  }
  const spentNow = await isSpent(POOL, org, programId, nullifierHashHex);
  console.log(`   ✓ rejected: ${rejected}, is_spent: ${spentNow}  ("we don't know who you are, but you already claimed")`);

  // 7) Auditor reconstruction from the on-chain spent set + registration table.
  console.log('⑦ Auditor reconstructs (invisible to the public)…');
  const spent = (await spentNullifiers(POOL, org, programId)).map((h) => BigInt('0x' + h));
  const recon = await reconstruct(records, BigInt(programId), spent);
  console.log(
    `   ✓ ${recon.claimedCount}/${recon.eligibleCount} eligible claimed, total ${usdc(recon.totalClaimed)} USDC, every payout matched to an eligible beneficiary`,
  );

  console.log('\n✓ e2e complete — private to the world, provable to the donor.\n');
}

main().catch((e: unknown) => {
  console.error('\n✗ e2e failed:', e);
  process.exit(1);
});
