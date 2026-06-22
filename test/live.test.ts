/**
 * Live integration tests — exercised against the real Yandex Music API.
 *
 * Gated on YM_TOKEN: without it every case is reported as `skipped` (visible in
 * the run summary) instead of failing, so `npm test` stays green on machines
 * with no credentials. With it set, the suite actually hits the API.
 *
 *   YM_TOKEN=... npm test
 */
import { describe, test, expect } from 'vitest';
import { Client, Track, Search } from '../src/index.js';

const token = process.env.YM_TOKEN;

if (!token) {
  // Direct write: vitest captures console.* and drops it for fully-skipped
  // files, so go straight to stderr to keep the notice visible.
  process.stderr.write('[live] YM_TOKEN not set — skipping live API tests (set it to run them).\n');
}

// runIf: the block runs only when a token is present, otherwise it is skipped.
describe.runIf(token)('live API', () => {
  // Live network: give each call far more than vitest's 5s default.
  const TIMEOUT = 20_000;

  test('init() loads the account', async () => {
    const client = await new Client({ token }).init();
    expect(client.me).toBeDefined();
    expect(typeof client.accountUid).toBe('number');
  }, TIMEOUT);

  test('tracks() returns a real track', async () => {
    const client = new Client({ token });
    const [track] = await client.tracks(2);
    expect(track).toBeInstanceOf(Track);
    expect(track?.title).toBeTruthy();
    expect(track?.artists?.length).toBeGreaterThan(0);
  }, TIMEOUT);

  test('search() finds a known artist', async () => {
    const client = new Client({ token });
    const result = await client.search('daft punk');
    expect(result).toBeInstanceOf(Search);
    expect(result?.best?.result).toBeTruthy();
  }, TIMEOUT);
});
