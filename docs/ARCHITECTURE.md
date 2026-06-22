# Almoner — Architecture

Confidential aid disbursement: three actors, one Soroban contract, one Groth16 circuit.

```
ORG / ISSUER ──registers cohort root + funds──▶ SOROBAN POOL ──USDC──▶ FRESH WALLET
BENEFICIARY  ──Groth16 proof + claim──────────▶  (verifier)
AUDITOR      ──view-key reconstruction off-ledger──────────────────────  registration table
```

Nothing links a registered identity to a claim on the public chain.

---

## 1. The zero-knowledge circuit (`circuits/src/aid_claim.circom`)

One Circom circuit compiled to Groth16 over **BN254**. Every beneficiary attribute is bound into a
single Poseidon leaf commitment at registration:

```
commitment = Poseidon(secret, nullifier, regionCode, programTier, birthYear, kycFlag, entitlement)
```

### Signals

| Signal | Visibility | Role |
|---|---|---|
| `secret` | private | proves the claimant owns this leaf |
| `nullifier` | private | seeds the anti-double-claim hash |
| `regionCode`, `programTier`, `birthYear`, `kycFlag`, `entitlement` | private | committed attributes |
| `pathElements`, `pathIndices` | private | Merkle authentication path |
| `merkleRoot` | public | registered cohort root, stored on-chain |
| `programId` | public | identifies the round; salts the nullifier |
| `nullifierHash` | public | stored by the contract to block reuse |
| `recipient` | public | fresh payout address, **bound into the proof** |
| `payoutAmount` | public | must equal `entitlement` |
| `allowedRegion`, `minBirthYear`, `requiredTier` | public | program policy parameters |

### The four conditions + nullifier

- **A — membership:** recompute the leaf, prove Merkle inclusion against `merkleRoot`
  (`merkle.circom`: a `Poseidon(2)` tree with a `DualMux` that orders (left,right) by the path bit,
  with booleanity enforced on each bit).
- **B — region:** `regionCode === allowedRegion`.
- **C — age:** `LessEqThan(16)` enforces `birthYear <= minBirthYear` (born in/before the cutoff ⇒ ≥ 18).
- **D — tier + KYC:** `programTier === requiredTier`, `kycFlag === 1`.
- **nullifier:** `nullifierHash === Poseidon(nullifier, programId)`.
- **payout:** `payoutAmount === entitlement`.

The circuit compiles to ~10k constraints; proving takes **~1 s** in Node and in the browser.

### Recipient binding (anti front-running)

`recipient` is a public input forced into the witness by a single multiplicative constraint
(`recipientSquared <== recipient * recipient`). Because every public input is part of the Groth16
verification equation, a front-runner who copies a pending `(proof, recipient)` **cannot change the
recipient** without invalidating the proof. A Stellar ed25519 key is 32 bytes (> the BN254 field), so
`recipient` is the key **reduced mod r**; the contract re-derives the exact same value from the payout
`Address` (see §3), closing the redirect attack entirely.

---

## 2. The shared crypto library (`lib/`)

Pure TypeScript, identical in Node and the browser (run via `tsx` / bundled by Vite — no build step).

- `poseidon.ts` — wraps `circomlibjs` Poseidon, **bit-for-bit identical** to the circuit's
  `Poseidon(n)` (validated by `lib/test/selftest.ts`, which generates a real proof and checks the
  public signals equal the JS-computed root + nullifier).
- `merkle.ts` — a fixed-depth (16) Poseidon Merkle tree. Only the filled prefix is materialized; the
  rest folds in via precomputed zero-subtree roots, so a 65k-capacity tree with 50 leaves is cheap.
- `commitment.ts`, `registry.ts` — leaf commitment, per-program nullifier, cohort building, and the
  **auditor reconstruction** (`reconstruct`): recompute each `Poseidon(nullifier, programId)` and match
  it against the on-chain spent set.
- `prover.ts` — assembles the witness and drives snarkjs `groth16.fullProve`.
- `groth16.ts` — the **one place** that knows the snarkjs→Soroban byte encoding (see §4), shared by the
  VK generator, the e2e harness, and the browser claim path so they can never disagree.

---

## 3. On-chain design (`contracts/pool`)

A single Soroban contract holds, per program, the Merkle root, the policy config, the spent-nullifier
set, and the USDC vault. The Groth16 verifier is an inlined module (`verifier.rs`) — logically the
"reference verifier," kept in-process to avoid cross-contract overhead.

### `claim()` checks, in order

```rust
claim(program_id, nullifier_hash, recipient: Address, payout_amount, proof)
```

1. submitted root matches the stored root for `program_id`
2. policy params in the public signals match the stored config
3. the `nullifier_hash` is not already spent
4. the Groth16 proof verifies against the public signals
5. mark the nullifier spent
6. transfer `payout_amount` USDC to `recipient`

**Checks 1 and 2 are enforced by construction:** the contract builds the public-signal vector from its
*own trusted storage* (`merkle_root`, `allowed_region`, `min_birth_year`, `required_tier`) plus the
caller-supplied `nullifier_hash` / `payout_amount` and the recipient field it derives itself. A prover
who used a different root or a lenient policy simply fails verification — there is no separate equality
check to forget.

**No `require_auth` for the beneficiary.** The proof *is* the authorization; a relayer or the fresh
recipient account submits the transaction, so the beneficiary's real identity never signs anything.
The contract authorizes only its own USDC transfer.

### Recipient derivation

`verifier::address_to_field` extracts the recipient's 32-byte ed25519 key from the `Address`
(`to_payload`, `hazmat-address` feature) and reduces it mod r via `Bn254Fr::from_bytes` — exactly the
JS `bytesToField`. This public input is therefore **derived from the actual payout address**, so the
proof is bound to where the money goes.

---

## 4. BN254 Groth16 verification on Soroban

The verifier uses Soroban's native BN254 host functions (soroban-sdk 26, CAP-0074 / Protocol 25):

```rust
// e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1,  vk_x = IC[0] + Σ pub_i·IC[i+1]
let bn = env.crypto().bn254();
let mut vk_x = IC[0];
for i in 0..NUM_PUBLIC { vk_x = bn.g1_add(&vk_x, &bn.g1_mul(&IC[i+1], &Fr::from_bytes(pub[i]))); }
bn.pairing_check(vec![-A, alpha, vk_x, C], vec![B, beta, gamma, delta])
```

**Encoding (`lib/groth16.ts`), Ethereum-compatible uncompressed:**

- **G1** (64 bytes): `be(x) || be(y)`.
- **G2** (128 bytes): `be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0)` — snarkjs stores Fp2 as `[c0, c1]`
  (real first); the host wants `[c1, c0]` (imaginary first), **so G2 needs the swap.** This is the
  one subtle footgun; getting it right is what makes on-chain verification succeed.
- **Fr** (32 bytes): big-endian, auto-reduced mod r.

The verification key is generated from the snarkjs `verification_key.json` into `contracts/pool/src/vk.rs`
by `scripts/gen-vk.ts` (`npm run gen:vk`), so the proving and verifying keys can never drift.

---

## 5. What is public vs private

| Public on-chain | Private / off-ledger |
|---|---|
| cohort Merkle root, policy params | every beneficiary attribute (region, age, tier, KYC) |
| nullifier hashes (one-way) | the secret, the nullifier preimage |
| payouts to fresh addresses | the link between a member and a claim |
| program totals (derivable) | who specifically claimed (only the donor can reconstruct) |

The eligibility root and USDC movement are public; only the member↔claim link is hidden. We say so out
loud — this is identity privacy, not amount-hiding.

---

## 6. Build & deploy notes

- **Contract target:** soroban-sdk 26 requires `wasm32v1-none`. `npm run contracts:build` uses
  `cargo +nightly -Zbuild-std=core,alloc,panic_abort --target wasm32v1-none`.
- **Trusted setup:** `circuits/scripts/build.sh` generates Powers of Tau locally (no download) and runs
  the Groth16 setup, emitting `aid_claim.wasm` (witness generator), `aid_claim.zkey` (proving key), and
  `aid_claim.vkey.json` (verification key).
- **Resilience:** `app/src/lib/pool.ts` wraps every RPC op in `withRetry`; all failures occur during
  simulate/assemble (pre-submission), so retries are safe.

---

## 7. Real-deployment UX (zero-crypto beneficiary)

Three role-scoped surfaces, routed by hash in `App.tsx`: **Org console** + **Auditor** (`#app` / `#audit`)
and a standalone **Claim app** (`#claim=<credential>`).

### Bearer credential (`app/src/lib/credential.ts`)

The org issues each beneficiary a self-contained voucher — `{ secret, nullifier, attributes, policy,
programId, Merkle path }` encoded base64url into a `#claim=` URL (rendered as a QR). It carries
everything needed to prove, so the beneficiary claims from any device with nothing else installed;
`buildClaimInputFromPath` lets the prover run from the bundled path without the full tree. Whoever holds
the credential can claim **once** (the nullifier enforces it) — exactly a cash-voucher trust model.

### Zero-gas via relayer + sponsored reserves (`sponsorFreshAccount`)

Because the proof *is* the authorization (no beneficiary `require_auth`), a **relayer** submits and pays.
For onboarding it wraps the fresh account in Stellar **sponsored reserves**:

```
beginSponsoringFutureReserves(fresh) · createAccount(fresh, 0) ·
changeTrust(USDC)[fresh signs] · endSponsoringFutureReserves[fresh signs]
```

The relayer pays the fee + base reserves; the fresh account only co-signs to authorize its own
trustline. The beneficiary ends up with a funded, trustline-ready wallet holding **0 XLM**, having paid
nothing. The relayer sees only a valid proof + a fresh address, so it can't deanonymize anyone. Validated
end-to-end on testnet by `scripts/e2e.ts` and in a real browser by `scripts/browser-claim.ts`.

### Off-code in v1 (documented limits)

Org account = single testnet key (prod: multisig / HSM); relayer key in-browser for the demo (prod:
server-side relayer service); anchor cash-out referenced, not integrated.
