#![cfg(test)]
//! Unit tests for the contract's deterministic control flow. The full Groth16
//! proof path (valid claim, double-claim rejection, on-chain BN254 verification)
//! is exercised end-to-end against live testnet by `scripts/e2e.ts` — a real
//! proof is required to make `pairing_check` succeed, so it can't be faked here.

use super::*;
use crate::verifier::Proof;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Bytes, BytesN, Env};

fn zero_proof(env: &Env) -> Proof {
    Proof {
        a: BytesN::from_array(env, &[0u8; 64]),
        b: BytesN::from_array(env, &[0u8; 128]),
        c: BytesN::from_array(env, &[0u8; 64]),
    }
}

fn setup() -> (Env, AlmonerPoolClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = sac.address();
    let pool_id = env.register(AlmonerPool, (admin.clone(), token.clone()));
    let client = AlmonerPoolClient::new(&env, &pool_id);
    (env, client, admin, token)
}

#[test]
fn constructor_sets_admin_and_token() {
    let (_, client, admin, token) = setup();
    assert_eq!(client.admin(), admin);
    assert_eq!(client.token(), token);
}

#[test]
fn create_and_get_program() {
    let (env, client, _, _) = setup();
    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.create_program(&1, &root, &963, &2008, &1);
    let cfg = client.get_program(&1).unwrap();
    assert_eq!(cfg.merkle_root, root);
    assert_eq!(cfg.allowed_region, 963);
    assert_eq!(cfg.min_birth_year, 2008);
    assert_eq!(cfg.required_tier, 1);
    assert_eq!(cfg.claim_count, 0);
    assert_eq!(cfg.total_claimed, 0);
}

#[test]
fn duplicate_program_rejected() {
    let (env, client, _, _) = setup();
    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.create_program(&1, &root, &963, &2008, &1);
    let res = client.try_create_program(&1, &root, &963, &2008, &1);
    assert_eq!(res, Err(Ok(Error::ProgramExists)));
}

#[test]
fn fund_increases_pool_balance() {
    let (env, client, admin, token) = setup();
    StellarAssetClient::new(&env, &token).mint(&admin, &1_000_0000000);
    assert_eq!(client.pool_balance(), 0);
    client.fund(&admin, &500_0000000);
    assert_eq!(client.pool_balance(), 500_0000000);
}

#[test]
fn fund_rejects_non_positive() {
    let (_, client, admin, _) = setup();
    assert_eq!(client.try_fund(&admin, &0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(client.try_fund(&admin, &-5), Err(Ok(Error::InvalidAmount)));
}

#[test]
fn claim_on_missing_program_errors() {
    let (env, client, _, _) = setup();
    let recipient = Address::generate(&env);
    let nh = BytesN::from_array(&env, &[1u8; 32]);
    let res = client.try_claim(&99, &nh, &recipient, &100_0000000, &zero_proof(&env), &Bytes::new(&env));
    assert_eq!(res, Err(Ok(Error::NoProgram)));
}

#[test]
fn claim_rejects_non_positive_amount() {
    let (env, client, _, _) = setup();
    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.create_program(&1, &root, &963, &2008, &1);
    let recipient = Address::generate(&env);
    let nh = BytesN::from_array(&env, &[1u8; 32]);
    let res = client.try_claim(&1, &nh, &recipient, &0, &zero_proof(&env), &Bytes::new(&env));
    assert_eq!(res, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn is_spent_false_for_unused_nullifier() {
    let (env, client, _, _) = setup();
    let nh = BytesN::from_array(&env, &[9u8; 32]);
    assert!(!client.is_spent(&1, &nh));
    assert_eq!(client.spent_nullifiers(&1).len(), 0);
}
