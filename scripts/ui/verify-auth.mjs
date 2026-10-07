// Local fixtures only: no real sign-in, registration or external service traffic.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const BASE = `http://localhost:${process.env.UI_TEST_PORT || '3000'}`;
const output = path.resolve('artifacts/ui');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  let providersMode = 'error'; let callbackError = 'Configuration'; const calls = []; const errors = [];
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.route('**/*', async (route) => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== BASE) return route.abort();
    // These endpoints are supplied by Vercel, not a local Next.js server.
    // Keep telemetry isolated instead of executing a login redirect as JS.
    if (url.pathname.startsWith('/_vercel/')) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    calls.push({ path: url.pathname, method: request.method() });
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (url.pathname === '/api/auth/providers') {
      if (providersMode === 'error') return json({ message: 'Configuration' }, 500);
      return json({ credentials: { id: 'credentials', type: 'credentials', name: 'Email' }, ...(providersMode === 'google' ? { google: { id: 'google', type: 'oidc', name: 'Google' } } : {}) });
    }
    if (url.pathname === '/api/auth/session') return json(null);
    if (url.pathname === '/api/auth/csrf') return json({ csrfToken: 'isolated-fixture-only' });
    if (url.pathname === '/api/auth/callback/credentials' || url.pathname === '/api/auth/signin/google') return json({ url: `${BASE}/api/auth/error?error=${callbackError}` });
    return json({ error: 'Unexpected auth fixture request' }, 500);
  });
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(BASE + '/login');
  await page.getByRole('alert').filter({ hasText: '現在ログインを利用できません' }).waitFor();
  assert(await page.getByRole('button', { name: 'ログイン', exact: true }).isDisabled());
  assert.equal(await page.getByRole('button', { name: 'Googleでログイン' }).count(), 0);
  providersMode = 'credentials'; await page.getByRole('button', { name: 'ログイン方法を再確認' }).click();
  await page.getByRole('button', { name: 'ログイン', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  assert.equal(await page.getByRole('button', { name: 'Googleでログイン' }).count(), 0);
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill('fixture@example.test');
  await page.getByLabel('パスワード', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'パスワードを表示', exact: true }).click();
  assert.equal(await page.getByLabel('パスワード', { exact: true }).getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'パスワードを隠す', exact: true }).click();
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'ログイン処理を完了できませんでした' }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/login');
  assert.equal(await page.getByText('メールアドレスまたはパスワードが間違っています', { exact: true }).count(), 0);
  assert.equal(await page.getByLabel('パスワード', { exact: true }).inputValue(), 'fixture-password');
  callbackError = 'CredentialsSignin'; await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'メールアドレスまたはパスワードが間違っています' }).waitFor();
  providersMode = 'google'; callbackError = 'Configuration'; await page.goto(BASE + '/login?error=Configuration');
  await page.getByRole('alert').filter({ hasText: 'ログイン処理を完了できませんでした' }).waitFor();
  await page.getByRole('button', { name: 'Googleでログイン' }).click();
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled);
  assert.equal(new URL(page.url()).pathname, '/login');
  for (const width of [360, 390, 768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1024 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `login overflow ${width}`);
    if ([390, 820, 1440].includes(width)) await page.screenshot({ path: path.join(output, `login-${width}.png`), fullPage: true });
  }
  assert(!calls.some((call) => call.path === '/api/auth/register'), 'No real account creation');
  assert.deepEqual(errors, []);
  console.log('PASS: providers failure/retry, disabled submit, optional Google, Configuration vs CredentialsSignin, callback recovery, password visibility/input retention, 6 widths; no page errors. External services blocked.');
} finally { await browser.close(); }
