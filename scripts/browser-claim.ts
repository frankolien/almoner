// Drives the full real-deployment flow in a real browser:
//   org console registers a cohort  ->  we mint a beneficiary credential  ->
//   open the standalone claim app at #claim=<cred>  ->  click "Claim my aid"
//   ->  the relayer sponsors a fresh wallet + the proof verifies on-chain + USDC
//   lands, with the beneficiary holding zero XLM.
//
//   tsx scripts/browser-claim.ts     (dev server must be running on :5173)
//
import puppeteer from 'puppeteer-core';
import { buildCohort } from '@almoner/lib';
import { buildCredential, encodeCredential } from '../app/src/lib/credential.js';
import { toRecord } from '../app/src/lib/demo.js';
import type { StoredRecord, ProgramMeta } from '../app/src/lib/store.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = 'http://localhost:5173';

interface Store {
  createdOnChain?: boolean;
  records: StoredRecord[];
  program: ProgramMeta;
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

  console.log('▸ Org console: registering a cohort…');
  await page.goto(`${ORIGIN}/#app`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.removeItem('almoner:v1'));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Register cohort/i.test(x.textContent || ''));
    (b as HTMLButtonElement).click();
  });

  let store: Store | null = null;
  for (let i = 0; i < 75; i++) {
    store = await page.evaluate(() => {
      const r = localStorage.getItem('almoner:v1');
      return r ? JSON.parse(r) : null;
    });
    if (store?.createdOnChain && store.program?.programId) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!store?.createdOnChain) throw new Error('org did not register in time');
  console.log(`✓ Program #${store.program.programId} registered with ${store.records.length} beneficiaries.`);

  console.log('▸ Org issues a claim credential for beneficiary #2…');
  const { tree } = await buildCohort(store.records.map(toRecord));
  const cred = await buildCredential(store.records[2], 2, tree, store.program);
  const claimUrl = `${ORIGIN}/#claim=${encodeCredential(cred)}`;
  console.log(`  credential is ${claimUrl.length} chars (${cred.name})`);

  console.log('▸ Beneficiary opens the claim link and taps "Claim my aid"…');
  await page.goto(claimUrl, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Claim my aid/i.test(x.textContent || ''));
    (b as HTMLButtonElement).click();
  });

  let amount = '';
  for (let i = 0; i < 120; i++) {
    amount = await page.evaluate(() => document.querySelector('.claim-amount')?.textContent ?? '');
    if (amount) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const logLines = await page.evaluate(() =>
    [...document.querySelectorAll('.claim-log > div')].map((d) => d.textContent?.trim()),
  );
  console.log('\n  claim app log:');
  logLines.forEach((l) => console.log('   ', l));
  await page.screenshot({ path: '/tmp/claim-success.png' });
  await browser.close();

  if (!amount) throw new Error('claim did not complete (no amount shown)');
  console.log(`\n✓ Beneficiary received ${amount.trim()} — sponsored, zero-gas, identity never on-chain.`);
  console.log('  screenshot: /tmp/claim-success.png');
}

main().catch((e: unknown) => {
  console.error('\n✗ browser-claim failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
