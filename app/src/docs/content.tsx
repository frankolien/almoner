import type { ReactNode } from 'react';
import { Note, Code, Eq, Steps } from './Docs.js';

// External links — edit these to point at your real repo / socials.
export const GITHUB_URL = 'https://github.com/frankolien/almoner';
export const DORAHACKS_URL = 'https://dorahacks.io/hackathon/stellar-hacks-zk/detail';
export const STELLAR_URL = 'https://stellar.org';
export const X_URL = 'https://x.com/frank_olien123';

export const GROUPS = ['Start here', 'Concepts — no math needed', 'The protocol — deeper'] as const;

export interface DocSection {
  slug: string;
  group: (typeof GROUPS)[number];
  title: string;
  lede?: string;
  body: () => ReactNode;
}

/* ── tiny inline diagrams ────────────────────────────────────────────────── */
function MerkleDiagram() {
  return (
    <div className="doc-figure">
      <svg viewBox="0 0 420 200" className="doc-svg" aria-hidden>
        {/* edges */}
        <g stroke="var(--line-strong)" strokeWidth="1.5">
          <line x1="210" y1="40" x2="120" y2="92" />
          <line x1="210" y1="40" x2="300" y2="92" />
          <line x1="120" y1="108" x2="70" y2="160" />
          <line x1="120" y1="108" x2="170" y2="160" />
          <line x1="300" y1="108" x2="250" y2="160" />
          <line x1="300" y1="108" x2="350" y2="160" />
        </g>
        {/* root */}
        <g>
          <rect x="170" y="24" width="80" height="32" rx="8" fill="var(--accent-quiet)" stroke="var(--accent)" />
          <text x="210" y="44" className="doc-svg-t accent">root</text>
        </g>
        {/* mids */}
        <Node x={120} y={100} label="H(0,1)" />
        <Node x={300} y={100} label="H(2,3)" />
        {/* leaves */}
        <Node x={70} y={168} label="leaf 0" leaf hi />
        <Node x={170} y={168} label="leaf 1" leaf />
        <Node x={250} y={168} label="leaf 2" leaf />
        <Node x={350} y={168} label="leaf 3" leaf />
      </svg>
      <div className="doc-cap">A 4-leaf Merkle tree. Each parent is the hash of its two children; the <b>root</b> at the top summarizes all four leaves in one value.</div>
    </div>
  );
}
function Node({ x, y, label, leaf, hi }: { x: number; y: number; label: string; leaf?: boolean; hi?: boolean }) {
  return (
    <g>
      <rect x={x - 38} y={y - 16} width="76" height="30" rx="7"
        fill={hi ? 'var(--proof-quiet)' : 'var(--panel-raised)'} stroke={hi ? 'var(--proof)' : 'var(--line-strong)'} />
      <text x={x} y={y + 4} className={`doc-svg-t ${leaf ? 'mut' : ''} ${hi ? 'proof' : ''}`}>{label}</text>
    </g>
  );
}

function FlowDiagram() {
  const steps = ['Register', 'Prove', 'Verify', 'Pay out'];
  return (
    <div className="doc-figure">
      <div className="doc-flow">
        {steps.map((s, i) => (
          <div className="doc-flow-step" key={s}>
            <span className="doc-flow-n">{i + 1}</span>
            <span>{s}</span>
            {i < steps.length - 1 && <span className="doc-flow-arrow">→</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── sections ────────────────────────────────────────────────────────────── */
export const SECTIONS: DocSection[] = [
  {
    slug: 'introduction',
    group: 'Start here',
    title: 'What is Almoner?',
    lede: 'Almoner pays out aid to many eligible people privately — while still letting the funder prove every dollar reached someone who qualified.',
    body: () => (
      <>
        <p>
          Imagine a charity sending money to thousands of refugees. Today, if they use a public
          blockchain, <b>every payment is written down forever, for anyone to see</b>. That permanent
          public record — “this person received refugee aid” — can become a <b>targeting list</b> for the
          people a refugee is fleeing from.
        </p>
        <p>But the funder genuinely needs accountability: proof the money wasn’t stolen or sent to ghosts.</p>
        <Note kind="key">
          A public ledger forces a brutal trade-off: <b>privacy or accountability, pick one.</b> Almoner
          uses a <b>zero-knowledge proof</b> — the one tool that gives you both at the same time.
        </Note>
        <p>With Almoner:</p>
        <ul>
          <li><b>The world</b> sees only a payment to a brand-new wallet. No name, nothing linkable.</li>
          <li><b>The recipient</b> proves they qualify — without revealing who they are.</li>
          <li><b>The donor</b> can later reconstruct exactly who was paid and the total — and nobody else can.</li>
        </ul>
        <p className="doc-tag">Private to the world. Provable to the donor.</p>
        <p>
          Almoner is built on <b>Stellar</b>: proofs are checked inside a Soroban smart contract, and
          payouts are made in <b>USDC</b>. The rest of these docs explain, from zero, exactly how that
          works — including the math, in plain language.
        </p>
      </>
    ),
  },
  {
    slug: 'how-it-works',
    group: 'Start here',
    title: 'How it works, end to end',
    lede: 'Four steps: register the eligible people, let each one prove they qualify, verify the proof on-chain, and pay out.',
    body: () => (
      <>
        <FlowDiagram />
        <Steps
          items={[
            ['Register', <>The aid organization takes its already-vetted list of people, seals each person’s details into a single fingerprint (a <i>commitment</i>), and posts one summary value — the <b>Merkle root</b> — on Stellar. The list of names never goes on-chain.</>],
            ['Prove', <>A recipient opens a private link on their phone. Their device builds a <b>zero-knowledge proof</b> that says “I’m one of the registered people <i>and</i> I meet the rules” — without revealing which person.</>],
            ['Verify', <>The proof is sent to the <b>Soroban smart contract</b>, which checks it mathematically. If it’s valid, the contract knows the claim is legitimate — still without learning who claimed.</>],
            ['Pay out', <>The contract sends <b>USDC</b> to a fresh wallet, and records a one-time <b>nullifier</b> so the same person can’t claim twice.</>],
          ]}
        />
        <Note kind="tip">
          You don’t need to understand the cryptography to use Almoner — but the next sections explain it
          all from scratch, because it’s genuinely beautiful and it’s what makes this safe.
        </Note>
      </>
    ),
  },
  {
    slug: 'zero-knowledge',
    group: 'Concepts — no math needed',
    title: 'Zero-knowledge proofs, explained',
    lede: 'A way to prove a statement is true while revealing nothing except that it’s true.',
    body: () => (
      <>
        <p>Here’s the whole idea in one picture.</p>
        <Note kind="key" title="The Where’s-Waldo intuition">
          You claim you found Waldo in a giant crowded poster. To prove it, you could point at him — but
          then you’ve given away his location. Instead, you put a huge piece of cardboard with a tiny
          Waldo-shaped hole over the poster and show Waldo through the hole. Your friend sees Waldo… but
          the cardboard hides <i>where on the poster</i> he is. You proved you found him, and revealed
          nothing else.
        </Note>
        <p>
          A <b>zero-knowledge proof (ZKP)</b> is the digital version of that cardboard. It lets you prove
          “I know a secret that makes this statement true” while the verifier learns <b>only</b> that the
          statement is true — never the secret itself.
        </p>
        <p>A good ZKP has three properties:</p>
        <ul>
          <li><b>Complete</b> — if the statement is true, an honest prover always convinces the verifier.</li>
          <li><b>Sound</b> — if it’s false, a cheater can’t fake a valid proof (except with absurdly tiny luck).</li>
          <li><b>Zero-knowledge</b> — the proof leaks nothing beyond “true.”</li>
        </ul>
        <p>
          Almoner uses a specific, popular kind called <b>Groth16</b>. Its superpower: the proof is
          <b> tiny</b> (a few hundred bytes) and <b>fast to check</b> (milliseconds), which is exactly what
          you want when a blockchain has to verify it.
        </p>
        <p>In Almoner, the statement being proven is:</p>
        <Eq>“I am one of the registered recipients, and I satisfy every eligibility rule.”</Eq>
        <p>The “secret” is the recipient’s private credential. The proof reveals nothing about which person it is.</p>
      </>
    ),
  },
  {
    slug: 'commitments',
    group: 'Concepts — no math needed',
    title: 'Hashing & commitments',
    lede: 'A hash is a one-way blender. A commitment uses it to lock in your data so you can’t change it later.',
    body: () => (
      <>
        <h3>What’s a hash?</h3>
        <p>
          A <b>hash function</b> takes any input and produces a fixed-size, random-looking number. Two key
          properties:
        </p>
        <ul>
          <li><b>One-way</b> — easy to go forward (input → hash), practically impossible to go backward (hash → input).</li>
          <li><b>Collision-resistant</b> — you can’t find two different inputs with the same hash.</li>
        </ul>
        <p>Think of a blender: turning fruit into a smoothie is easy; turning the smoothie back into the original fruit is not.</p>
        <Note kind="note" title="Why “Poseidon”?">
          Almoner uses a hash called <b>Poseidon</b>. Ordinary hashes like SHA-256 are slow to prove
          inside a zero-knowledge circuit. Poseidon was designed specifically to be cheap for ZK math, so
          proofs stay fast.
        </Note>
        <h3>What’s a commitment?</h3>
        <p>
          A <b>commitment</b> is a hash of all your data bundled together. At registration, Almoner hashes
          every one of a recipient’s attributes into a single value called the <b>leaf commitment</b>:
        </p>
        <Code lang="text">{`leaf = Poseidon( secret, nullifier, region, tier, birthYear, kyc, amount )`}</Code>
        <p>
          Because the hash is one-way and collision-resistant, this leaf <b>locks everything in</b>. If a
          claimant later tries to lie — say, change their <code>birthYear</code> to look eligible — the hash
          changes completely, producing a <i>different</i> leaf that isn’t in the registered set. The proof
          then fails.
        </p>
        <Note kind="key">
          This is the trick that stops people lying about their own data: their attributes are sealed
          inside a commitment the organization vouched for. You can prove what’s in the seal — you can’t
          change it.
        </Note>
      </>
    ),
  },
  {
    slug: 'merkle-trees',
    group: 'Concepts — no math needed',
    title: 'Merkle trees',
    lede: 'A way to squeeze a whole list of people into one short value — and prove someone is in it without revealing the list.',
    body: () => (
      <>
        <p>
          Once every recipient has a leaf commitment, the organization needs to publish “here is the set of
          eligible people” — but <i>without</i> publishing the people. A <b>Merkle tree</b> does exactly that.
        </p>
        <MerkleDiagram />
        <p>
          You hash leaves together in pairs, then hash those results together, and so on, until a single
          value remains at the top: the <b>Merkle root</b>. The root is a fingerprint of the entire list.
          Change any leaf and the root changes.
        </p>
        <Note kind="key" title="The tournament-bracket analogy">
          Picture a sports bracket. Players are the leaves; each match produces a winner; the final winner
          is the root. To prove you played in the tournament, you don’t need the whole bracket — you just
          show the <b>chain of matches</b> from your seat up to the final. Anyone can replay those matches
          and check they end at the known champion (the root).
        </Note>
        <p>
          That “chain from your leaf to the root” is called a <b>Merkle proof</b> (or authentication path).
          In Almoner, the recipient’s private link carries their leaf’s path. Inside the zero-knowledge
          proof, their device recomputes the root from their leaf + path and shows it equals the root the
          organization posted on-chain — <b>proving membership without revealing which leaf.</b>
        </p>
        <p>Only the <b>root</b> (one value) is ever posted publicly. The list of leaves stays with the organization.</p>
      </>
    ),
  },
  {
    slug: 'nullifiers',
    group: 'Concepts — no math needed',
    title: 'Nullifiers: no double-claims',
    lede: 'A unique one-time tag that lets the contract block a second claim — without ever learning who you are.',
    body: () => (
      <>
        <p>
          Privacy creates a puzzle: if claims are anonymous, what stops one person from claiming ten times?
          The answer is a <b>nullifier</b>.
        </p>
        <p>Each recipient derives a unique tag from their own secret and the program:</p>
        <Eq>nullifierHash = Poseidon( nullifier, programId )</Eq>
        <p>
          The contract keeps a list of nullifiers it has already seen. The first claim records the tag; a
          second claim produces the <b>exact same tag</b>, the contract sees it’s already spent, and rejects
          the payout.
        </p>
        <Note kind="key">
          The nullifier is <b>deterministic</b> (same input → same tag) so doubles collide, but it’s also a
          <b> one-way hash</b> of a private secret — so it reveals nothing about who you are. Even generating
          a brand-new wallet doesn’t help: the tag comes from your <i>credential</i>, not your wallet.
        </Note>
        <p>
          That’s why a second attempt fails with the message: <i>“We don’t know who you are, but you already
          claimed.”</i> One credential = one payout, exactly like a cash voucher.
        </p>
      </>
    ),
  },
  {
    slug: 'the-circuit',
    group: 'The protocol — deeper',
    title: 'The eligibility circuit (the math)',
    lede: 'A “circuit” is the precise list of equations the zero-knowledge proof must satisfy. Here’s every one, in plain terms.',
    body: () => (
      <>
        <p>
          A ZK proof proves you know inputs that satisfy a set of constraints. That set is the <b>circuit</b>
          (written in a language called Circom). Almoner’s circuit checks four eligibility conditions, a
          membership proof, and a nullifier — all at once, in a single proof that takes about a second to
          generate on a phone.
        </p>
        <h3>Public vs private inputs</h3>
        <p>
          <b>Private</b> inputs are known only to the prover (the secret, the attributes, the Merkle path).
          <b> Public</b> inputs are visible to everyone (the Merkle root, the program id, the nullifier hash,
          the payout address, and the policy numbers). The proof binds them together.
        </p>
        <h3>What the circuit enforces</h3>
        <Code lang="text">{`A · Membership   recompute leaf from your attributes, prove its
                 Merkle path leads to the on-chain root
B · Region       regionCode  == allowedRegion
C · Age          birthYear   <= cutoffYear        (born in/before ⇒ old enough)
D · Tier + KYC   programTier == requiredTier  AND  kycFlag == 1
• · Nullifier    nullifierHash == Poseidon(nullifier, programId)
• · Payout       payoutAmount  == entitlement`}</Code>
        <p>Each line is just an equation the proof must satisfy. A few worth unpacking:</p>
        <ul>
          <li>
            <b>Age (C).</b> Comparing numbers privately uses a gadget called <code>LessEqThan</code>. It
            proves <code>birthYear ≤ cutoffYear</code> without revealing the actual birth year — so the
            world learns “old enough,” never the age.
          </li>
          <li>
            <b>Membership (A).</b> The circuit re-hashes your attributes into a leaf, then walks the Merkle
            path hashing pair by pair, and asserts the result equals the public root.
          </li>
          <li>
            <b>Payout (•).</b> Forces the amount you receive to equal the amount the org committed for you —
            you can’t pay yourself more.
          </li>
        </ul>
        <Note kind="note" title="Anti-front-running">
          The payout <b>address</b> is also a public input baked into the proof. Because every public input
          is part of the verification equation, an attacker who copies your pending proof <b>can’t redirect
          the money</b> to their own wallet — changing the address invalidates the proof.
        </Note>
        <p>
          The whole thing compiles to roughly <b>10,000 constraints</b> — small enough to prove in the
          browser in about a second.
        </p>
      </>
    ),
  },
  {
    slug: 'on-chain',
    group: 'The protocol — deeper',
    title: 'On-chain verification (BN254)',
    lede: 'How a Stellar smart contract checks a zero-knowledge proof — and the one famous equation behind it.',
    body: () => (
      <>
        <p>
          The proof is created on the recipient’s device, but it’s <b>verified inside a Soroban smart
          contract</b> on Stellar. That’s the heart of the integration: the blockchain itself confirms the
          proof is valid before releasing money.
        </p>
        <h3>Pairings, in one breath</h3>
        <p>
          Groth16 verification relies on a special operation called a <b>pairing</b>, written{' '}
          <code>e(P, Q)</code>. Think of it as a magic multiplication of two points on an elliptic curve
          that lets you check relationships between hidden numbers <i>without learning the numbers</i>. The
          key property:
        </p>
        <Eq>e(a·P, b·Q) = e(P, Q)<sup>a·b</sup></Eq>
        <p>
          This lets the verifier confirm that secret values multiply together correctly, which is exactly
          what’s needed to validate a proof.
        </p>
        <h3>The verification equation</h3>
        <p>To accept a proof, the contract checks that a single equation holds:</p>
        <Eq>e(−A, B) · e(α, β) · e(vk<sub>x</sub>, γ) · e(C, δ) = 1</Eq>
        <p>
          <code>A</code>, <code>B</code>, <code>C</code> come from the proof; <code>α, β, γ, δ</code> come
          from a fixed <b>verification key</b> baked into the contract; and <code>vk<sub>x</sub></code> is
          built from your public inputs. <b>If — and only if — the equation equals 1, the proof is valid.</b>{' '}
          The contract learns nothing else.
        </p>
        <Note kind="note" title="Why BN254?">
          BN254 is the elliptic curve the proof lives on. Stellar’s Soroban added <b>native BN254 host
          functions</b> (Protocol 25), so the contract can compute pairings cheaply on-chain. Almoner is
          also Poseidon-heavy in the browser, and the standard tooling for that is BN254-native — so one
          curve serves both sides.
        </Note>
        <p>The contract’s <code>claim()</code> call does six things, in order:</p>
        <Code lang="text">{`1. root matches the program’s stored Merkle root
2. policy params match the program’s stored config
3. the nullifier hasn’t been used before
4. the Groth16 proof verifies (the equation above)
5. mark the nullifier as spent
6. transfer USDC to the recipient’s fresh wallet`}</Code>
        <p>
          Steps 1–2 are <b>enforced by construction</b>: the contract builds the public inputs from its own
          trusted storage, so a proof made against a different root or a looser policy simply fails step 4.
        </p>
      </>
    ),
  },
  {
    slug: 'selective-disclosure',
    group: 'The protocol — deeper',
    title: 'Selective disclosure (view keys)',
    lede: 'How the donor — and only the donor — can later see exactly who was paid.',
    body: () => (
      <>
        <p>
          Anonymity for the public is great, but the funder still needs an audit. Almoner solves this with
          <b> selective disclosure</b>: each claim posts a note that’s <b>encrypted to the donor’s key</b>.
        </p>
        <p>When a recipient claims, their device writes a small note —</p>
        <Code lang="text">{`{ leafIndex, name, amount }`}</Code>
        <p>
          — and <b>seals it like a letter</b> that only the donor’s private “view key” can open (using NaCl
          box / X25519 encryption). The smart contract stores the sealed bytes alongside the claim.
        </p>
        <Note kind="key">
          To the public, every note is meaningless ciphertext. The donor decrypts them with their private
          key and reconstructs <b>exactly who claimed and the total — with zero rows of the organization’s
          recipient list.</b> This is “provable to the donor” made cryptographic, not trust-based.
        </Note>
        <p>
          Each note uses a fresh ephemeral key, so notes can’t even be linked to <i>each other</i>. The
          donor sees everything; the world sees nothing.
        </p>
      </>
    ),
  },
  {
    slug: 'zero-gas',
    group: 'The protocol — deeper',
    title: 'Zero-gas claims',
    lede: 'How a refugee with no crypto, no wallet, and no fees still receives USDC.',
    body: () => (
      <>
        <p>
          A beneficiary shouldn’t need to own cryptocurrency to receive aid. Two design choices make the
          experience feel like Web2:
        </p>
        <h3>1. A credential, not a wallet</h3>
        <p>
          The organization hands each recipient a <b>self-contained voucher</b> — a link or QR that carries
          their secret, attributes, and Merkle path. They can prove from any phone with nothing installed.
          Whoever holds it can claim once (the nullifier enforces it), exactly like a cash voucher.
        </p>
        <h3>2. A relayer + sponsored reserves</h3>
        <p>
          Because the proof <i>is</i> the authorization, the beneficiary never has to sign with a funded
          account. A <b>relayer</b> submits the transaction and pays the fees, and Stellar’s <b>sponsored
          reserves</b> feature lets it create the fresh wallet and its USDC trustline on the recipient’s
          behalf:
        </p>
        <Code lang="text">{`beginSponsoringFutureReserves(fresh)
createAccount(fresh)          ← relayer pays the reserve
changeTrust(USDC)             ← fresh wallet trusts USDC
endSponsoringFutureReserves`}</Code>
        <p>
          The beneficiary ends up with a funded, USDC-ready wallet holding <b>0 XLM</b>, having paid
          nothing. The relayer only ever sees a valid proof and a fresh address — so it can’t deanonymize
          anyone. They cash out to local currency at any Stellar anchor.
        </p>
        <Note kind="warn" title="One fresh wallet per claim">
          The wallet is meant to be single-use and unlinkable. Reusing it as a public deposit address would
          rebuild the very link Almoner exists to break.
        </Note>
      </>
    ),
  },
  {
    slug: 'quickstart',
    group: 'Start here',
    title: 'Run it yourself',
    lede: 'Clone, build the circuit, deploy to testnet, and run the full flow.',
    body: () => (
      <>
        <p>Prerequisites: Node ≥ 20, Rust nightly (with <code>rust-src</code>), the Circom compiler, and the Stellar CLI.</p>
        <Code lang="bash">{`npm install

# 1) Compile the circuit + run a local trusted setup
npm run circuit:build

# 2) Prove the JS crypto matches the circuit, end to end
npm run lib:test

# 3) Generate the on-chain verification key, build + test the contract
npm run gen:vk
npm run contracts:build
npm run contracts:test

# 4) Deploy USDC + the pool to Stellar testnet
npm run deploy:testnet

# 5) Run the whole flow (prove → claim → double-claim → reconstruct)
npm run demo:e2e

# 6) Run the app (backend API + UI together)
npm run dev    # API on :8787, UI on http://localhost:5173`}</Code>
        <Note kind="tip">
          The Soroban contract targets <code>wasm32v1-none</code>. <code>npm run contracts:build</code> uses
          <code> cargo -Zbuild-std</code> (nightly), so no extra target download is needed.
        </Note>
        <p>
          From there, open the app, create a program, issue a claim link, claim it on a “phone,” and open
          the donor audit to watch the encrypted notes decrypt. Everything you read in these docs runs for
          real on Stellar testnet.
        </p>
        <p className="doc-tag">Private to the world. Provable to the donor.</p>
      </>
    ),
  },
];
