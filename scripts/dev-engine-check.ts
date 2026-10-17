/**
 * Headless smoke check for the engine dev page (not part of the test suite).
 * Expects `pnpm dev` already running on http://localhost:3000; it starts nothing itself.
 * Run: pnpm exec tsx scripts/dev-engine-check.ts   (once: pnpm exec playwright install chromium)
 * Screenshots go to .superpowers/sdd/2026-10-16-agentmind/shots/ (git-ignored).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const URL = process.env.DEV_URL ?? 'http://localhost:3000/dev/engine';
const SHOTS = join(process.cwd(), '.superpowers/sdd/2026-10-16-agentmind/shots');
type AtlasLike = import('@/engine/AtlasScene').AtlasScene;

const MODES = ['constellation', 'orbit', 'terrain'];
const THEMES = ['atlas', 'observatory', 'blueprint'];

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  let n = 0;
  const shot = async (name: string) => {
    const file = join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    console.log('shot', file);
  };
  const labels = () => page.locator('.atlas-label').count();
  const click = async (name: string, ms = 800) => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.waitForTimeout(ms);
  };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await shot('initial');
  const before = await labels();
  const nan = await page.evaluate(() => {
    const s = (window as unknown as { __atlas?: { positionOf(id: string): { x: number; y: number; z: number } | undefined } }).__atlas;
    const p = s?.positionOf('b2c2');
    return p ? [p.x, p.y, p.z].some(v => !Number.isFinite(v)) : 'no scene';
  });

  // Click the 'Renters & first homes' branch (b1) at its projected screen position and expect it selected.
  const at = await page.evaluate(() => {
    const s = (window as unknown as { __atlas?: AtlasLike }).__atlas;
    const p = s?.positionOf('b1');
    if (!s || !p) return null;
    const v = s.three.camera.position.clone().set(p.x, p.y, p.z).project(s.three.camera);
    const r = s.three.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  });
  if (at) { await page.mouse.click(at.x, at.y); await page.waitForTimeout(800); }
  const picked = await page.getByTestId('status').textContent();
  await shot('select-b1');
  await page.mouse.click(1200, 760); // empty space clears the selection
  await page.waitForTimeout(800);

  for (const m of MODES) { await click(m); await shot('mode-' + m); }
  await click('constellation');
  for (const t of THEMES) { await click(t); await shot('theme-' + t); }
  await click('atlas');
  await click('Toggle path');
  await shot('path-on');
  await click('Run scripted agents', 0);
  for (let i = 1; i <= 4; i++) { await page.waitForTimeout(3000); await shot(`agents-${i * 3}s`); }
  const after = await labels();
  const status = await page.getByTestId('status').textContent();

  console.log('\nconsole errors:', errors.length ? errors : 'none');
  console.log('console warnings:', warnings.length ? warnings : 'none');
  console.log('NaN position for b2c2:', nan);
  console.log('.atlas-label count before run:', before, 'after run:', after);
  console.log('status after clicking b1:', picked);
  console.log('status:', status);
  await browser.close();
  if (errors.length || before !== 24 || after !== 28 || !picked?.includes('selected: b1')) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
