import { expect, test } from '@playwright/test';

test('主要导航和表单可使用键盘操作', async ({ page }) => {
  await page.goto('/new');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '轻途计划' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '新建计划' })).toBeFocused();
});

test('减少动态效果设置会关闭长过渡', async ({ browser }) => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto('/new');
  const durationSeconds = await page.locator('body').evaluate(() => {
    const value = getComputedStyle(document.body).transitionDuration;
    return value.endsWith('ms') ? Number.parseFloat(value) / 1000 : Number.parseFloat(value);
  });
  expect(durationSeconds).toBeLessThanOrEqual(0.001);
  await page.close();
});
