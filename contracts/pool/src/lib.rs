#![no_std]
//! Almoner pool — confidential, auditable aid disbursement on Soroban.
//!
//! A beneficiary proves, in their browser, that they belong to a registered
//! cohort and satisfy the program policy, then claims USDC to a fresh address.
//! The pool verifies a Groth16 proof (native BN254 pairing), enforces a
//! per-program nullifier against double-claims, and transfers the USDC — all
//! without the beneficiary revealing or signing with their identity.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Bytes,
    BytesN, Env, Vec,
};

mod verifier;
mod vk;
use verifier::Proof;

#[cfg(test)]
mod test;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    ProgramExists = 2,
    NoProgram = 3,
    AlreadyClaimed = 4,
    InvalidProof = 5,
    InvalidAmount = 6,
}

/// Per-program state: the cohort root, the public policy parameters, and
/// running totals (the totals are convenience views — the authoritative claim
/// record is the spent-nullifier set).
#[contracttype]
#[derive(Clone)]
pub struct ProgramConfig {
    pub merkle_root: BytesN<32>,
    pub allowed_region: u32,
    pub min_birth_year: u32,
    pub required_tier: u32,
    pub total_claimed: i128,
    pub claim_count: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Program(u32),
    Spent(u32, BytesN<32>),
    Nullifiers(u32),
    Memos(u32),
}

// Storage TTL management (testnet-friendly ~30 day windows).
const DAY_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_LEDGERS;
const BUMP_AMOUNT: u32 = 60 * DAY_LEDGERS;

#[contract]
pub struct AlmonerPool;

#[contractimpl]
impl AlmonerPool {
    /// Deploy-time constructor: bind the organization admin and the USDC token.
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// The org registers a disbursement program: commit the cohort Merkle root
    /// and freeze the public policy (region / age / tier). Admin-authorized.
    #[allow(deprecated)] // events().publish is stable + sufficient for v1
    pub fn create_program(
        env: Env,
        program_id: u32,
        merkle_root: BytesN<32>,
        allowed_region: u32,
        min_birth_year: u32,
        required_tier: u32,
    ) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::Program(program_id))
        {
            return Err(Error::ProgramExists);
        }

        let cfg = ProgramConfig {
            merkle_root: merkle_root.clone(),
            allowed_region,
            min_birth_year,
            required_tier,
            total_claimed: 0,
            claim_count: 0,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Program(program_id), &cfg);
        env.storage()
            .persistent()
            .set(&DataKey::Nullifiers(program_id), &Vec::<BytesN<32>>::new(&env));

        env.events()
            .publish((symbol_short!("program"), program_id), merkle_root);
        Ok(())
    }

    /// Fund the USDC pool. Anyone (typically the donor/org) may top it up.
    pub fn fund(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        from.require_auth();
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        token::Client::new(&env, &token).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        Self::bump_instance(&env);
        Ok(())
    }

    /// The heart of Almoner. Verify a beneficiary's Groth16 proof and disburse.
    ///
    /// There is deliberately **no `require_auth` for the beneficiary**: the
    /// proof is the authorization. A relayer or the fresh recipient account can
    /// submit it, so the beneficiary's real identity never signs anything.
    ///
    /// Checks, in order (matching the architecture doc):
    ///   1. submitted root matches the stored root for the program
    ///   2. policy params in the public signals match the stored config
    ///   3. the nullifier is unused
    ///   4. the Groth16 proof verifies against the public signals
    ///   5. mark the nullifier spent
    ///   6. transfer the USDC to the fresh recipient
    ///
    /// Checks 1 and 2 are enforced *by construction*: the contract builds the
    /// public-signal vector from its own trusted storage, so a prover who used
    /// a different root or a lenient policy simply fails verification.
    #[allow(deprecated)] // events().publish is stable + sufficient for v1
    pub fn claim(
        env: Env,
        program_id: u32,
        nullifier_hash: BytesN<32>,
        recipient: Address,
        payout_amount: i128,
        proof: Proof,
        memo: Bytes,
    ) -> Result<(), Error> {
        if payout_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut cfg: ProgramConfig = env
            .storage()
            .persistent()
            .get(&DataKey::Program(program_id))
            .ok_or(Error::NoProgram)?;

        // (3) nullifier must be unused
        let spent_key = DataKey::Spent(program_id, nullifier_hash.clone());
        if env.storage().persistent().has(&spent_key) {
            return Err(Error::AlreadyClaimed);
        }

        // Bind the payout to the actual on-chain recipient: derive the field
        // element from the recipient Address itself, so a front-runner cannot
        // keep the proof but redirect the funds — changing the recipient
        // changes this public input and breaks verification.
        let recipient_field = verifier::address_to_field(&env, &recipient);

        // (1)+(2) Reconstruct public signals from TRUSTED state + bound values.
        let public_inputs = [
            cfg.merkle_root.clone(),  
            field_from_u32(&env, program_id),
            nullifier_hash.clone(),
            recipient_field,
            field_from_i128(&env, payout_amount),
            field_from_u32(&env, cfg.allowed_region),
            field_from_u32(&env, cfg.min_birth_year),
            field_from_u32(&env, cfg.required_tier),
        ];

        // (4) on-chain Groth16 verification (native BN254 pairing)
        if !verifier::verify(&env, &proof, &public_inputs) {
            return Err(Error::InvalidProof);
        }

        // (5) mark spent — both the O(1) presence key and the auditor list
        env.storage().persistent().set(&spent_key, &true);
        let mut nullifiers: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&DataKey::Nullifiers(program_id))
            .unwrap_or_else(|| Vec::new(&env));
        nullifiers.push_back(nullifier_hash.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Nullifiers(program_id), &nullifiers);

        // Record the encrypted audit memo — opaque bytes the contract never
        // reads. Only the donor's view key can decrypt it, enabling
        // reconstruction without the org's plaintext registration table.
        let mut memos: Vec<Bytes> = env
            .storage()
            .persistent()
            .get(&DataKey::Memos(program_id))
            .unwrap_or_else(|| Vec::new(&env));
        memos.push_back(memo);
        env.storage()
            .persistent()
            .set(&DataKey::Memos(program_id), &memos);

        cfg.total_claimed += payout_amount;
        cfg.claim_count += 1;
        env.storage()
            .persistent()
            .set(&DataKey::Program(program_id), &cfg);

        // (6) transfer USDC to the fresh, unlinkable recipient
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        token::Client::new(&env, &token).transfer(
            &env.current_contract_address(),
            &recipient,
            &payout_amount,
        );

        env.events().publish(
            (symbol_short!("claim"), program_id),
            (nullifier_hash, recipient, payout_amount),
        );
        Self::bump_instance(&env);
        Ok(())
    }

    // --------------------------- views ---------------------------

    pub fn is_spent(env: Env, program_id: u32, nullifier_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Spent(program_id, nullifier_hash))
    }

    pub fn get_program(env: Env, program_id: u32) -> Option<ProgramConfig> {
        env.storage().persistent().get(&DataKey::Program(program_id))
    }

    /// The on-chain spent-nullifier set — the auditor matches expected hashes
    /// against this to reconstruct exactly who claimed and the program total.
    pub fn spent_nullifiers(env: Env, program_id: u32) -> Vec<BytesN<32>> {
        env.storage()
            .persistent()
            .get(&DataKey::Nullifiers(program_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// The on-chain encrypted audit memos — each one decryptable only by the
    /// donor's view key, for cryptographic selective disclosure.
    pub fn claim_memos(env: Env, program_id: u32) -> Vec<Bytes> {
        env.storage()
            .persistent()
            .get(&DataKey::Memos(program_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn pool_balance(env: Env) -> i128 {
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        token::Client::new(&env, &token).balance(&env.current_contract_address())
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Token).unwrap()
    }

    fn bump_instance(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }
}

/// Encode a small unsigned integer as a 32-byte big-endian field element,
/// matching how the circuit/snarkjs represent the value as a public signal.
fn field_from_u32(env: &Env, v: u32) -> BytesN<32> {
    let mut buf = [0u8; 32];
    buf[28..32].copy_from_slice(&v.to_be_bytes());
    BytesN::from_array(env, &buf)
}

/// Encode a non-negative i128 (USDC base units) as a 32-byte BE field element.
fn field_from_i128(env: &Env, v: i128) -> BytesN<32> {
    let u = v as u128; // callers guarantee v >= 0
    let mut buf = [0u8; 32];
    buf[16..32].copy_from_slice(&u.to_be_bytes());
    BytesN::from_array(env, &buf)
}
