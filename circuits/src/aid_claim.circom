pragma circom 2.1.6;

// Almoner — confidential aid disbursement.
//
// One Groth16 circuit (BN254) proves, entirely in the beneficiary's browser,
// that the claimant belongs to the eligible cohort AND satisfies four program
// conditions, while revealing nothing that links them to a public-ledger claim.
//
//   Four conditions, one proof:
//     A  cohort membership      (Merkle inclusion of the leaf commitment)
//     B  region allowed         (regionCode == allowedRegion)
//     C  age >= 18              (birthYear <= minBirthYear)
//     D  correct tier + KYC      (programTier == requiredTier, kycFlag == 1)
//   plus a per-program nullifier that makes duplicate / ghost claims impossible.

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "merkle.circom";

template AidClaim(depth) {
    // -------- private witness (never leaves the device) --------
    signal input secret;        // owner secret for this leaf
    signal input nullifier;     // seeds the per-program anti-double-claim hash
    signal input regionCode;    // beneficiary region / country
    signal input programTier;   // enrollment tier or status
    signal input birthYear;     // for the age gate
    signal input kycFlag;       // 1 if KYC-verified by an anchor at registration
    signal input entitlement;   // USDC base units owed to this beneficiary
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // -------- public inputs (checked by the Soroban contract) --------
    signal input merkleRoot;    // registered cohort root, stored on-chain
    signal input programId;     // identifies the round; salts the nullifier
    signal input nullifierHash; // stored by the contract to block reuse
    signal input recipient;     // fresh payout address, bound into the proof
    signal input payoutAmount;  // what the contract transfers (== entitlement)
    signal input allowedRegion; // this program's policy parameters
    signal input minBirthYear;
    signal input requiredTier;

    // -------- leaf commitment binds every attribute together --------
    // Changing any attribute produces a different leaf that is not in the tree.
    component leaf = Poseidon(7);
    leaf.inputs[0] <== secret;
    leaf.inputs[1] <== nullifier;
    leaf.inputs[2] <== regionCode;
    leaf.inputs[3] <== programTier;
    leaf.inputs[4] <== birthYear;
    leaf.inputs[5] <== kycFlag;
    leaf.inputs[6] <== entitlement;

    // -------- Condition A: membership in the eligible cohort --------
    component mt = MerkleProof(depth);
    mt.leaf <== leaf.out;
    for (var i = 0; i < depth; i++) {
        mt.pathElements[i] <== pathElements[i];
        mt.pathIndices[i] <== pathIndices[i];
    }
    mt.root === merkleRoot;

    // -------- Condition B: region allowed (single region in v1) --------
    regionCode === allowedRegion;

    // -------- Condition C: age >= 18  =>  birthYear <= minBirthYear --------
    // 16 bits comfortably covers any real birth year (< 65536).
    component age = LessEqThan(16);
    age.in[0] <== birthYear;
    age.in[1] <== minBirthYear;
    age.out === 1;

    // -------- Condition D: correct tier + KYC passed --------
    programTier === requiredTier;
    kycFlag === 1;

    // -------- per-program nullifier (anti double-claim) --------
    // Same beneficiary + same program  ->  same hash  ->  contract rejects reuse.
    // Same beneficiary across programs  ->  different, unlinkable hashes.
    component nh = Poseidon(2);
    nh.inputs[0] <== nullifier;
    nh.inputs[1] <== programId;
    nh.out === nullifierHash;

    // -------- payout binding: contract must transfer exactly the entitlement --
    payoutAmount === entitlement;

    // -------- recipient binding (stops proof theft / redirection) --------
    // `recipient` is a public input; a single multiplicative constraint forces
    // it into the witness so a front-runner cannot swap in their own address
    // without invalidating the proof.
    signal recipientSquared;
    recipientSquared <== recipient * recipient;
}

// Public-signal order is load-bearing: the Soroban verifier consumes the
// public inputs in exactly this sequence.
component main {public [
    merkleRoot,
    programId,
    nullifierHash,
    recipient,
    payoutAmount,
    allowedRegion,
    minBirthYear,
    requiredTier
]} = AidClaim(16);
