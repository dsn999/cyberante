import { expect, test, type Page } from '@playwright/test';

const step = async (page: Page, number: number): Promise<void> => { await expect(page.locator('#tutorial-overlay')).toHaveAttribute('data-step', String(number)); };
const card = (page: Page, id: string) => page.locator(`.hand-card[data-card-id="${id}"]`);
async function start(page: Page): Promise<void> { await page.goto('/'); await page.locator('#btn-tutorial').click(); await step(page, 1); }
async function advanceToBurn(page: Page): Promise<void> {
  await page.locator('#btn-auto-split').click(); await step(page, 2);
  await card(page, 'flux-4').locator('.nudge-down-btn').click();
  await page.locator('#tut-next-btn').click(); await step(page, 3);
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`complete interactive training offline at ${viewport.width}px with real controls, clash and completion`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: viewport.width < 500 });
    const page = await context.newPage(); const errors: string[] = []; const sockets: string[] = []; const apiRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('websocket', socket => sockets.push(socket.url()));
    page.on('request', request => { if (['fetch', 'xhr'].includes(request.resourceType())) apiRequests.push(request.url()); });
    try {
      await page.goto('/'); await context.setOffline(true); await page.locator('#btn-tutorial').click();
      await step(page, 1); await expect(page.locator('#tut-next-btn')).toBeDisabled(); await expect(page.locator('#assault-slots button')).toHaveCount(0);
      await expect(page.locator('#btn-ready')).toBeHidden();
      expect(await page.locator('.hand-card .rank').allTextContents()).toEqual(['A', 'K', 'Q', '10', '4']);
      await page.locator('.card-face').first().click(); await step(page, 1); await expect(page.locator('#assault-slots button')).toHaveCount(1);
      await page.locator('#btn-auto-split').click(); await step(page, 2);
      expect(await page.locator('.hand-card .rank').allTextContents()).toEqual(['A', '2', '4', '8', '8']);
      await card(page, 'flux-4').locator('.nudge-up-btn').click(); await step(page, 2); await expect(card(page, 'flux-4').locator('.rank')).toHaveText('4'); await expect(page.locator('#player-flux')).toHaveText('3/3');
      await expect(page.locator('#tut-next-btn')).toBeDisabled(); await expect(card(page, 'flux-4').locator('.nudge-down-btn')).toHaveClass(/tutorial-target/);
      await card(page, 'flux-4').locator('.nudge-down-btn').focus(); await page.keyboard.press('Enter');
      await step(page, 2); await expect(card(page, 'flux-4').locator('.rank')).toHaveText('3'); await expect(page.locator('#player-flux')).toHaveText('2/3');
      await expect(page.locator('#assault-preview')).toContainText('18 DMG'); await expect(page.locator('#tutorial-feedback')).toContainText('A–2–3');
      await page.locator('#tut-next-btn').click(); await step(page, 3);
      expect(await page.locator('.hand-card .rank').allTextContents()).toEqual(['K', '7', '8', '9', '10']);
      await card(page, 'burn-7').locator('.burn-btn').click(); await expect(page.locator('#player-barrier-badge')).toBeHidden(); await expect(card(page, 'burn-k')).toBeVisible();
      await card(page, 'burn-k').locator('.burn-btn').click(); await step(page, 3); await expect(page.locator('#player-barrier-val')).toHaveText('10');
      await expect(card(page, 'replacement-9').locator('.rank')).toHaveText('9'); await expect(page.locator('.burn-btn').first()).toBeDisabled();
      await page.locator('#tut-next-btn').click(); await step(page, 4); await expect(page.locator('#phase-label')).toHaveText('COMMITMENT');
      await page.locator('#btn-lock-in').click(); await expect(page.locator('#tutorial-overlay')).toHaveAttribute('data-complete', 'false');
      await page.locator('#stance-parry').click(); await page.locator('#btn-lock-in').click(); await expect(page.locator('#tutorial-overlay')).toHaveAttribute('data-complete', 'false');
      await page.locator('#stance-overcharge').click(); await page.locator('#btn-lock-in').click();
      await expect(page.locator('#tutorial-title')).toHaveText('TRAINING COMPLETE: OPERATIVE COMBAT READY');
      await expect(page.locator('#tutorial-overlay')).toHaveAttribute('data-complete', 'true');
      await expect(page.locator('#clash-reveal')).toContainText('OVERCHARGE'); await expect(page.locator('#clash-reveal')).toContainText('PARRY');
      await expect(page.locator('#player-hp')).toHaveText('2'); await expect(page.locator('#opponent-hp')).toHaveText('0');
      await expect(page.locator('#btn-lock-in')).toBeDisabled();
      await page.locator('#game-board-overlay').evaluate(board => { board.scrollTop = 0; });
      await page.screenshot({ animations: 'disabled', path: `/tmp/cyberante-spec09-complete-${viewport.width}.png` });
      const sizes = await page.locator('#tutorial-overlay button').evaluateAll(buttons => buttons.map(button => ({ width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
      sizes.forEach(size => { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); });
      const overflow = await page.locator('#tutorial-overlay').evaluate(overlay => overlay.scrollWidth > overlay.clientWidth);
      expect(overflow).toBe(false);
      await page.locator('#tut-next-btn').click(); await expect(page.locator('#main-menu-overlay')).toBeVisible(); await expect(page.locator('#tutorial-overlay')).toBeHidden();
      await expect(page.locator('.tutorial-target')).toHaveCount(0); expect(sockets).toEqual([]); expect(apiRequests).toEqual([]); expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test('manual split participation, back/replay and skip/Escape from every lesson preserve clean mode transitions', async ({ page }) => {
  await start(page);
  for (let index = 0; index < 4; index++) { await page.locator('.card-face').nth(index).click(); await step(page, 1); }
  await page.locator('.card-face').nth(4).click(); await step(page, 2);
  await page.locator('#tut-prev-btn').click(); await step(page, 1); await expect(page.locator('#assault-slots button')).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(page.locator('#main-menu-overlay')).toBeVisible();
  for (let lesson = 1; lesson <= 4; lesson++) {
    await page.locator('#btn-tutorial').click();
    if (lesson >= 2) { await page.locator('#btn-auto-split').click(); }
    if (lesson >= 3) { await card(page, 'flux-4').locator('.nudge-down-btn').click(); await page.locator('#tut-next-btn').click(); }
    if (lesson === 4) { await card(page, 'burn-k').locator('.burn-btn').click(); await page.locator('#tut-next-btn').click(); }
    await step(page, lesson);
    if (lesson % 2) await page.locator('#tut-skip-btn').click(); else await page.keyboard.press('Escape');
    await expect(page.locator('#main-menu-overlay')).toBeVisible(); await expect(page.locator('#tutorial-overlay')).toBeHidden(); await expect(page.locator('.tutorial-target')).toHaveCount(0);
  }
  await page.locator('#btn-solo').click(); await expect(page.locator('#game-board-overlay')).toBeVisible(); await expect(page.locator('#match-progress')).toContainText('ROUND');
  await page.locator('#btn-exit').click(); await page.locator('#btn-tutorial').click(); await step(page, 1);
  await expect(page.locator('#assault-slots button')).toHaveCount(0); await expect(page.locator('#player-barrier-badge')).toBeHidden();
});

test('rules remain available during training and Escape closes only the top dialog', async ({ page }) => {
  await start(page); await advanceToBurn(page);
  await page.locator('#btn-toggle-rules').click(); await expect(page.locator('#rules-modal')).toBeVisible(); await expect(page.locator('#close-rules-btn')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#rules-modal')).toBeHidden(); await step(page, 3); await expect(page.locator('#tutorial-overlay')).toBeVisible();
  await expect(page.locator('#btn-toggle-rules')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#main-menu-overlay')).toBeVisible();
});

test('complete reference tables and solo commitments survive rules while the clock continues', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-04T00:00:00Z') }); await page.goto('/'); await page.clock.pauseAt(new Date('2026-10-04T02:00:00Z'));
  await page.locator('#btn-menu-rules').click(); await expect(page.locator('#rules-modal table')).toHaveCount(3);
  await expect(page.locator('#rules-modal')).toContainText('18 damage'); await expect(page.locator('#rules-modal')).toContainText('8 block');
  for (const text of ['OVERCHARGE', 'PARRY', 'Veil', 'Barrier', 'Siphon', 'Sunder', 'Cannot resurrect', 'Ace 11', '1 HP', '10-exchange']) await expect(page.locator('#rules-modal')).toContainText(text);
  await page.keyboard.press('Escape'); await expect(page.locator('#btn-menu-rules')).toBeFocused();
  await page.locator('#btn-solo').click(); await page.clock.fastForward(2000);
  const assault = await page.locator('#assault-slots button').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.cardId));
  await page.locator('#stance-overcharge').click(); await page.locator('#btn-ready').click(); await page.clock.fastForward(1500);
  await page.locator('#btn-toggle-rules').click(); await page.clock.fastForward(1000); await page.keyboard.press('Escape');
  expect(await page.locator('#assault-slots button').evaluateAll(buttons => buttons.map(button => (button as HTMLElement).dataset.cardId))).toEqual(assault);
  await expect(page.locator('#stance-overcharge')).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('#timer-display')).toHaveText('9.0s');
  await page.locator('#btn-lock-in').click(); await expect(page.locator('#btn-lock-in')).toBeDisabled();
  await page.locator('#btn-toggle-rules').click(); await page.clock.fastForward(2000); await page.keyboard.press('Escape');
  await expect(page.locator('#clash-reveal')).toContainText('OVERCHARGE'); await expect(page.locator('#btn-lock-in')).toBeDisabled();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`training instructions scroll while skip and navigation remain visible at ${viewport.width}×${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true }); const page = await context.newPage();
    try {
      await start(page);
      const inspect = async (): Promise<void> => {
        const geometry = await page.locator('#tutorial-overlay').evaluate(overlay => {
          const rect = overlay.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, width: overlay.clientWidth, scrollWidth: overlay.scrollWidth, copyHeight: overlay.querySelector('.tutorial-copy')!.getBoundingClientRect().height, buttons: Array.from(overlay.querySelectorAll('button')).map(button => ({ top: button.getBoundingClientRect().top, bottom: button.getBoundingClientRect().bottom, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })) };
        });
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
        geometry.buttons.forEach(button => { expect(button.top).toBeGreaterThanOrEqual(geometry.top); expect(button.bottom).toBeLessThanOrEqual(geometry.bottom + 1); expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44); });
        expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
        expect(geometry.copyHeight).toBeGreaterThanOrEqual(44);
        const targetCenter = await page.locator('.tutorial-target').first().evaluate(target => { const bounds = target.getBoundingClientRect(); return bounds.top + bounds.height / 2; });
        const toolbarBottom = await page.locator('.game-toolbar').evaluate(toolbar => toolbar.getBoundingClientRect().bottom);
        expect(targetCenter).toBeLessThan(geometry.top);
        expect(targetCenter).toBeGreaterThan(toolbarBottom);
      };
      await inspect();
      await page.locator('.tutorial-copy').evaluate(copy => { copy.scrollTop = copy.scrollHeight; }); await inspect();
      await page.screenshot({ animations: 'disabled', path: `/tmp/cyberante-spec09-lesson-${viewport.width}.png` });
      await page.locator('#btn-auto-split').tap(); await step(page, 2); await inspect();
      await card(page, 'flux-4').locator('.nudge-down-btn').tap(); await page.locator('#tut-next-btn').tap(); await step(page, 3); await inspect();
      await page.locator('#tut-skip-btn').tap(); await expect(page.locator('#main-menu-overlay')).toBeVisible();
    } finally { await context.close(); }
  });
}

test('rules are available in the online lobby without changing room membership', async ({ page }) => {
  await page.goto('/'); await page.locator('#btn-host').click(); await expect(page.locator('#room-code')).toHaveText(/^ROOM [A-Z0-9]{4}$/);
  const code = await page.locator('#room-code').textContent();
  await page.locator('#btn-toggle-rules').click(); await expect(page.locator('#rules-modal')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#room-code')).toHaveText(code!); await expect(page.locator('#phase-label')).toHaveText('LOBBY WAIT');
  await expect(page.locator('#btn-toggle-rules')).toBeFocused(); await page.locator('#btn-exit').click(); await expect(page.locator('#main-menu-overlay')).toBeVisible();
});

test('reduced motion disables training pulses while keyboard controls stay interactive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page);
  await expect(page.locator('.tutorial-target').first()).toHaveCSS('animation-name', 'none');
  await page.locator('#btn-auto-split').focus(); await page.keyboard.press('Enter'); await step(page, 2);
  await card(page, 'flux-4').locator('.nudge-down-btn').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#tutorial-feedback')).toContainText('A–2–3');
  await page.locator('#tut-next-btn').focus(); await page.keyboard.press('Enter'); await step(page, 3);
  await expect(page.locator('.tutorial-target').first()).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape'); await expect(page.locator('#main-menu-overlay')).toBeVisible();
});
