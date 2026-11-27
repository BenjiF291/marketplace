const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness(fetch, stored = {}) {
  let timeout, cleared = 0;
  const context = { window: { fetch, dispatchEvent() {}, localStorage: { getItem: key => stored[key] } }, API_URL: 'https://api.example.com', location: { href: 'https://game.example.com/' }, Event, URL, Headers, Response, AbortController, DOMException,
    setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() { cleared++; } };
  vm.runInNewContext(fs.readFileSync('public/session-network.js', 'utf8'), context);
  return { fetch: context.window.fetch, expire: () => timeout(), cleared: () => cleared };
}
test('adds the saved session only to Marketplace requests for the signed-in account', async () => {
  const calls = [];
  const h = harness(async (url, options) => {
    calls.push(new Headers(options.headers).get('Authorization'));
    return new Response('{}');
  }, { userId: 'alice', sessionToken: 'fixture-token' });
  for (const [url, id] of [['https://api.example.com/inventory', 'alice'],
    ['https://api.example.com/inventory', 'bob'], ['https://other.example.com/inventory', 'alice']]) {
    await h.fetch(url, { headers: { 'X-User-Id': id } });
  }
  assert.deepEqual(calls, ['Bearer fixture-token', null, null]);
});
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

test('concurrent identical reads share transport but have independent bodies; later reads stay fresh', async () => {
 let calls=0,release; const gate=new Promise(r=>release=r);
 const h=harness(async()=>{calls++;await gate;return new Response('{"ok":true}');});
 const a=h.fetch('https://api.example.com/inventory',{headers:{'X-User-Id':'a'}});
 const b=h.fetch('https://api.example.com/inventory',{headers:{'X-User-Id':'a'}});
 const c=h.fetch('https://api.example.com/inventory',{headers:{'X-User-Id':'b'}});
 assert.equal(calls,2);release();
 for(const response of await Promise.all([a,b,c])) assert.deepEqual(await response.json(),{ok:true});
 await h.fetch('https://api.example.com/inventory',{headers:{'X-User-Id':'a'}});assert.equal(calls,3);
});
test('writes prevent subsequent reads from joining an older in-flight read',async()=>{
 let calls=0,release;const gate=new Promise(r=>release=r);
 const h=harness(async()=>{calls++;await gate;return new Response('{}');});
 const a=h.fetch('https://api.example.com/inventory');
 const write=h.fetch('https://api.example.com/buy',{method:'POST'});
 const b=h.fetch('https://api.example.com/inventory');assert.equal(calls,3);release();await Promise.all([a,write,b]);
});
