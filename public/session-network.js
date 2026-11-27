/* Bound game requests, including reading their bodies. Never retry mutations:
   a timed-out purchase or reward may already have been committed by the server. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const gameFetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const apiOrigin = typeof API_URL === 'undefined' ? location.origin : new URL(API_URL, location.href).origin;
    if (url.origin !== apiOrigin || /\.(?:glb|js|css|png|jpg|webp|svg)$/i.test(url.pathname)) return nativeFetch(input, options);
    const controller = new AbortController();
    const signal = options.signal || input?.signal;
    const abort = () => controller.abort(signal.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('The connection timed out. Check your connection and try again.', 'TimeoutError')), 30000);
    try {
      const response = await nativeFetch(input, { ...options, signal: controller.signal });
      // Game endpoints return finite JSON/assets, never streaming responses.
      const body = await response.arrayBuffer();
      const buffered = new Response([101, 204, 205, 304].includes(response.status) ? null : body, {
        status: response.status, statusText: response.statusText, headers: response.headers
      });
      Object.defineProperties(buffered, { url: { value: response.url }, redirected: { value: response.redirected }, type: { value: response.type } });
      const method=String(options.method||input?.method||'GET').toUpperCase();if(response.ok&&!['GET','HEAD'].includes(method)&&!url.pathname.startsWith('/advancements/'))window.dispatchEvent(new Event('game-progress-changed'));
      return buffered;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
  // Share only concurrent reads, scoped by every header (including player identity).
  // Never retain player responses, combine writes, or combine caller-owned abort signals.
  const pending = new Map();
  let generation = 0;
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
    const apiOrigin = typeof API_URL === 'undefined' ? location.origin : new URL(API_URL, location.href).origin;
    if (url.origin === apiOrigin) {
      const headers = new Headers(options.headers ?? input?.headers);
      const user = headers.get('X-User-Id');
      if (user && !headers.has('Authorization') && user === window.localStorage?.getItem('userId')) {
        const token = window.localStorage.getItem('sessionToken');
        if (token) {
          headers.set('Authorization', 'Bearer ' + token);
          options = { ...options, headers };
        }
      }
    }
    const method = String(options.method || input?.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) { generation++; return gameFetch(input, options); }
    if (options.signal || (typeof input !== 'string' && !(input instanceof URL))) return gameFetch(input, options);
    const headers = [...new Headers(options.headers).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    const key = JSON.stringify([generation, String(input), method, headers, options.credentials, options.cache, options.mode, options.redirect, options.integrity]);
    let request = pending.get(key);
    if (!request) {
      request = gameFetch(input, options).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    return request.then(response => {
      const copy = response.clone();
      Object.defineProperties(copy, { url: { value: response.url }, redirected: { value: response.redirected }, type: { value: response.type } });
      return copy;
    });
  };
})();
