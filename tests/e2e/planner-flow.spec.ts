import { expect, test } from '@playwright/test';

test('从填写条件到保存、编辑和计划管理的主流程', async ({ page }) => {
  await page.goto('/new');
  await page.getByLabel('出发地').fill('杭州');
  await page.getByLabel('目的地').selectOption('shanghai');
  await page.getByLabel('开始日期').fill('2026-08-01');
  await page.getByLabel('结束日期').fill('2026-08-03');
  await page.getByRole('button', { name: '生成行程' }).click();

  await expect(page).toHaveURL(/\/plans\/.+/);
  await expect(page.getByRole('heading', { name: /上海 2026-08-01/ })).toBeVisible();
  await page.getByRole('button', { name: '锁定项目' }).first().click();
  await expect(page.getByText('已锁定').first()).toBeVisible();
  await page.getByRole('button', { name: '重新生成' }).click();
  await expect(page.getByRole('status')).toContainText('已保留');

  await page.getByRole('link', { name: '本地计划' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: '复制计划' }).click();
  await expect(page.getByRole('article')).toHaveCount(2);
});
