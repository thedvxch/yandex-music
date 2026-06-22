/**
 * Custom `fetch`: route the client through node-wreq for browser TLS/JA3
 * impersonation instead of Node's bare `fetch`.
 *
 * Why: Node's `fetch` (undici) has a recognisable TLS fingerprint. node-wreq
 * replays a real Chrome/Firefox/Safari handshake (JA3/JA4), so requests look
 * like they came from a browser. Its `.fetch` is WHATWG-compatible, which is
 * exactly what `Client({ fetch })` expects.
 *
 * Run with:
 *   npm install node-wreq
 *   YM_TOKEN=... npx tsx examples/12-custom-fetch.ts "daft punk"
 *
 * The same seam takes any drop-in fetch — a proxy wrapper, a retry wrapper, an
 * undici Agent, or a stub in tests.
 */
import { createClient } from 'node-wreq';
import { Client, type FetchLike } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

// Pick any of node-wreq's 100+ profiles (chrome_*, firefox_*, safari_*, ...).
const wreq = createClient({ browser: 'chrome_131' });

// Wrap so the client's call shape lines up with node-wreq's fetch.
const fetch: FetchLike = (url, init) => wreq.fetch(url, init);

const client = await new Client({ token, fetch }).init();

const query = process.argv[2] ?? 'daft punk';
const result = await client.search(query);
const best = result?.best?.result;
console.log(`best match for "${query}":`, best ? JSON.stringify(best).slice(0, 200) : 'none');
