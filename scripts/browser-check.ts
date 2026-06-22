// Drives the REAL frontend in a real browser: clicks "Register cohort" in the
// workspace, then independently queries the chain to confirm the program was
// created on-chain. Proves the UI does live testnet transactions, not mocks.
//
//   tsx scripts/browser-check.ts     (dev server must be running on :5173)
//
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Keypair, getProgram } from '../app/src/lib/pool.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'http://localhost:5173/#app';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dep = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/public/deployment.json'), 'utf8'));

interface State {
  createdOnChain?: boolean;
  root?: string;
  program?: { programId?: string };
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('console', (m) => console.log('  [browser]', m.text()));
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  console.log('▸ Opening the workspace in a real Chrome…');
  await page.goto(URL, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.removeItem('almoner:v1'));
  await page.reload({ waitUntil: 'networkidle2' });

  console.log('▸ Clicking "Register cohort + post root on-chain"…');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Register cohort/i.test(b.textContent || ''),
    );
    if (!btn) throw new Error('register button not found');
    (btn as HTMLButtonElement).click();
  });

  let state: State | null = null;
  for (let i = 0; i < 75; i++) {
    state = await page.evaluate(() => {
      const raw = localStorage.getItem('almoner:v1');
      return raw ? JSON.parse(raw) : null;
    });
    if (state?.createdOnChain && state?.program?.programId) break;
    await new Promise((r) => setTimeout(r, 1000));
  }

  // capture the on-screen activity log the user sees stream
  const logLines = await page.evaluate(() =>
    [...document.querySelectorAll('.log > div')].map((d) => d.textContent?.trim()).filter(Boolean),
  );
  console.log('\n  on-screen activity log:');
  logLines.forEach((l) => console.log('   ', l));
  await browser.close();

  if (!state?.createdOnChain || !state.program?.programId) {
    throw new Error('the UI did not finish registering in time');
  }
  const programId = Number(state.program.programId);
  console.log(`\n✓ The browser registered program #${programId}.`);

  // INDEPENDENT on-chain confirmation (separate client, separate process state)
  console.log('▸ Independently querying the Soroban contract for that program…');
  const org = Keypair.fromSecret(dep.adminSecret);
  const cfg = await getProgram(dep.poolContractId, org, programId);
  if (!cfg) throw new Error('program NOT found on-chain — would mean it was mocked');
  const rootHex = Buffer.from(cfg.merkle_root).toString('hex');
  console.log(`✓ Confirmed ON-CHAIN: program #${programId} exists in the contract.`);
  console.log(`  merkle_root   : ${rootHex.slice(0, 24)}…`);
  console.log(`  allowed_region: ${cfg.allowed_region}, min_birth_year: ${cfg.min_birth_year}, tier: ${cfg.required_tier}`);
  console.log('\n✓ Realtime confirmed — the UI wrote a real program to live Stellar testnet.');
}

main().catch((e: unknown) => {
  console.error('\n✗ browser-check failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
