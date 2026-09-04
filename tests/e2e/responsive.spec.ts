import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 800, height: 1000 }, { width: 1280, height: 900 }]) {
  test(`${viewport.width}px 视口不会横向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/new');
    await expect(page.getByRole('heading', { name: '新建旅行计划' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (viewport.width === 390) {
      await expect(page.getByRole('button', { name: '生成行程' })).toHaveCSS('position', 'static');
      await expect(page.getByRole('button', { name: '打开导航菜单' })).toBeVisible();
    }
  });
}
