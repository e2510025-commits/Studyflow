// Local API fixtures only; this script cannot write to Firebase or production.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const BASE = `http://localhost:${process.env.UI_TEST_PORT || '3000'}`;
const widths = [360, 390, 568, 820, 1180, 1440];
const routes = ['/memorize/create-deck', '/memorize/create-question', '/memorize/questions', '/memorize/deck/test-deck', '/memorize/deck/test-deck/edit', '/memorize/review/test-deck', '/memorize/review/test-deck/done', '/memorize/test/deck/test-deck', '/memorize/test/deck/test-deck/run', '/memorize/test/test-question', '/support', '/announcements', '/missions', '/onboarding'];
const output = path.resolve('artifacts/ui'); fs.mkdirSync(output, { recursive: true });
const deck = { id: 'test-deck', name: '英語の語彙と表現を毎日少しずつ覚える単語帳', description: '学習を続けるための例です。', color: '#3b82f6', cardCount: 2, createdAt: '2026-10-01T00:00:00Z' };
const cards = [{ id: 'card-1', front: 'continue', back: '続ける', hint: null }, { id: 'card-2', front: 'learn', back: '学ぶ', hint: null }];
const question = { id: 'test-question', title: '英語の基本表現', content: 'I (study) every day.', answers: ['study'], mode: 'normal', createdAt: '2026-10-01T00:00:00Z', attempts: [{ isCorrect: true }] };
const calls = [], errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.addCookies([{ name: 'authjs.session-token', value: 'local-ui-fixture', url: BASE }]);
await context.routeWebSocket('**/*', ws => new URL(ws.url()).hostname === 'localhost' ? ws.connectToServer() : ws.close());
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== BASE) return route.abort();
  if (!url.pathname.startsWith('/api/')) return route.continue();
  calls.push({ path: url.pathname, method: request.method(), body: request.postData() });
  let body = {};
  if (url.pathname === '/api/memorize/decks/test-deck') body = { deck, cards };
  else if (url.pathname === '/api/memorize/review/test-deck') body = { cards };
  else if (url.pathname === '/api/memorize/questions/test-question') body = { question };
  else if (url.pathname === '/api/memorize/questions') body = { questions: [question] };
  else if (url.pathname === '/api/subjects') body = { subjects: [{ id: 'english', name: '英語', color: '#3b82f6' }] };
  else if (url.pathname === '/api/support') body = { thread: { status: 'open' }, messages: [{ id: 'm-1', fromRole: 'admin', message: '状況を詳しくお知らせください。', createdAt: '2026-10-07T00:00:00Z' }] };
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
});
await context.addInitScript(() => {
  if (!localStorage.getItem('study-timer-storage')) localStorage.setItem('study-timer-storage', JSON.stringify({ version: 0, state: { theme: 'white', soundEnabled: false, userProfile: { uid: '1000000001', name: 'テストユーザー', avatar: '🎓', dailyGoal: 7200, totalPoints: 350, badges: [], equippedBadges: [] }, subjects: [{ id: 'english', name: '英語', color: '#3b82f6' }] } }));
});
const page = await context.newPage(); page.on('pageerror', error => errors.push({ route: page.url(), message: error.message }));
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function visit(route) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator(route === '/onboarding' ? '.onboarding-form' : '.app-header').waitFor();
  await page.waitForFunction(() => document.documentElement.className.includes('theme-'));
  await page.waitForFunction(() => ![...document.querySelectorAll('main')].some(el => el.textContent.trim() === '読み込み中...'));
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' }); await settle();
}
async function noOverflow(label) {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  if (size.scroll > size.width + 1) fs.writeFileSync(path.join(output, 'details-overflow.json'), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, class: el.className, text: el.textContent.slice(0, 50), rect: el.getBoundingClientRect().toJSON() }))), null, 2));
  assert(size.scroll <= size.width + 1, `${label}: ${size.scroll} > ${size.width}`);
}
try {
  for (const route of routes) {
    await visit(route);
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1024 }); await settle(); await noOverflow(`${route} ${width}`);
      if ([390, 820, 1440].includes(width)) await page.screenshot({ path: path.join(output, route.slice(1).replaceAll('/', '-') + '-' + width + '.png'), fullPage: true });
    }
  }
  console.log('PASS: 14 populated detail/editor/support/setup routes × 6 widths');
  await page.setViewportSize({ width: 390, height: 844 }); await visit('/onboarding');
  await page.getByLabel('表示名', { exact: true }).fill('新しい表示名');
  await page.getByLabel('自己紹介（任意）', { exact: true }).fill('毎日少しずつ');
  await page.getByLabel('公開範囲', { exact: true }).selectOption('friends');
  assert.equal(await page.getByRole('button', { name: '同意して登録する' }).isEnabled(), false);
  await page.getByLabel('利用規約に同意します', { exact: true }).check();
  await page.getByLabel('プライバシーポリシーに同意します', { exact: true }).check();
  assert.equal(await page.getByRole('button', { name: '同意して登録する' }).isEnabled(), true);
  await visit('/memorize/create-question'); await page.getByRole('button', { name: '一括解答', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '一括解答', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: '順次解答', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.setViewportSize({ width: 1440, height: 1024 }); await visit('/memorize/deck/test-deck');
  assert.equal(await page.locator('.study-detail-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 2, 'Desktop detail rail must use two columns');
  assert.equal(await page.locator('.brand-symbol').count(), 0, 'Decorative brand removed');
  assert.equal(await page.locator('.brand-short').isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 }); await settle();
  assert.equal(await page.locator('.study-detail-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1);
  await visit('/memorize/review/test-deck'); await page.getByRole('button', { name: '暗記カード', exact: true }).click();
  assert.equal(await page.locator('.study-detail-rail').count(), 0, 'Learning screen should hide ancillary navigation');
  await page.keyboard.press('ArrowRight'); await page.getByText('learn', { exact: true }).waitFor();
  await visit('/memorize/review/test-deck/done'); await page.getByRole('button', { name: 'テストする', exact: true }).click(); await page.waitForURL('**/memorize/test/deck/test-deck');
  await visit('/memorize/deck/test-deck/edit'); await page.getByPlaceholder('表 1', { exact: true }).fill('updated'); await page.getByPlaceholder('裏 1', { exact: true }).fill('更新');
  assert.equal(await page.getByPlaceholder('表 1', { exact: true }).inputValue(), 'updated');
  await visit('/support'); await page.getByLabel('お問い合わせ内容', { exact: true }).fill('ローカルの送信確認'); await page.getByRole('button', { name: 'お問い合わせを送信', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('textarea')?.value === '');
  assert.equal(JSON.parse(calls.find(row => row.path === '/api/support' && row.method === 'POST').body).message, 'ローカルの送信確認');
  assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'details-verification.json'), JSON.stringify({ passed: true, routes, widths, calls, errors }, null, 2));
  console.log('PASS: responsive columns, text-only branding, card navigation, completion → test, editor input, support mock submission; external writes blocked');
} catch (error) { await page.screenshot({ path: path.join(output, 'details-failure.png'), fullPage: true }); throw error; } finally { await browser.close(); }
