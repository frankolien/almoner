# Almoner

**Confidential, auditable aid disbursement on Stellar, powered by zero-knowledge proofs.**

> A refugee proves she qualifies, receives her aid, and her identity never lands on a public
> blockchain — yet the donor can still prove every dollar reached someone eligible.

**Private to the world. Provable to the donor.**

Built for **Stellar Hacks: Real-World ZK** (SDF). Groth16 (Circom) proofs over **BN254**, verified
on-chain by a **Soroban** smart contract using Stellar's native pairing host functions. USDC on
Stellar testnet. Proving runs entirely client-side.

---

## The three questions, answered

### 1. What real-world problem does it solve?

Stellar already moves billions in real disbursements — **UNHCR Stellar Aid Assist** (USDC to
displaced people), the **Marshall Islands** UBI (33,000+ residents, Dec 2025), **Bermuda** public-
sector payments. Aid Assist sells itself on *full traceability* — and that is exactly the problem.
Every beneficiary's receipt of aid is written to a permanent public ledger. For refugees, conflict-
zone civilians, and benefit recipients, that permanent record is a **targeting and safety risk**.

Almoner closes the gap nobody else has: **disburse aid to many eligible people privately, while still
proving to the funder that every dollar landed where it should.** Not a shielded peer-to-peer
transfer (that lane is saturated by [Stellar Private Payments](https://github.com/NethermindEth/stellar-private-payments)) — confidential *one-to-many, eligibility-gated, fraud-resistant, donor-auditable* disbursement.

### 2. Where does the ZK add genuine value?

Donors need **accountability**; beneficiaries need **privacy**. A public ledger cannot give both at
once — a zero-knowledge proof is the only thing that can. The beneficiary proves, in their own
browser, **four eligibility conditions plus a nullifier in a single Groth16 proof**:

| | Condition | Enforced by |
|---|---|---|
| **A** | Cohort membership | Merkle inclusion of a Poseidon leaf commitment |
| **B** | Region allowed | `regionCode == allowedRegion` |
| **C** | Age ≥ 18 | `birthYear <= minBirthYear` |
| **D** | Correct tier + KYC | `programTier == requiredTier`, `kycFlag == 1` |
| **•** | No double-claim | per-program nullifier `Poseidon(nullifier, programId)` |

Every attribute is bound into one Poseidon leaf at registration, so a claimant **cannot lie** about
region, age, tier, or amount — changing any input produces a different leaf that isn't in the tree.
The public sees only an opaque nullifier hash and a payout to a fresh address. The donor, holding the
registration table, reconstructs **exactly who claimed and the total** — invisible to the public.

### 3. How is it integrated with Stellar?

The proof is generated off-chain (client-side WASM) and **verified inside a Soroban smart contract**,
the canonical Stellar ZK integration. The pool contract uses Soroban's **native BN254 host functions**
(`env.crypto().bn254().pairing_check`, CAP-0074 / Protocol 25) to verify Groth16 on-chain cheaply,
enforces a per-program nullifier set against double-claims, and transfers **USDC** (a Stellar Asset
Contract) to the beneficiary's fresh address — all in one `claim()` call.

---

## Live on testnet

| | |
|---|---|
| Pool contract | [`CALJZBIF…DOI7M`](https://stellar.expert/explorer/testnet/contract/CALJZBIF4QBHCFP3ZQU7LP2ZI5IRYQ2ZQYLJQ6MVZCA6I5FLHDHDOI7M) |
| USDC token (SAC) | [`CBVYDNNV…SCY2`](https://stellar.expert/explorer/testnet/contract/CBVYDNNVSNGI5UDTRMHSRQZDSPOJHIE2VL5H2SJPAFWAPYAGFTSCSCY2) |
| Org / issuer | [`GAE2XMCT…HYFY`](https://stellar.expert/explorer/testnet/account/GAE2XMCTYBP6GW5UZ34KNXNGR4IAXVBTIEMJKSMWB4WNFPB472HUHYFY) |

A real proof has already been generated, **verified on-chain**, paid out, and a duplicate **rejected**
by the nullifier — reproduce it with `npm run demo:e2e`.

---

## How it works, end to end

```
 ORG / ISSUER                  SOROBAN POOL                     FRESH WALLET
 registers cohort   ──root──▶  ├ Merkle root (per program)  ──▶ receives USDC
 funds USDC pool               ├ spent-nullifier set            (unlinkable)
                               ├ USDC vault
 BENEFICIARY        ──proof──▶ └ BN254 Groth16 verifier
 proves in-browser   + claim
                                                                AUDITOR / DONOR
                                              view-key recon ──▶ reconstructs totals
```

1. **Register.** The org issues each beneficiary a secret, computes a leaf commitment binding their
   attributes + entitlement, builds a Merkle tree, posts the **root** on Soroban, and funds the pool.
2. **Prove.** A beneficiary enters their secret in the browser. WASM generates one Groth16 proof
   attesting membership + the four conditions. **The secret never leaves the device.**
3. **Claim.** The proof, a nullifier hash, and a fresh recipient address go to `claim()`. The contract
   reconstructs the public signals from its own trusted storage, verifies the proof, checks the
   nullifier is unused, marks it spent, and transfers USDC.
4. **Block fraud.** A second claim recomputes the same nullifier hash, which is already spent — rejected.
5. **Audit.** The donor recomputes each registered beneficiary's expected `Poseidon(nullifier, programId)`
   and matches it against the on-chain spent set: "23 of 50 claimed, 4,600 USDC, all eligible."

---

## How real users use it

Almoner is built so a **non-crypto beneficiary** can receive aid with no wallet, no seed phrase, and
no gas. Three surfaces, three roles:

- **Org console** (operator) — import the already-vetted cohort, post the root, fund the pool, and
  **issue each beneficiary a claim credential** (a QR / link / printed voucher).
- **Claim app** (beneficiary) — opens the credential link on any phone. Taps "Claim my aid." The proof
  generates on-device, a fresh wallet is created, and USDC lands — then they cash out at a Stellar
  anchor. *(In the repo: the standalone `#claim=<credential>` route.)*
- **Auditor dashboard** (donor) — reconstructs who claimed and the total through the registration table.

Two decisions make it usable by anyone:

1. **A credential, not a wallet.** The voucher (`app/src/lib/credential.ts`) is self-contained — it
   carries the secret, attributes, and Merkle path, so the beneficiary proves from any device with
   nothing else. Lose it → the org re-issues from the registration table.
2. **Zero-gas via a relayer + Stellar sponsored reserves.** Because the proof *is* the authorization
   (no beneficiary signature), a **relayer** sponsors the fresh account, the USDC trustline, and the
   claim fee (`sponsorFreshAccount` in `app/src/lib/pool.ts`). The beneficiary holds **0 XLM** and the
   relayer can't deanonymize them — it only ever sees a valid proof + a fresh address.

**Cash-out** happens through existing Stellar anchors (the same MoneyGram / local-agent off-ramps UNHCR
Aid Assist already uses). KYC at the anchor is a private, compliant disclosure — never a public-ledger
record linking the beneficiary to the aid program.

**What's deliberately off-code in v1** (documented, not hidden): the org account is a single testnet
key (production: multisig / HSM treasury); the relayer key lives in the browser for the demo
(production: a server-side relayer service); anchor cash-out is referenced, not integrated.

---

## Repository layout

```
circuits/   Circom circuit (aid_claim.circom) + Groth16 trusted-setup tooling
lib/        Shared TypeScript: Poseidon, Merkle tree, nullifiers, witness/prover,
            and the snarkjs→Soroban byte encoding (one source of truth, browser + Node)
contracts/  Soroban (Rust): the pool contract + an inlined BN254 Groth16 verifier
server/     Backend (Hono): relayer + operator signing service — holds keys, exposes /api/*
app/        React/TS frontend — pure client (crypto + proving + UI), no keys
scripts/    gen-vk, deploy, e2e, gen-fixture, browser-claim
docs/       ARCHITECTURE.md, DEMO.md
.github/    CI (app, contracts, circuit selftest, secret scan)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive (circuit signals, the recipient
binding, the on-chain `claim()` checks, and the BN254 encoding).

## Tech stack & reuse

We reuse SDF's open-source plumbing and spend novel effort on the disbursement logic.

| Layer | What | Build / reuse |
|---|---|---|
| Proof system | Circom + Groth16 (snarkjs), **BN254** | reuse tooling |
| Proving runtime | Client-side WASM (browser) | reuse pattern |
| On-chain verifier | Soroban native `bn254().pairing_check` | reuse host fns |
| Smart contract | Soroban (Rust): registry + pool + verifier | **our build** |
| Circuit | cohort membership + 4 conditions + nullifier | **our build** |
| Frontend | React / TypeScript, three surfaces | **our build** |
| Asset | USDC on Stellar testnet | reuse |

**Why BN254 (not the official BLS12-381 example)?** Almoner is Poseidon-heavy on the JS side (the
Merkle tree, leaf commitments, and nullifiers are computed in the browser via `circomlibjs`, which is
BN254-native). BN254 gives us `circomlibjs` Poseidon for free, the snarkjs default toolchain, **and**
cheap native on-chain verification (`env.crypto().bn254()`, Protocol 25+).

---

## Quickstart

Prereqs: Node ≥ 20, Rust nightly (with `rust-src`), [`circom`](https://docs.circom.io) 2.x, the
[`stellar`](https://developers.stellar.org/docs/tools/cli) CLI.

```bash
npm install

# 1) Compile the circuit + run a local Groth16 trusted setup (wasm, zkey, vkey)
npm run circuit:build

# 2) Prove the JS crypto matches the circuit, end to end (generates + verifies a proof)
npm run lib:test

# 3) Generate the on-chain verification key, build + test the contract
npm run gen:vk
npm run contracts:build
npm run contracts:test

# 4) Deploy USDC + the pool to testnet
#    Writes public config to app/public/deployment.json AND secrets to .env (gitignored)
npm run deploy:testnet

# 5) Run the whole flow against testnet (prove → claim → double-claim → reconstruct)
npm run demo:e2e

# 6) Run the app — starts the backend (relayer + operator API) AND the UI together
npm run dev      # API on :8787, UI on http://localhost:5173
```

> **Build note:** soroban-sdk 26 requires the `wasm32v1-none` target. `npm run contracts:build`
> uses `cargo -Zbuild-std` (nightly) so no extra target download is needed.

### Keys never touch the browser

`npm run dev` runs a **backend** (`server/`, Hono) that holds the org + relayer keys (from `.env`) and
does all chain-signing — the org creates programs, and the relayer sponsors fresh accounts + pays claim
fees. The frontend is a pure client: it generates the proof on-device and posts it to the relayer. Secrets
live only in `.env` (gitignored; production: KMS/Vault), never in the repo or the browser.

---

## Scope (v1)

**In:** one end-to-end disbursement program on testnet · single Groth16 circuit, four conditions,
nullifier · identity-private, amount-public (standardized per tier) · org / beneficiary / auditor
surfaces · live double-claim rejection.

**Out (tease only):** full amount-hiding (needs an encrypted-note pool) · multi-region set proofs
(single region in v1) · production audits / key management · mainnet.

### Being surgical about privacy

The eligibility **root** and the **USDC movement** are public — only the *link* between a registered
member and a claim is hidden. Entitlements are standardized per tier, so the public `payoutAmount`
reveals only a tier shared by many people, never the person. In v1 the "view key" is controlled
access to the registration table; an optional stronger version encrypts a memo to an auditor public
key for cryptographic selective disclosure.

## License

MIT.
