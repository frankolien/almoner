# Almoner — Demo script

Two to three minutes, five beats. The video is judged as heavily as the code — keep it concrete and
the fraud + audit beats tight, so it reads as infrastructure, not a pitch.

Run `npm run dev` and open the three-surface UI, with a Stellar testnet explorer in a second tab.

---

### 1 · Setup (15s) — Org admin tab

> "Stellar already disburses real aid — UNHCR, the Marshall Islands UBI, Bermuda. But every payout is
> permanently public. For a refugee, that's a safety risk."

On the **Org console**, click **Register cohort + post root on-chain** (5 beneficiaries, root committed
on Soroban) and **Fund pool**. Click **Issue claim link** on a beneficiary → a **QR voucher** appears.

> "The org hands each beneficiary a credential — a QR at a registration center, a card, or an SMS. It
> carries everything she needs to prove, and nothing that identifies her on-chain."

### 2 · The magic (40s) — Claim app (open the link / scan the QR)

Click **Open claim app** (in the demo; in the field she scans the QR on her phone). A clean claim
screen: *"Carmen, you qualify for 100 USDC."* Tap **Claim my aid** and narrate the log:

> "The proof generates on her device — her secret never leaves it. A fresh wallet is created with gas
> sponsored by a relayer: **she holds zero XLM and pays nothing.** USDC lands."

Open the explorer on the claim tx:

> "The public ledger shows only a hash and a payout to a brand-new address. **We never saw her
> identity, not even once** — and she needed no crypto, no wallet, no fees."

### 3 · Anti-fraud (25s) — Claim app

Click **Try to claim again** — it re-proves to a brand-new wallet and the contract still rejects it.

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
