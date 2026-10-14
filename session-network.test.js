const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness(fetch) {
  let timeout, cleared = 0;
  const context = { window: { fetch }, API_URL: 'https://api.example.com', location: { href: 'https://game.example.com/' }, URL, Response, AbortController, DOMException,
    setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() { cleared++; } };
  vm.runInNewContext(fs.readFileSync('public/session-network.js', 'utf8'), context);
  return { fetch: context.window.fetch, expire: () => timeout(), cleared: () => cleared };
}
test('production API requests preserve JSON, status and headers', async () => {
  const h = harness(async () => new Response('{"balance":42}', { status: 201, headers: { 'content-type': 'application/json' } }));
  const response = await h.fetch('https://api.example.com/buy', { method: 'POST' });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { balance: 42 });
  assert.equal(h.cleared(), 1);
});
test('a stalled response body times out without retrying a mutation', async () => {
  let calls = 0;
  const h = harness(async (_, options) => {
    calls++;
    return { arrayBuffer: () => new Promise((resolve, reject) => { if(options.signal.aborted) reject(options.signal.reason); else options.signal.addEventListener('abort', () => reject(options.signal.reason)); }) };
  });
  const pending = h.fetch('https://api.example.com/buy', { method: 'POST' });
  await Promise.resolve();
  h.expire();
  await assert.rejects(pending, { name: 'TimeoutError' });
  assert.equal(calls, 1);
  assert.equal(h.cleared(), 1);
});
test('caller cancellation is preserved and 204 responses remain valid', async () => {
  const controller = new AbortController();
  controller.abort();
  const h = harness(async (_, options) => {
    if (options.signal.aborted) throw options.signal.reason;
    return new Response(null, { status: 204 });
  });
  await assert.rejects(h.fetch('https://api.example.com/action', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal((await h.fetch('https://api.example.com/action')).status, 204);
});
