// Almoner backend — the relayer + operator signing service.
//
// All chain-signing lives here, never in the browser:
//   • the RELAYER sponsors fresh beneficiary accounts and pays claim fees (zero-gas)
//   • the ORG (operator) creates programs and funds the pool
// Keys are loaded from the environment (.env in dev; KMS/Vault in production).
// The privacy-critical proof is still generated on the beneficiary's device and
// only submitted here — the eligibility secret never reaches the server.
//
//   npm run server      (tsx server/index.ts)
//
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  Keypair,
  createProgram,
  fundPool,
  claim,
  sponsorFreshAccount,
  spentNullifiers,
  usdcBalance,
} from '../app/src/lib/pool.js';

try {
  process.loadEnvFile();
} catch {
  /* env already in process.env */
}

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing required env var ${k} (copy .env.example -> .env)`);
  return v;
}

const POOL = env('POOL_CONTRACT_ID');
const USDC = env('USDC_TOKEN_ID');
const ISSUER = env('ADMIN_PUBLIC_KEY');
const org = Keypair.fromSecret(env('ADMIN_SECRET'));
const relayer = Keypair.fromSecret(env('RELAYER_SECRET'));
const NETWORK = process.env.NETWORK ?? 'testnet';
const PORT = Number(process.env.RELAYER_PORT ?? 8787);
// Optional operator gate for the privileged org endpoints. If set, callers must
// send `x-operator-key`. (Production: real RBAC + operator wallet auth.)
const OPERATOR_KEY = process.env.OPERATOR_KEY ?? '';

const app = new Hono();
app.use('/api/*', cors());

app.onError((err, c) => {
  console.error('[api error]', err.message);
  return c.json({ error: err.message }, 500);
});

app.get('/api/health', (c) => c.json({ ok: true }));

app.get('/api/config', (c) =>
  c.json({
    poolContractId: POOL,
    usdcTokenId: USDC,
    adminPublicKey: org.publicKey(),
    relayerPublicKey: relayer.publicKey(),
    network: NETWORK,
  }),
);

function requireOperator(c: { req: { header: (k: string) => string | undefined } }): void {
  if (OPERATOR_KEY && c.req.header('x-operator-key') !== OPERATOR_KEY) {
    throw new Error('unauthorized operator');
  }
}

// ---- ORG (operator) — privileged ----
app.post('/api/program', async (c) => {
  requireOperator(c);
  const b = await c.req.json();
  await createProgram(org, POOL, {
    programId: Number(b.programId),
    merkleRootHex: String(b.merkleRootHex),
    allowedRegion: Number(b.allowedRegion),
    minBirthYear: Number(b.minBirthYear),
    requiredTier: Number(b.requiredTier),
  });
  return c.json({ ok: true });
});

app.post('/api/fund', async (c) => {
  requireOperator(c);
  const b = await c.req.json();
  await fundPool(org, POOL, org.publicKey(), BigInt(b.amount));
  return c.json({ ok: true });
});

// ---- RELAYER — zero-gas beneficiary path ----
// Production hardening: rate-limit + Sybil/anti-abuse + a permissionless fallback
// so beneficiaries aren't bricked if this service is down.
app.post('/api/sponsor', async (c) => {
  const fresh = Keypair.random();
  await sponsorFreshAccount(relayer, fresh, ISSUER);
  return c.json({ freshPublicKey: fresh.publicKey(), freshSecret: fresh.secret() });
});

app.post('/api/claim', async (c) => {
  const b = await c.req.json();
  if (!b.proof?.a || !b.proof?.b || !b.proof?.c) throw new Error('malformed proof');
  const txHash = await claim(relayer, POOL, {
    programId: Number(b.programId),
    nullifierHashHex: String(b.nullifierHashHex),
    recipient: String(b.recipient),
    payoutAmount: BigInt(b.payoutAmount),
    proof: b.proof,
  });
  return c.json({ txHash });
});

// ---- reads (no signing) ----
app.get('/api/spent/:id', async (c) => {
  const s = await spentNullifiers(POOL, org, Number(c.req.param('id')));
  return c.json({ spent: s });
});

app.get('/api/balance/:account', async (c) => {
  const bal = await usdcBalance(ISSUER, c.req.param('account'));
  return c.json({ usdc: bal.toString() });
});

serve({ fetch: app.fetch, port: PORT }, (info) =>
  console.log(`▸ Almoner relayer + operator API on http://localhost:${info.port}  (pool ${POOL.slice(0, 8)}…)`),
);
