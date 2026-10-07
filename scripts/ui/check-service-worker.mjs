import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const handlers = {}, cached = [], deleted = [], stored = [];
let networkFails = false;
const cache = { addAll: async urls => cached.push(...urls), put: async (req) => stored.push(req.url) };
vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
  URL, Response, Promise,
  self: { location: { origin: 'https://studyflow.studio' }, addEventListener: (name, callback) => handlers[name] = callback, skipWaiting() {}, clients: { claim: async () => {}, matchAll: async () => [] } },
  caches: { open: async () => cache, keys: async () => ['studyflow-pwa-v1', 'studyflow-pwa-v2', 'other-app'], delete: async key => deleted.push(key), match: async () => undefined },
  fetch: async () => { if (networkFails) throw new Error('offline'); const response = new Response('fresh data'); Object.defineProperty(response, 'type', { value: 'basic' }); return response; },
});
let pending;
handlers.install({ waitUntil: promise => pending = promise }); await pending;
assert.deepEqual(cached, ['/manifest.webmanifest', '/logo.png', '/favicon.png']);
handlers.activate({ waitUntil: promise => pending = promise }); await pending;
assert.deepEqual(deleted, ['studyflow-pwa-v1']);
function request(path, mode = 'cors', method = 'GET') {
  let response;
  handlers.fetch({ request: { url: 'https://studyflow.studio' + path, method, mode }, respondWith: promise => response = promise });
  return response;
}
for (const path of ['/api/auth/session', '/api/support', '/api/memorize/decks', '/timer?_rsc=test', '/sw.js']) assert.equal(request(path), undefined, `Must bypass caches: ${path}`);
assert.equal(request('/api/support', 'cors', 'POST'), undefined);
await request('/_next/static/chunks/new-hash.js');
assert.deepEqual(stored, ['https://studyflow.studio/_next/static/chunks/new-hash.js']);
assert.equal(await (await request('/timer', 'navigate')).text(), 'fresh data');
networkFails = true;
const offline = await request('/login', 'navigate');
assert.equal(offline.status, 503); assert.equal(offline.headers.get('cache-control'), 'no-store');
const html = await offline.text(); assert(html.includes('接続を確認してください')); assert(!html.includes('ダッシュボード'));
console.log('PASS: public-only precache; old cache eviction; API/auth/RSC bypass; static asset cache; fresh navigation and generic offline page');
