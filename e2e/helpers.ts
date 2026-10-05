import type { Page } from '@playwright/test';

/** Follow the visible Options disclosure before using a secondary control. */
export async function optionsClick(page: Page, id: string, touch = false): Promise<void> {
  const options = page.locator('#game-options');
  if (!await options.evaluate(element => (element as HTMLDetailsElement).open)) {
    await options.locator('summary').click();
  }
  if (touch) await page.locator(`#${id}`).tap();
  else await page.locator(`#${id}`).click();
}
