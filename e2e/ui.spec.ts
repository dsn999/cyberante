import { expect, test, type Page } from '@playwright/test';
import { SUIT_RING, type Suit } from '@cyberante/shared';

async function solo(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-10-04T00:00:00Z') });
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-10-04T02:00:00Z'));
  await page.locator('#btn-solo').click(); await page.clock.fastForward(2000);
  await expect(page.locator('#phase-label')).toHaveText('SHAPING');
}

test('keyboard lane swaps, partial selections, both bleed directions and authoritative control states', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await solo(page);
  const assault = page.locator('.hand-card[data-lane="assault"] .card-face').first();
  const aegis = page.locator('.hand-card[data-lane="aegis"] .card-face').first();
  const assaultId = await assault.getAttribute('data-card-id'); const aegisId = await aegis.getAttribute('data-card-id');
  await assault.focus(); await page.keyboard.press('Enter');
  await expect(assault).toHaveAttribute('aria-pressed', 'true');
  await aegis.focus(); await page.keyboard.press('Space');
  await expect(page.locator(`.hand-card[data-card-id="${assaultId}"]`)).toHaveAttribute('data-lane', 'aegis');
  await expect(page.locator(`.hand-card[data-card-id="${aegisId}"]`)).toHaveAttribute('data-lane', 'assault');
  const badge = page.locator('#assault-slots button').first(); const removedId = await badge.getAttribute('data-card-id');
  await badge.click(); await expect(page.locator('#assault-slots button')).toHaveCount(2);
  // A shaping tick must not auto-fill a deliberately incomplete partition.
  await page.locator('.nudge-up-btn').first().click();
  await expect(page.locator('#assault-slots button')).toHaveCount(2);
  await expect(page.locator('#player-flux')).toHaveText('2/3');
  const firstCard = page.locator('.hand-card').first();
  const currentSuit = await firstCard.locator('.suit-name').textContent() as Suit;
  const neighbors = await firstCard.locator('.bleed-btn').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.suit));
  expect(neighbors).toEqual(SUIT_RING[currentSuit]);
  const targetSuit = neighbors[1]!;
  await firstCard.locator('.bleed-btn').nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(firstCard.locator('.suit-name')).toHaveText(targetSuit);
  await expect(page.locator('#player-flux')).toHaveText('0/3');
  await expect(firstCard.locator('.card-face')).toBeFocused();
  await expect(page.locator('.nudge-up-btn').first()).toBeDisabled(); await expect(page.locator('.bleed-btn').first()).toBeDisabled();
  await page.locator('.burn-btn').first().click(); await expect(page.locator('.burn-btn').first()).toBeDisabled();
  await page.locator('#btn-ready').click(); await page.clock.fastForward(1500);
  await expect(page.locator('#phase-label')).toHaveText('COMMITMENT');
  await expect(page.locator('#btn-lock-in')).toBeDisabled();
  if (await page.locator(`.card-face[data-card-id="${removedId}"]`).count()) {
    await page.locator(`.card-face[data-card-id="${removedId}"]`).click();
  } else await page.locator('.hand-card[data-lane="unassigned"] .card-face').click();
  await expect(page.locator('#btn-lock-in')).toBeEnabled();
  await page.locator('#stance-parry').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#stance-parry')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#stance-brace')).toHaveAttribute('aria-pressed', 'false');
  await page.clock.fastForward(7000); await expect(page.locator('#btn-lock-in')).toHaveClass(/urgent/);
  await page.locator('#btn-lock-in').click(); await expect(page.locator('#btn-lock-in')).toBeDisabled();
  await expect(page.locator('#btn-toggle-rules')).toBeEnabled();
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 767, height: 700 }, { width: 1280, height: 720 }]) {
  test(`responsive UI, touch targets and rules at ${viewport.width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true }); const page = await context.newPage();
    try {
      await solo(page);
      const dimensions = await page.locator('#game-board-overlay').evaluate(board => ({ width: board.clientWidth, scrollWidth: board.scrollWidth }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
      const sizes = await page.locator('#game-board-overlay button').evaluateAll(buttons => buttons.filter(button => !(button as HTMLElement).hidden && button.getBoundingClientRect().width > 0).map(button => { const rect = button.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
      for (const size of sizes) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
      await page.locator('.card-face').first().tap();
      await expect(page.locator('.card-face[aria-pressed="true"]')).toHaveCount(1);
      await page.locator('#btn-toggle-rules').tap();
      await expect(page.locator('#rules-modal')).toBeVisible();
      await expect(page.locator('#close-rules-btn')).toBeFocused();
      await page.clock.fastForward(1000);
      await page.keyboard.press('Escape'); await expect(page.locator('#rules-modal')).toBeHidden();
      await expect(page.locator('#timer-display')).toHaveText('14.0s');
      await expect(page.locator('#btn-toggle-rules')).toBeFocused();
      await page.locator('#btn-exit').tap(); await expect(page.locator('#main-menu-overlay')).toBeVisible();
      const menuWidth = await page.locator('#main-menu-overlay').evaluate(menu => ({ width: menu.clientWidth, scrollWidth: menu.scrollWidth }));
      expect(menuWidth.scrollWidth).toBeLessThanOrEqual(menuWidth.width);
    } finally { await context.close(); }
  });
}

test('CRT is independent of motion, mute stays synchronized, and modal focus is contained', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/'); await page.locator('#btn-mute').click();
  await page.locator('#btn-solo').click(); await expect(page.locator('#btn-toggle-mute')).toHaveText('AUDIO: MUTED');
  await page.locator('#btn-toggle-crt').click(); await expect(page.locator('body')).toHaveClass(/clean-display/);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.locator('body').evaluate(body => getComputedStyle(body, '::after').display)).toBe('none');
  await page.locator('#btn-toggle-mute').click(); await expect(page.locator('#btn-toggle-mute')).toHaveText('AUDIO: ON');
  await page.locator('#btn-toggle-rules').click(); await expect(page.locator('#close-rules-btn')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('dialog')?.id)).toBe('rules-modal');
  await page.keyboard.press('Escape'); await expect(page.locator('#btn-toggle-rules')).toBeFocused();
  await page.locator('#btn-exit').click(); await expect(page.locator('#btn-mute')).toHaveText('AUDIO: ON');
});

test('menu validates names and room codes and exposes host and join actions', async ({ page }) => {
  await page.goto('/'); await page.locator('#player-name-input').fill('   '); await page.locator('#btn-host').click();
  await expect(page.locator('#menu-error')).toContainText('player name'); await expect(page.locator('#player-name-input')).toBeFocused();
  await page.locator('#player-name-input').fill('  Named Player  '); await page.locator('#input-room').fill('a!b');
  await expect(page.locator('#input-room')).toHaveValue('AB'); await page.locator('#btn-multiplayer').click();
  await expect(page.locator('#menu-error')).toContainText('four');
  await page.locator('#btn-host').click(); await expect(page.locator('#player-name')).toHaveText('Named Player');
  await expect(page.locator('#room-code')).toHaveText(/^ROOM [A-Z0-9]{4}$/);
});
