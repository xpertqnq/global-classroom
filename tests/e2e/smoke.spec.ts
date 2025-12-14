import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

test('헤더 아이콘 순서(새 대화/이전 히스토리/내보내기/로그인) 및 새창 제거', async ({ page }) => {
  const topRow = page.locator('header > div').first();

  const newChatButton = topRow.getByRole('button', { name: '새 대화' });
  const historyButton = topRow.getByRole('button', { name: '이전 히스토리' });
  const exportButton = topRow.getByRole('button', { name: '내보내기' });
  const loginButton = topRow.getByRole('button', { name: 'Login' });

  await expect(newChatButton).toBeVisible();
  await expect(historyButton).toBeVisible();
  await expect(exportButton).toBeVisible();
  await expect(loginButton).toBeVisible({ timeout: 10000 });

  await expect(topRow.getByRole('button', { name: '새창' })).toHaveCount(0);

  const newBox = await newChatButton.boundingBox();
  const historyBox = await historyButton.boundingBox();
  const exportBox = await exportButton.boundingBox();
  const loginBox = await loginButton.boundingBox();

  expect(newBox).not.toBeNull();
  expect(historyBox).not.toBeNull();
  expect(exportBox).not.toBeNull();
  expect(loginBox).not.toBeNull();

  expect(newBox!.x).toBeLessThan(historyBox!.x);
  expect(historyBox!.x).toBeLessThan(exportBox!.x);
  expect(exportBox!.x).toBeLessThan(loginBox!.x);
});

test('새 대화 생성 시 로컬 세션이 증가하고, 히스토리 모달에서 불러오기 동작', async ({ page }) => {
  const topRow = page.locator('header > div').first();

  await expect(topRow.getByRole('button', { name: '새 대화' })).toBeVisible();

  await topRow.getByRole('button', { name: '새 대화' }).click();

  await topRow.getByRole('button', { name: '이전 히스토리' }).click();
  await expect(page.getByRole('heading', { name: '이전 히스토리' })).toBeVisible();

  const localHeader = page.locator('div', { hasText: '로컬 세션:' }).first();
  const headerText = (await localHeader.innerText()).replace(/\s+/g, ' ');
  const match = headerText.match(/로컬 세션:\s*(\d+)/);
  expect(match).not.toBeNull();
  expect(Number(match![1])).toBeGreaterThanOrEqual(2);

  const loadButton = page.getByRole('button', { name: '불러오기' });
  await expect(loadButton).toBeEnabled();
  await loadButton.click();

  await expect(page.getByRole('heading', { name: '이전 히스토리' })).toHaveCount(0);
});
