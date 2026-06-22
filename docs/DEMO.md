# Almoner — Demo script

Two to three minutes, five beats. The video is judged as heavily as the code — keep it concrete and
the fraud + audit beats tight, so it reads as infrastructure, not a pitch.

Run `npm run dev` and open the three-surface UI, with a Stellar testnet explorer in a second tab.

---

### 1 · Setup (15s) — Org admin tab

> "Stellar already disburses real aid — UNHCR, the Marshall Islands UBI, Bermuda. But every payout is
> permanently public. For a refugee, that's a safety risk."

Click **Register cohort + post root on-chain**. A cohort of 5 beneficiaries is issued, the Merkle root
is committed on Soroban, and the registration table appears. Click **Fund pool**.

### 2 · The magic (40s) — Beneficiary tab

Pick a beneficiary, click **Prove eligibility & claim**. Narrate as the log streams:

> "The proof generates locally — the secret never leaves this browser. One Groth16 proof attests cohort
> membership and four conditions: region, age over 18, tier, and KYC."

USDC lands in a fresh wallet. Open the explorer on the claim tx:

> "Cut to the public ledger: no identity, just a hash and a payout to a brand-new address. **We never
> saw their identity, not even once.**"

### 3 · Anti-fraud (25s) — Beneficiary tab

Click **Try to claim again**. The contract rejects it.

> "The per-program nullifier recomputes to the same hash, which is already spent. **We don't know who
> you are, but we know you already claimed.** That kills the duplicate- and ghost-beneficiary fraud
> that aid programs actually suffer from."

### 4 · Auditability (30s) — Auditor tab

Click **Reconstruct from on-chain spent set**.

> "The donor holds the registration table, so they recompute each expected nullifier hash and match it
> against the chain: **X of 5 claimed, total USDC, every payout matched to an eligible beneficiary** —
> while the public ledger shows none of it. Private to the world, provable to the donor."

### 5 · The tease (15s)

> "Same proof, swap the contract: confidential payroll, subsidies, UBI. Almoner is the privacy layer
> for the disbursement use case Stellar is already famous for."

---

### One-command version

`npm run demo:e2e` runs all five beats headless against live testnet and prints the result.
