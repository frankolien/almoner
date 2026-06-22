// Reproducible testnet deploy: ensure an org identity, deploy a mock USDC
// Stellar Asset Contract, deploy the pool (constructor admin+token), seed the
// vault, and write app/public/deployment.json.
//
//   npm run deploy:testnet
//
// Assumes the contract wasm is built (npm run contracts:build) and the Stellar
// CLI is installed + configured for testnet.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM = path.join(ROOT, 'contracts/target/wasm32v1-none/release/almoner_pool.wasm');
const NETWORK = 'testnet';
const INITIAL_USDC = 10_000; // seed the vault with 10k USDC

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}
const lastContractId = (out: string): string => {
  const m = out.match(/C[A-Z2-7]{55}/g);
  if (!m) throw new Error('no contract id in CLI output:\n' + out);
  return m[m.length - 1];
};

function ensureOrg(): { pub: string; sec: string } {
  try {
    const pub = sh('stellar', ['keys', 'address', 'org']);
    return { pub, sec: sh('stellar', ['keys', 'show', 'org']) };
  } catch {
    console.log('▸ Generating + funding org identity…');
    sh('stellar', ['keys', 'generate', 'org', '--network', NETWORK, '--fund']);
    return { pub: sh('stellar', ['keys', 'address', 'org']), sec: sh('stellar', ['keys', 'show', 'org']) };
  }
}

function main(): void {
  if (!fs.existsSync(WASM)) throw new Error(`missing ${WASM} — run "npm run contracts:build" first`);

  const org = ensureOrg();
  console.log('▸ Org:', org.pub);

  console.log('▸ Deploying USDC Stellar Asset Contract…');
  const usdcTokenId = lastContractId(
    sh('stellar', ['contract', 'asset', 'deploy', '--asset', `USDC:${org.pub}`, '--source', 'org', '--network', NETWORK]),
  );
  console.log('  USDC token:', usdcTokenId);

  console.log('▸ Deploying Almoner pool…');
  const poolContractId = lastContractId(
    sh('stellar', [
      'contract', 'deploy', '--wasm', WASM, '--source', 'org', '--network', NETWORK,
      '--', '--admin', org.pub, '--token', usdcTokenId,
    ]),
  );
  console.log('  Pool:', poolContractId);

  console.log(`▸ Seeding pool with ${INITIAL_USDC} USDC…`);
  sh('stellar', [
    'contract', 'invoke', '--id', usdcTokenId, '--source', 'org', '--network', NETWORK,
    '--', 'mint', '--to', poolContractId, '--amount', String(INITIAL_USDC * 1e7),
  ]);

  // Relayer: sponsors fresh beneficiary accounts + pays claim fees (zero-gas
  // onboarding). In production this is a server-side service, not a stored key.
  console.log('▸ Provisioning relayer (gas sponsor)…');
  let relayer: { pub: string; sec: string };
  try {
    relayer = { pub: sh('stellar', ['keys', 'address', 'relayer']), sec: sh('stellar', ['keys', 'show', 'relayer']) };
  } catch {
    sh('stellar', ['keys', 'generate', 'relayer', '--network', NETWORK, '--fund']);
    relayer = { pub: sh('stellar', ['keys', 'address', 'relayer']), sec: sh('stellar', ['keys', 'show', 'relayer']) };
  }
  console.log('  Relayer:', relayer.pub);

  // Public config (committed) — no secrets ever.
  const publicConfig = {
    poolContractId,
    usdcTokenId,
    adminPublicKey: org.pub,
    relayerPublicKey: relayer.pub,
    network: NETWORK,
  };
  const out = path.join(ROOT, 'app/public/deployment.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(publicConfig, null, 2) + '\n');

  // Secrets -> .env (gitignored). Production: load from KMS/Vault instead.
  const envBody = [
    '# Almoner secrets — gitignored. NEVER commit. Production: KMS/Vault.',
    `NETWORK=${NETWORK}`,
    `POOL_CONTRACT_ID=${poolContractId}`,
    `USDC_TOKEN_ID=${usdcTokenId}`,
    `ADMIN_PUBLIC_KEY=${org.pub}`,
    `ADMIN_SECRET=${org.sec}`,
    `RELAYER_PUBLIC_KEY=${relayer.pub}`,
    `RELAYER_SECRET=${relayer.sec}`,
    'RELAYER_PORT=8787',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, '.env'), envBody);

  console.log('\n✓ Deployed. Wrote app/public/deployment.json (public) + .env (secrets)');
  console.log(`  pool  ${poolContractId}`);
  console.log(`  usdc  ${usdcTokenId}`);
}

main();
