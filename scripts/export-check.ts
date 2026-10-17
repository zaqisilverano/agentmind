/**
 * Headless check for the standalone 3D HTML export's node card (not part of the test suite).
 * Builds the page from the fixture brain with a user note on the core, opens it in Chromium (SwiftShader WebGL) and
 * clicks the core at the canvas centre, a child chip, empty space, and a tap on a touch device.
 * Needs network access to unpkg.com (three) and fonts.googleapis.com.
 * Run: npx tsx scripts/export-check.ts   (once: npx playwright install chromium)
 * Screenshot: docs/media/export-3d-card.png (do not commit unless asked); the narrow one goes next to the HTML in the OS temp dir.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { toHtml3d } from '@/lib/export/html3d';
import { fixtureBrain } from '@/tests/fixtures/brain';

const USER_NOTE = 'Ask the library first <b>x</b>\nthen the hardware store </script>';
const SHOT = join(process.cwd(), 'docs/media/export-3d-card.png');

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
};
const cardText = (page: Page) => page.locator('#node-card').innerText();
const cardShown = (page: Page) => page.locator('#node-card').isVisible();

async function main() {
  const brain = fixtureBrain();
  brain.nodes = brain.nodes.map(n => (n.depth === 0 ? { ...n, userNote: USER_NOTE } : n));
  const core = brain.nodes.find(n => n.depth === 0)!;
  const file = join(tmpdir(), 'agentmind-export-check-3d.html');
  writeFileSync(file, toHtml3d(brain, 'atlas', 'constellation', readFileSync('public/export/layout.js', 'utf8')));
  console.log('page', file);

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors: string[] = [];
  const open = async (opts: Parameters<typeof browser.newPage>[0]) => {
    const page = await browser.newPage(opts);
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // nodes are born over ~1.5 s, then ease into place
    return page;
  };

  // Desktop: click the core at the canvas centre (the orbit target starts on it).
  const page = await open({ viewport: { width: 1280, height: 800 } });
  check(!(await cardShown(page)), 'card hidden before any click');
  await page.mouse.move(640, 400);
  check(await page.locator('#c canvas').evaluate(c => getComputedStyle(c).cursor) === 'pointer', 'pointer cursor over the core');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1200);
  check(await cardShown(page), 'click on the core opens the card');
  const text = await cardText(page);
  check(text.includes(core.name), `card shows the node name "${core.name}"`);
  check(text.includes(core.note), 'card shows the AI note');
  check(text.includes('MY NOTES'), 'card shows the MY NOTES heading');
  check(text.includes('Ask the library first <b>x</b>\nthen the hardware store </script>'), 'user note is literal text with its line break');
  check(await page.locator('#node-card b').count() === 0, 'no markup from the note reached the DOM');
  check(await page.locator('#node-card .ch button').count() > 0, 'child chips are listed');
  mkdirSync(join(process.cwd(), 'docs/media'), { recursive: true });
  await page.screenshot({ path: SHOT });
  console.log('shot', SHOT);

  // A child chip selects that child; its label turns hot, unrelated labels dim.
  const chip = page.locator('#node-card .ch button').first();
  const childName = (await chip.innerText()).trim();
  await chip.click();
  await page.waitForTimeout(800);
  check((await page.locator('#node-card .nm').innerText()).toUpperCase() === childName.toUpperCase(), `chip selects the child "${childName}"`);
  const hot = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#l > div')].filter(d => d.style.color !== '').length);
  check(hot === 1, 'exactly one label takes the hot colour');
  const dimmed = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#l > div')].filter(d => +d.style.opacity > 0 && +d.style.opacity <= 0.22).length);
  check(dimmed > 0, `unrelated labels dim (${dimmed} at or below 22%)`);
  await page.keyboard.press('Escape');
  check(!(await cardShown(page)), 'Escape closes the card');
  await page.waitForTimeout(2500); // the orbit target eases back to the core at the centre

  // × closes; empty space clears; a drag does not select.
  await page.mouse.click(640, 400);
  await page.waitForTimeout(400);
  await page.locator('#node-card .x').click();
  check(!(await cardShown(page)), '× closes the card');
  await page.mouse.click(640, 400);
  await page.waitForTimeout(400);
  check(await cardShown(page), 'clicking the core again reopens the card');
  await page.mouse.click(40, 760);
  check(!(await cardShown(page)), 'clicking empty space clears the selection');
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.move(700, 420, { steps: 5 });
  await page.mouse.up();
  check(!(await cardShown(page)), 'a drag does not select');
  await page.close();

  // Narrow touch device: a tap opens the card as a bottom sheet.
  const phone = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await phone.touchscreen.tap(195, 422);
  await phone.waitForTimeout(1200);
  check(await cardShown(phone), 'tap on the core opens the card on a touch device');
  const box = await phone.locator('#node-card').boundingBox();
  check(!!box && box.x === 0 && Math.round(box.x + box.width) === 390 && Math.round(box.y + box.height) === 844, `bottom sheet below 640 px (${JSON.stringify(box)})`);
  const narrow = join(tmpdir(), 'export-3d-card-narrow.png');
  await phone.screenshot({ path: narrow });
  console.log('shot', narrow);

  await browser.close();
  check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
