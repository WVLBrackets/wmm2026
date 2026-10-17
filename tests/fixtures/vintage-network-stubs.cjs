// Local browser verification only. The test subprocess opts into this preload.
// Original homepage code uses its existing fallback when Sheets is unavailable.
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input));
  if (url.hostname === 'docs.google.com' || url.hostname === 'sheets.googleapis.com') {
    return new Response('', { status: 503 });
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('External network disabled in vintage browser verification.');
  }
  return originalFetch(input, init);
};
