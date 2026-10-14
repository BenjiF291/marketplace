/* Bound game requests, including reading their bodies. Never retry mutations:
   a timed-out purchase or reward may already have been committed by the server. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
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
      return buffered;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
})();
