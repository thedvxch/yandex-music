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
import { Client, Track, Search, Like, FileInfo, RotorSession, Feed, ArtistSkeleton, YnisonClient } from '../src/index.js';
import type { UnknownFieldsReport } from '../src/index.js';

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

  // Drift is reported, never asserted: a test fails only on thrown errors.
  const drift: UnknownFieldsReport[] = [];
  const driftClient = () =>
    new Client({ token, onUnknownField: (report) => void drift.push(report) });

  test('tracksFileInfo() returns lossless and hq download info', async () => {
    const client = driftClient();
    const lossless = await client.tracksFileInfo(2, { quality: 'lossless' });
    expect(lossless).toBeInstanceOf(FileInfo);
    expect(lossless?.downloadInfo?.links().length).toBeGreaterThan(0);
    const hq = await client.tracksFileInfo(2, { quality: 'hq' });
    expect(hq?.downloadInfo?.links().length).toBeGreaterThan(0);
  }, TIMEOUT);

  test('usersLikesArtistsWithTimestamps() returns likes', async () => {
    const client = await driftClient().init();
    const likes = await client.usersLikesArtistsWithTimestamps();
    expect(Array.isArray(likes)).toBe(true);
    for (const like of likes) expect(like).toBeInstanceOf(Like);
  }, TIMEOUT);

  test('rotorSessionNew() starts a session over POST', async () => {
    const client = driftClient();
    const session = await client.rotorSessionNew('user:onyourwave', { includeTracksInResponse: false });
    expect(session).toBeInstanceOf(RotorSession);
  }, TIMEOUT);

  test('feed() headlines are objects', async () => {
    const client = driftClient();
    const feed = await client.feed();
    expect(feed).toBeInstanceOf(Feed);
    for (const headline of feed?.headlines ?? []) {
      expect(typeof headline).toBe('object');
    }
  }, TIMEOUT);

  test('artistsSkeleton() works with the default skeleton id', async () => {
    const client = driftClient();
    const skeleton = await client.artistsSkeleton(36800);
    expect(skeleton).toBeInstanceOf(ArtistSkeleton);
  }, TIMEOUT);

  test('Ynison observer connects and receives the first state', async () => {
    const ynison = new YnisonClient({ token: token as string });
    try {
      // connect() resolves only when the session ends, so run it in the background.
      const session = ynison.connect();
      const state = await ynison.waitFirstState(10_000);
      expect(state).toBeDefined();
      ynison.disconnect();
      await session.catch(() => undefined);
    } finally {
      ynison.disconnect();
    }
  }, TIMEOUT);

  test('unknown-field drift summary', () => {
    for (const report of drift) {
      process.stderr.write(`[live] drift ${report.model}: ${report.fields.join(', ')}\n`);
    }
    expect(true).toBe(true);
  });
});
