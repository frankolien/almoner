//! BN254 Groth16 verifier (Ethereum-compatible encoding), using Soroban's
//! native `env.crypto().bn254()` pairing host functions.
//!
//! The verification key is generated from the snarkjs `verification_key.json`
//! by `scripts/gen-vk.ts` into `vk.rs`, so the proving and verifying keys can
//! never drift. The proof bytes are produced from snarkjs `proof.json` by the
//! same encoding the frontend uses (`@almoner/lib` `proofToSorobanBytes`).

use soroban_sdk::{
    address_payload::AddressPayload,
    contracttype,
    crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine},
    vec, Address, BytesN, Env,
};

use crate::vk;

/// A Groth16 proof in Ethereum-compatible uncompressed encoding.
///   a: G1 = be(x) || be(y)                              (64 bytes)
///   b: G2 = be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0) (128 bytes)
///   c: G1 = be(x) || be(y)                              (64 bytes)
#[contracttype]
#[derive(Clone)]
pub struct Proof {
    pub a: BytesN<64>,
    pub b: BytesN<128>,
    pub c: BytesN<64>,
}

fn g1(env: &Env, bytes: &[u8; 64]) -> Bn254G1Affine {
    Bn254G1Affine::from_bytes(BytesN::from_array(env, bytes))
}

fn g2(env: &Env, bytes: &[u8; 128]) -> Bn254G2Affine {
    Bn254G2Affine::from_bytes(BytesN::from_array(env, bytes))
}

/// Verify a Groth16 proof against the embedded verification key and the given
/// public inputs (each a 32-byte big-endian field element, in circuit order).
///
/// Checks the standard pairing equation
///   e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
/// where vk_x = IC[0] + Σ pub_i · IC[i+1].
pub fn verify(env: &Env, proof: &Proof, public_inputs: &[BytesN<32>; vk::NUM_PUBLIC]) -> bool {
    let bn = env.crypto().bn254();

    // Accumulate vk_x = IC[0] + Σ pub_i · IC[i+1].
    let mut vk_x = g1(env, &vk::VK_IC[0]);
    for i in 0..vk::NUM_PUBLIC {
        let scalar = Bn254Fr::from_bytes(public_inputs[i].clone());
        let term = bn.g1_mul(&g1(env, &vk::VK_IC[i + 1]), &scalar);
        vk_x = bn.g1_add(&vk_x, &term);
    }

    let neg_a = -Bn254G1Affine::from_bytes(proof.a.clone());
    let c = Bn254G1Affine::from_bytes(proof.c.clone());
    let b = Bn254G2Affine::from_bytes(proof.b.clone());

    let vp1 = vec![env, neg_a, g1(env, &vk::VK_ALPHA), vk_x, c];
    let vp2 = vec![
        env,
        b,
        g2(env, &vk::VK_BETA),
        g2(env, &vk::VK_GAMMA),
        g2(env, &vk::VK_DELTA),
    ];
    bn.pairing_check(vp1, vp2)
}

/// Fold a recipient `Address` into the single field element the circuit binds:
/// `recipient = ed25519_pubkey mod r`. Deriving this from the actual payout
/// address is what stops a front-runner from keeping a valid proof but
/// redirecting the funds — changing the address changes this public input.
pub fn address_to_field(_env: &Env, addr: &Address) -> BytesN<32> {
    let pk: BytesN<32> = match addr.to_payload() {
        Some(AddressPayload::AccountIdPublicKeyEd25519(b)) => b,
        Some(AddressPayload::ContractIdHash(b)) => b,
        None => panic!("recipient address has no extractable key"),
    };
    // from_bytes reduces mod r, matching the JS `bytesToField`.
    Bn254Fr::from_bytes(pk).to_bytes()
}
