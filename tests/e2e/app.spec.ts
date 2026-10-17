import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * Spec §15 smoke suite against the real routes, the dev Postgres and the offline LLM fallback.
 * The steps share one page (serial), so the brain mapped in step 2 is reused. Each run starts from a new browser
 * context, i.e. a new anonymous user, so no database reset is needed between runs.
 */

const IDEA = 'A night market for repair services';
const EMPTY_TITLE = 'Your second brain';
const EMPTY_STATUS = 'Type an idea to map your first second brain.';
const UID_DISPLAY_KEY = 'ab_uid_display';

/** Console noise that is not an app error: SwiftShader's GPU stall warning and the missing favicon. */
const IGNORED = [/GPU stall/i, /favicon\.ico/i];

type Box = { x: number; y: number; width: number; height: number };

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no bounding box');
  return b;
}

const ui = (page: Page) => ({
  leftPanel: page.getByTestId('left-panel'),
  toolbar: page.getByTestId('toolbar'),
  inputBar: page.getByTestId('input-bar'),
  nodeCard: page.getByTestId('node-card'),
  chips: page.getByTestId('node-card').getByTestId('node-children').getByRole('button'),
  agentLog: page.getByTestId('agent-log'),
  brainButton: page.getByRole('button', { name: /^Second brain/ }),
  status: page.getByTestId('input-bar').getByRole('status'),
});

/** Opens a toolbar dropdown by its trigger text and clicks one menu row. */
async function pick(page: Page, trigger: RegExp, item: string): Promise<void> {
  await ui(page).toolbar.getByRole('button', { name: trigger }).click();
  await ui(page).toolbar.getByRole('button', { name: item, exact: true }).click();
}

test.describe.serial('agentmind smoke', () => {
  let context: BrowserContext;
  let page: Page;
  const errors: string[] = [];

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    page = await context.newPage();
    page.on('console', m => {
      if (m.type() === 'error' && !IGNORED.some(r => r.test(m.text()))) errors.push(`console: ${m.text()}`);
    });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('1. first visit starts with an empty map', async () => {
    await page.goto('/');
    const { leftPanel, brainButton, status, inputBar } = ui(page);
    await expect(leftPanel.getByText(EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(leftPanel.getByText(/^Type an idea below\./)).toBeVisible();
    await expect(status).toHaveText(EMPTY_STATUS);
    await expect(brainButton).toHaveText(/^Second brain\s*—/);
    await expect(brainButton).not.toContainText('№');
    await expect(inputBar.getByRole('textbox', { name: 'New idea' })).toBeFocused();
    await expect(inputBar.getByRole('button', { name: /Map it/ })).toBeEnabled();
    await expect(inputBar.getByRole('button', { name: /Run agents/ })).toBeDisabled();
    await expect(leftPanel.getByText('Legend — branches')).toHaveCount(0);
    await expect(leftPanel.getByText('Key takeaway')).toHaveCount(0);
    await expect(page.locator('.atlas-label')).toHaveCount(0);
    await expect(ui(page).agentLog.getByText(/^Map an idea first\./)).toBeVisible();
    await brainButton.click();
    await expect(leftPanel.getByRole('button', { name: '+ New second brain', exact: true })).toBeVisible();
    await expect(leftPanel.getByRole('button', { name: 'Delete this brain', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await leftPanel.getByTitle('Hide panel').click();
    const tab = page.getByTitle('Show panel');
    await expect(tab).toHaveText(`» ${EMPTY_TITLE}`);
    await tab.click();
    await expect(leftPanel).toBeVisible();
  });

  test('2. typing an idea and pressing Enter maps a new brain', async () => {
    const { inputBar, brainButton } = ui(page);
    const input = inputBar.getByRole('textbox', { name: 'New idea' });
    await input.fill(IDEA);
    await input.press('Enter');
    await expect(brainButton).toContainText('№ 001', { timeout: 10_000 });
    await expect(page.locator('.atlas-label', { hasText: /Night|Market|Repair/ }).first()).toBeAttached({ timeout: 10_000 });
  });

  test('3. clicking a legend row opens the node card', async () => {
    const { leftPanel, nodeCard, chips } = ui(page);
    await leftPanel.getByRole('button', { name: /What hurts today/ }).click();
    await expect(nodeCard).toBeVisible();
    await expect(nodeCard.getByText('Night Market Repair', { exact: true })).toBeVisible(); // the path
    await expect(nodeCard.getByText('What hurts today', { exact: true })).toBeVisible();
    expect(await chips.count()).toBeGreaterThanOrEqual(1);
  });

  test('4. Expand this node adds children', async () => {
    const { nodeCard, chips } = ui(page);
    const before = await chips.count();
    const expand = nodeCard.getByRole('button', { name: /Expand this node/ });
    await expect(expand).toBeEnabled();
    await expand.click();
    await expect.poll(() => chips.count(), { timeout: 10_000 }).toBeGreaterThan(before);
  });

  test('5. View and Design switches do not throw', async () => {
    await pick(page, /^View/, 'Orbit');
    await expect(ui(page).toolbar.getByRole('button', { name: /^View/ })).toContainText('Orbit');
    await pick(page, /^Design/, 'Observatory');
    await expect(ui(page).toolbar.getByRole('button', { name: /^Design/ })).toContainText('Observatory');
    // Let a few frames render in the new mode and theme before judging.
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('6. Focus hides the panels and Esc brings them back', async () => {
    const { toolbar, leftPanel } = ui(page);
    await toolbar.getByRole('button', { name: 'Focus', exact: true }).click();
    await expect(toolbar).toBeHidden();
    await expect(leftPanel).toBeHidden();
    await expect(page.getByRole('button', { name: /Exit focus/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toolbar).toBeVisible();
    await expect(leftPanel).toBeVisible();
  });

  test('7. Settings, Download, Markdown saves the brain as .md', async () => {
    const { toolbar } = ui(page);
    await toolbar.getByRole('button', { name: /^Settings/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      toolbar.getByRole('button', { name: 'Markdown', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.md$/);
    const text = await readFile(await download.path(), 'utf8');
    expect(text.startsWith('# ')).toBe(true);
    expect(text).toContain('# Night Market Repair');
    await page.keyboard.press('Escape');
  });

  test('8. at 900×540 the panels do not overlap', async () => {
    await page.setViewportSize({ width: 900, height: 540 });
    const { leftPanel, toolbar, inputBar, nodeCard } = ui(page);
    await leftPanel.getByRole('button', { name: /What hurts today/ }).click();
    await expect(nodeCard).toBeVisible();
    const boxes: [string, Box][] = [
      ['left panel', await box(leftPanel)],
      ['toolbar', await box(toolbar)],
      ['input bar', await box(inputBar)],
      ['node card', await box(nodeCard)],
    ];
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (intersects(boxes[i][1], boxes[j][1])) overlaps.push(`${boxes[i][0]} × ${boxes[j][0]}`);
      }
    }
    expect(overlaps).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('9. a five-round agent run fills the log and ends with a takeaway', async () => {
    test.setTimeout(150_000);
    const { toolbar, nodeCard, agentLog, inputBar, leftPanel } = ui(page);
    // The agent log shows while nothing is selected.
    if (await nodeCard.isVisible()) await nodeCard.getByRole('button', { name: 'Close' }).click();
    await toolbar.getByRole('button', { name: /^Settings/ }).click();
    await toolbar.getByRole('button', { name: '5', exact: true }).click();
    await expect(toolbar.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    const entries = async () => Number((await agentLog.getByText(/\d+ entries/).textContent())?.match(/\d+/)?.[0] ?? 0);
    const before = await entries();
    await expect(leftPanel.getByText('Key takeaway')).toBeHidden();

    await inputBar.getByRole('button', { name: /Run agents/ }).click();
    await expect(inputBar.getByRole('button', { name: /Pause/ })).toBeVisible();
    await expect.poll(entries, { timeout: 90_000 }).toBeGreaterThanOrEqual(before + 5);
    await expect(leftPanel.getByText('Key takeaway')).toBeVisible({ timeout: 90_000 });
    await expect(inputBar.getByRole('button', { name: /Run agents/ })).toBeVisible({ timeout: 30_000 });
  });

  test('10. Restore ID brings the brains back in a fresh context', async ({ browser }) => {
    // Read the full id through Copy, and check it against the display mirror.
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const mirrored = await page.evaluate(key => window.localStorage.getItem(key), UID_DISPLAY_KEY);
    expect(copied).toMatch(/^[0-9a-f-]{36}$/i);
    expect(copied).toBe(mirrored);

    const fresh = await browser.newContext();
    try {
      const other = await fresh.newPage();
      await other.goto('/');
      const o = ui(other);
      await expect(o.leftPanel.getByText(EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(o.brainButton).not.toContainText('№');
      await expect.poll(() => other.evaluate(key => window.localStorage.getItem(key), UID_DISPLAY_KEY)).not.toBeNull();
      const otherId = await other.evaluate(key => window.localStorage.getItem(key), UID_DISPLAY_KEY);
      expect(otherId).not.toBe(copied);

      await o.leftPanel.getByRole('button', { name: 'Restore ID', exact: true }).click();
      await o.leftPanel.getByRole('textbox', { name: 'ID to restore' }).fill(copied);
      await o.leftPanel.getByRole('button', { name: 'Restore', exact: true }).click();

      await expect(o.brainButton).toContainText('№ 001', { timeout: 15_000 });
      await expect(o.leftPanel.getByText('Night Market Repair', { exact: true })).toBeVisible();
      await o.brainButton.click();
      const menu = o.leftPanel.getByRole('button', { name: /Night Market Repair/ });
      await expect(menu).toContainText('001');
      await expect(o.leftPanel.getByRole('button', { name: /Tool Library/ })).toHaveCount(0);
    } finally {
      await fresh.close();
    }
  });

  test('11. Deleting the only brain returns to the empty state', async () => {
    const { leftPanel, brainButton, status } = ui(page);
    await expect(brainButton).toContainText('№ 001');
    await brainButton.click();
    const del = leftPanel.getByRole('button', { name: 'Delete this brain', exact: true });
    await del.click();
    await leftPanel.getByRole('button', { name: 'Confirm delete?', exact: true }).click();
    await expect(brainButton).toHaveText(/^Second brain\s*—/, { timeout: 15_000 });
    await expect(leftPanel.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
    await expect(status).toHaveText(EMPTY_STATUS);
    await expect(leftPanel.getByText('Legend — branches')).toHaveCount(0);
    await expect(leftPanel.getByText('Key takeaway')).toHaveCount(0);
    await expect(page.locator('.atlas-label')).toHaveCount(0);
    await brainButton.click();
    await expect(leftPanel.getByRole('button', { name: /Night Market Repair/ })).toHaveCount(0);
    await expect(leftPanel.getByRole('button', { name: /^001/ })).toHaveCount(0);
    await expect(leftPanel.getByRole('button', { name: 'Delete this brain', exact: true })).toHaveCount(0);
    await expect(leftPanel.getByRole('button', { name: '+ New second brain', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
