import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * The phone layout (< 768 px) at 390×844 with touch, against the same server, Postgres and offline LLM fallback as
 * app.spec.ts. Serial steps on one page, in a fresh browser context (a new anonymous user).
 * With MOBILE_SCREENSHOTS=1 it also writes docs/media/mobile-{main,map,settings,node,run}.png (not committed).
 */

const IDEA = 'A night market for repair services';
const TITLE = 'Night Market Repair';
const EMPTY_TITLE = 'Your second brain';
const EMPTY_STATUS = 'Type an idea to map your first second brain.';
const IGNORED = [/GPU stall/i, /favicon\.ico/i];
const SHOTS = Boolean(process.env.MOBILE_SCREENSHOTS);

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const ui = (page: Page) => ({
  shell: page.getByTestId('mobile-shell'),
  brainButton: page.getByRole('button', { name: /^Second brain/ }),
  settingsButton: page.getByRole('button', { name: 'View & settings' }),
  focusButton: page.getByRole('button', { name: 'Focus mode' }),
  status: page.getByTestId('mobile-bottom').getByRole('status'),
  input: page.getByTestId('mobile-input-bar').getByRole('textbox'),
  tabs: page.getByRole('navigation', { name: 'Panels' }),
  tab: (name: string) => page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name, exact: true }),
  run: page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: /Run$|Pause$/ }),
  sheet: (name: string) => page.getByRole('dialog', { name }),
});

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `docs/media/mobile-${name}.png` });
}

test.describe.serial('Agentic Brainstorm on a phone', () => {
  let context: BrowserContext;
  let page: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    // The Next dev overlay's badge sits on the bottom-left corner, over the Map tab. Production has no such badge.
    await context.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = 'nextjs-portal { display: none !important; }';
        document.head.appendChild(style);
      });
    });
    page = await context.newPage();
    page.on('console', m => {
      if (m.type() === 'error' && !IGNORED.some(r => r.test(m.text()))) errors.push(`console: ${m.text()}`);
    });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('1. the top bar shows the empty state and the desktop panels are gone', async () => {
    await page.goto('/');
    const { shell, brainButton, status, input, run } = ui(page);
    await expect(brainButton).toContainText(EMPTY_TITLE, { timeout: 60_000 });
    await expect(brainButton).toHaveText(/^Second brain\s*—/);
    await expect(brainButton).not.toContainText('№');
    await expect(shell).toBeVisible();
    await expect(page.getByTestId('left-panel')).toHaveCount(0);
    await expect(page.getByTestId('toolbar')).toHaveCount(0);
    await expect(page.getByTestId('input-bar')).toHaveCount(0);
    await expect(status).toHaveText(EMPTY_STATUS);
    await expect(input).toHaveAttribute('placeholder', 'Type an idea — a startup, a story, a plan…');
    await expect(page.getByRole('button', { name: /Map it/ })).toBeEnabled();
    await expect(run).toBeDisabled();
    await expect(page.locator('.atlas-label')).toHaveCount(0);

    await brainButton.click();
    const sheet = ui(page).sheet('Second brain');
    await expect(sheet.getByRole('button', { name: '+ New second brain', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Delete this brain', exact: true })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toHaveCount(0);
  });

  test('2. mapping an idea puts its title in the top bar and labels on the map', async () => {
    const { input, brainButton, run } = ui(page);
    await input.fill(IDEA);
    await input.press('Enter');
    await expect(brainButton).toContainText('№ 001', { timeout: 10_000 });
    await expect(brainButton).toContainText(TITLE);
    await expect(page.locator('.atlas-label', { hasText: /Night|Market|Repair/ }).first()).toBeAttached({ timeout: 10_000 });
    await expect(run).toBeEnabled();
    // Labels sit under the chrome: the shell (z 5) stacks above the canvas and its label layer (z 0).
    const z = await page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-testid="mobile-shell"]')!).zIndex));
    expect(z).toBeGreaterThan(0);
    await page.waitForTimeout(2500); // let the map grow in
    await shot(page, 'main');
  });

  test('3. each tab opens its sheet, one at a time, and closes it again', async () => {
    const { tab, sheet } = ui(page);
    const tabs: [string, string][] = [['Map', 'Map'], ['Agents', 'Agent team'], ['Log', 'Agent log'], ['Key', 'Key takeaway']];
    for (const [label, title] of tabs) {
      await tab(label).click();
      await expect(sheet(title)).toBeVisible();
      await expect(tab(label)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await tab(label).click(); // the active tab closes its sheet
      await expect(sheet(title)).toHaveCount(0);
    }
    await expect(sheet('Map')).toHaveCount(0);

    await tab('Map').click();
    await expect(sheet('Map').getByText(TITLE, { exact: true })).toBeVisible();
    await expect(sheet('Map').getByText('Branches', { exact: true })).toBeVisible();
    await shot(page, 'map');
    await tab('Agents').click(); // another tab replaces the open sheet
    await expect(sheet('Map')).toHaveCount(0);
    await expect(sheet('Agent team').getByText('Researcher')).toBeVisible();
    await sheet('Agent team').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await tab('Log').click();
    await expect(sheet('Agent log').getByText(/^Press Run agents\./)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await tab('Key').click();
    await expect(sheet('Key takeaway').getByText('Run the agents to get a key takeaway.')).toBeVisible();
    await page.getByTestId('sheet-backdrop').click({ position: { x: 40, y: 40 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('4. View & settings switches the view and the design without errors', async () => {
    const { settingsButton, sheet } = ui(page);
    await settingsButton.click();
    const settings = sheet('View & settings');
    await expect(settings).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Stars', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.getByRole('button', { name: 'Atlas', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(settings.getByText('Your ID')).toBeVisible();
    await expect(settings.getByText('offline fallback')).toBeVisible();
    await shot(page, 'settings');

    await settings.getByRole('button', { name: 'Orbit', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Orbit', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await settings.getByRole('button', { name: 'Observatory', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Observatory', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'observatory');
    // The full word fits its segment at 390 px.
    const clipped = await settings.getByText('Observatory', { exact: true }).evaluate(el => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(false);
    await page.waitForTimeout(1500); // a few frames in the new mode and theme
    expect(errors).toEqual([]);

    // Back to the defaults for the remaining steps and screenshots.
    await settings.getByRole('button', { name: 'Stars', exact: true }).click();
    await settings.getByRole('button', { name: 'Atlas', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);
  });

  test('5. a branch in the Map sheet opens the node sheet', async () => {
    const { tab, sheet, input } = ui(page);
    await tab('Map').click();
    await sheet('Map').getByRole('button', { name: /What hurts today/ }).click();
    const node = page.getByTestId('node-sheet');
    await expect(node).toBeVisible();
    await expect(sheet('Map')).toHaveCount(0);
    await expect(node.getByText('What hurts today', { exact: true })).toBeVisible();
    await expect(node.getByText(TITLE, { exact: true })).toBeVisible(); // the path
    expect(await node.getByTestId('node-children').getByRole('button').count()).toBeGreaterThanOrEqual(1);
    await expect(node.getByRole('button', { name: /Expand this node/ })).toBeEnabled();
    await expect(input).toHaveAttribute('aria-label', 'Ask this node');
    await expect(page.getByRole('button', { name: /Grow/ })).toBeVisible();
    await shot(page, 'node');
    // Closing the sheet deselects the node.
    await node.getByRole('button', { name: 'Close' }).click();
    await expect(node).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-label', 'New idea');
  });

  test('6. a five-round run ends with a takeaway in the Key sheet', async () => {
    test.setTimeout(150_000);
    const { settingsButton, sheet, tab, run, status } = ui(page);
    await settingsButton.click();
    await sheet('View & settings').getByRole('button', { name: '5', exact: true }).click();
    await expect(sheet('View & settings').getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    await run.click();
    await expect(run).toHaveText(/Pause/);
    await expect(status).toHaveText(/^Round \d\/5/, { timeout: 15_000 });
    await expect(page.locator('[aria-label="Run phase"] [aria-current="step"]').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2500);
    await shot(page, 'run');

    await tab('Key').click(); // opening a sheet does not pause the run
    const key = sheet('Key takeaway');
    await expect(key.getByRole('button', { name: /Hide path|Show path/ })).toBeVisible({ timeout: 90_000 });
    await expect(key.getByText('Run the agents to get a key takeaway.')).toHaveCount(0);
    await expect(run).toHaveText(/Run$/, { timeout: 30_000 });
    await tab('Log').click();
    expect(await sheet('Agent log').getByRole('button').count()).toBeGreaterThanOrEqual(6); // ≥ 5 entries and ×
    await page.keyboard.press('Escape');
  });

  test('7. focus mode hides the chrome and ⤢ brings it back', async () => {
    const { shell, focusButton } = ui(page);
    await focusButton.click();
    await expect(shell).toHaveCount(0);
    const exit = page.getByRole('button', { name: 'Exit focus' });
    await expect(exit).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await exit.click();
    await expect(shell).toBeVisible();
    await focusButton.click();
    await page.keyboard.press('Escape');
    await expect(shell).toBeVisible();
    expect(errors).toEqual([]);
  });
});
