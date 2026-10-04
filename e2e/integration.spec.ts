import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

const phase = (page: Page) => page.locator('#phase-label');

for (const profile of ['CIPHER_ZERO', 'VEKTOR_AGGRO', 'AEGIS_WALL']) {
test(`offline solo ${profile} completes Bo3, rematches, exits and routes to tutorial`, async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await page.locator('#bot-profile').selectOption(profile);
  await context.setOffline(true);
  await page.locator('#btn-solo').click();
  await expect(phase(page)).toHaveText('DEAL');
  await expect(page.locator('#btn-lock-in')).toBeDisabled();
  const checkedPhases = new Set<string>();
  for (let i = 0; i < 120; i++) {
    const current = await phase(page).textContent();
    if (profile === 'CIPHER_ZERO' && current && !checkedPhases.has(current)) {
      await page.locator('#btn-toggle-rules').click();
      await expect(page.locator('#rules-modal')).toBeVisible();
      await page.keyboard.press('Escape');
      checkedPhases.add(current);
    }
    if (current === 'MATCH OVER') break;
    if (current === 'DEAL') await page.clock.fastForward(2000);
    else if (current === 'SHAPING') {
      await page.locator('#btn-ready').click();
      await page.clock.fastForward(1500);
    } else if (current === 'COMMITMENT') {
      await page.locator('#stance-overcharge').click();
      await page.locator('#btn-lock-in').click();
      await page.clock.fastForward(1500);
    } else if (current === 'CLASH REVEAL') {
      await expect(page.locator('#clash-reveal')).toContainText('OPPONENT: ASSAULT');
      await page.clock.fastForward(4000);
    } else if (current === 'ROUND RESOLVE') await page.clock.fastForward(3000);
    else throw new Error(`Unexpected solo phase: ${current}`);
  }
  await expect(phase(page)).toHaveText('MATCH OVER');
  if (profile === 'CIPHER_ZERO') expect([...checkedPhases].sort()).toEqual(['CLASH REVEAL', 'COMMITMENT', 'DEAL', 'MATCH OVER', 'ROUND RESOLVE', 'SHAPING']);
  await expect(page.locator('#center-banner')).toContainText('MATCH');
  await page.locator('#btn-rematch').click();
  await expect(phase(page)).toHaveText('DEAL');
  await expect(page.locator('#player-hp')).toHaveText('20');
  await page.locator('#btn-exit').click();
  await page.clock.fastForward(60000);
  await expect(page.locator('#main-menu-overlay')).toBeVisible();
  await expect(page.locator('#game-board-overlay')).toBeHidden();
  await page.locator('#btn-tutorial').click();
  await expect(page.locator('#tutorial-overlay')).toBeVisible();
  await page.locator('#tut-skip-btn').click();
  await expect(page.locator('#main-menu-overlay')).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(1);
  expect(errors).toEqual([]);
});

}

test('two browsers share a room, map seats, finish a match, rematch and forfeit', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
  try {
    await host.goto('/');
    await host.locator('#player-name-input').fill('Host');
    await host.locator('#btn-host').click();
    await expect(host.locator('#room-code')).toHaveText(/^ROOM [A-Z0-9]{4}$/);
    const code = (await host.locator('#room-code').textContent())!.slice(5);
    await guest.goto(`/?room=${code}`);
    await expect(guest.locator('#input-room')).toHaveValue(code);
    await guest.locator('#player-name-input').fill('Guest');
    await guest.locator('#btn-multiplayer').click();
    await expect(host.locator('#local-dock-name')).toContainText('Host');
    await expect(guest.locator('#local-dock-name')).toContainText('Guest');
    await expect(host.locator('#opponent-name')).toContainText('Guest');
    await expect(guest.locator('#opponent-name')).toContainText('Host');
    for (let i = 0; i < 30; i++) {
      await expect(phase(host)).toHaveText(/SHAPING|MATCH OVER/, { timeout: 15000 });
      if (await phase(host).textContent() === 'MATCH OVER') break;
      await expect(host.locator('#clash-reveal')).toBeEmpty();
      await Promise.all([host.locator('#btn-ready').click(), guest.locator('#btn-ready').click()]);
      await expect(phase(host)).toHaveText('COMMITMENT');
      await expect(phase(guest)).toHaveText('COMMITMENT');
      for (const page of [host, guest]) {
        await page.locator('#stance-overcharge').click();
        await page.locator('#btn-lock-in').click();
      }
      await expect(phase(host)).toHaveText('CLASH REVEAL');
      await expect(phase(guest)).toHaveText('CLASH REVEAL');
      await expect(host.locator('#clash-reveal')).toContainText('OPPONENT: ASSAULT');
      await expect(guest.locator('#clash-reveal')).toContainText('OPPONENT: ASSAULT');
    }
    await expect(phase(host)).toHaveText('MATCH OVER');
    await expect(phase(guest)).toHaveText('MATCH OVER');
    await host.locator('#btn-rematch').click();
    await expect(phase(host)).toHaveText('MATCH OVER');
    await guest.locator('#btn-rematch').click();
    await expect(phase(host)).toHaveText('DEAL');
    await expect(host.locator('#player-hp')).toHaveText('20');
    await expect(guest.locator('#player-hp')).toHaveText('20');
    await guest.locator('#btn-exit').click();
    await expect(phase(host)).toHaveText('MATCH OVER');
    await expect(host.locator('#center-banner')).toHaveText('MATCH VICTORY!');
    await host.locator('#btn-exit').click();
    await expect(host.locator('#main-menu-overlay')).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await hostContext.close(); await guestContext.close(); }
});


test('room sharing, timeout, dropped sockets, reload recovery and grace expiry', async ({ browser }) => {
  const hostContext = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const guestRoutes: { browser: WebSocketRoute; server: WebSocketRoute }[] = [];
  const commands: string[] = [];
  let blockRecovery = false;
  let inits = 0;
  let seat = '';
  const errors: string[] = [];
  for (const page of [host, guest]) page.on('pageerror', error => errors.push(error.message));
  await guest.routeWebSocket('**/ws', socket => {
    if (blockRecovery) return; // Simulate an unavailable server during grace.
    const server = socket.connectToServer();
    guestRoutes.push({ browser: socket, server });
    socket.onMessage(message => {
      commands.push(JSON.parse(String(message)).type);
      server.send(message);
    });
    server.onMessage(message => {
      const parsed = JSON.parse(String(message));
      if (parsed.type === 'STATE_INIT') { inits++; seat = parsed.playerId; }
      socket.send(message);
    });
  });
  const drop = async () => {
    const route = guestRoutes.at(-1)!;
    await route.server.close();
    await route.browser.close({ code: 1012, reason: 'Acceptance test disconnect' });
  };
  try {
    await host.goto('/');
    await host.locator('#player-name-input').fill('Host');
    await host.locator('#btn-host').click();
    await expect(host.locator('#room-code')).toHaveText(/^ROOM [A-Z0-9]{4}$/);
    const code = (await host.locator('#room-code').textContent())!.slice(5);
    await host.locator('#btn-copy-code').click();
    await expect.poll(() => host.evaluate(() => navigator.clipboard.readText())).toBe(code);
    await host.locator('#btn-copy-link').click();
    await expect.poll(() => host.evaluate(() => navigator.clipboard.readText())).toBe(`http://127.0.0.1:4173/?room=${code}`);
    await guest.goto(`/?room=${code}`);
    await guest.locator('#player-name-input').fill('Guest');
    await guest.locator('#btn-multiplayer').click();
    await expect(phase(host)).toHaveText('SHAPING');
    for (let remaining = 2; remaining >= 0; remaining--) {
      await host.locator('.nudge-up-btn').first().click();
      await expect(host.locator('#player-flux')).toHaveText(`${remaining}/3`);
    }
    await expect(host.locator('.nudge-up-btn').first()).toBeDisabled();
    await expect(host.locator('.bleed-btn').first()).toBeDisabled();
    await host.locator('.burn-btn').first().click();
    await expect(host.locator('.burn-btn').first()).toBeDisabled();
    await expect(host.locator('#clash-reveal')).toBeEmpty();
    const originalSeat = seat;
    expect(originalSeat).toBe('player_2');
    await drop();
    await expect(guest.locator('#center-banner')).toContainText('reconnecting');
    await expect(guest.locator('#btn-ready')).toBeDisabled();
    await expect.poll(() => inits).toBe(2);
    expect(seat).toBe(originalSeat);
    expect(commands.filter(type => type === 'CMD_RECONNECT')).toHaveLength(1);
    await expect(guest.locator('#local-dock-name')).toContainText('Guest');
    await expect(guest.locator('#btn-ready')).toBeEnabled();
    await guest.reload();
    await expect.poll(() => inits).toBe(3);
    expect(seat).toBe(originalSeat);
    expect(commands.filter(type => type === 'CMD_JOIN_ROOM')).toHaveLength(1);
    expect(commands.filter(type => type === 'CMD_RECONNECT')).toHaveLength(2);
    await expect(guest.locator('#local-dock-name')).toContainText('Guest');
    // Neither browser readies or commits. The production server must auto-lock.
    await expect(phase(host)).toHaveText('COMMITMENT', { timeout: 16000 });
    await expect(phase(host)).toHaveText('CLASH REVEAL', { timeout: 11000 });
    await expect(phase(guest)).toHaveText('CLASH REVEAL');
    await expect(guest.locator('#clash-reveal')).toContainText('BRACE');
    blockRecovery = true;
    await drop();
    await expect(guest.locator('#center-banner')).toContainText('reconnecting');
    await expect(guest.locator('#main-menu-overlay')).toBeVisible({ timeout: 32000 });
    await expect(guest.locator('#menu-error')).toContainText('session expired');
    await expect(phase(host)).toHaveText('MATCH OVER');
    await expect(host.locator('#center-banner')).toHaveText('MATCH VICTORY!');
    await expect.poll(() => guest.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('cyberante.session:')).length)).toBe(0);
    expect(errors).toEqual([]);
  } finally { await hostContext.close(); await guestContext.close(); }
});

test('rejected joins return to menu and exiting a pending room cancels its callbacks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await page.locator('#input-room').fill('0000');
  await page.locator('#btn-multiplayer').click();
  await expect(page.locator('#main-menu-overlay')).toBeVisible();
  await expect(page.locator('#menu-error')).not.toBeEmpty();
  await page.locator('#input-room').fill('');
  await page.locator('#btn-host').click();
  await page.locator('#btn-exit').click();
  await page.locator('#btn-solo').click();
  await page.clock.fastForward(2000);
  await expect(phase(page)).toHaveText('SHAPING');
  await page.clock.fastForward(10000);
  await expect(page.locator('#game-board-overlay')).toBeVisible();
  await expect(page.locator('#main-menu-overlay')).toBeHidden();
  await expect(page.locator('#local-dock-name')).toContainText('YOUR HAND');
  expect(errors).toEqual([]);
});
