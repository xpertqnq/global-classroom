import { test, expect } from '@playwright/test';

test.describe('관리자 모드(E2E)', () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  test.beforeEach(async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, 'ADMIN_EMAIL/ADMIN_PASSWORD 환경변수가 필요합니다.');

    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
      }
    });

    await page.route('**/api/translate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translated: '안녕하세요' }),
      });
    });

    await page.route('**/api/live-token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'test-token', expireTime: new Date().toISOString() }),
      });
    });

    await page.route('**/api/detect-language', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'ko', confidence: 0.99 }),
      });
    });

    await page.route('**/api/tts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ audioBase64: 'AAECAwQ=' }),
      });
    });

    await page.route('**/api/vision', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ originalText: '', translatedText: '' }),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('이메일/비밀번호 로그인 후 관리자 모드 진입 및 API 진단 버튼 동작', async ({ page }) => {
    const header = page.locator('header');
    const openLogin = header.getByRole('button', { name: /로그인|Login/ });
    await expect(openLogin).toBeVisible({ timeout: 15000 });
    await openLogin.click();

    const loginDialog = page.getByRole('dialog', { name: '로그인' });
    await expect(loginDialog).toBeVisible();

    await loginDialog.getByPlaceholder('이메일').fill(adminEmail!);
    await loginDialog.getByPlaceholder('비밀번호').fill(adminPassword!);

    const profileMenuButton = header.getByRole('button', { name: '프로필 메뉴' });

    await loginDialog.getByRole('button', { name: '가입' }).click();
    try {
      await expect(profileMenuButton).toBeVisible({ timeout: 12000 });
    } catch {
      await loginDialog.getByRole('button', { name: '로그인' }).click();
      await expect(profileMenuButton).toBeVisible({ timeout: 20000 });
    }

    await profileMenuButton.click();

    const adminButton = page.getByRole('button', { name: '관리자 모드' });
    await expect(adminButton).toBeVisible({ timeout: 15000 });
    await adminButton.click();

    const adminDialog = page.getByRole('dialog', { name: '관리자 모드' });
    await expect(adminDialog).toBeVisible();

    await adminDialog.getByRole('button', { name: 'translate' }).click();
    await expect(adminDialog.getByText(/translate:/)).toBeVisible({ timeout: 10000 });

    await adminDialog.getByRole('button', { name: 'detect-language' }).click();
    await expect(adminDialog.getByText(/detect-language:/)).toBeVisible({ timeout: 10000 });

    await adminDialog.getByRole('button', { name: 'live-token' }).click();
    await expect(adminDialog.getByText(/live-token:/)).toBeVisible({ timeout: 10000 });
  });
});
