import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { Client } from '../src/client.js';
import {
  BadGatewayError,
  ClientError,
  DeviceAuthError,
  ForbiddenError,
  GoneError,
  IdMissingError,
  InvalidResponseError,
  NetworkError,
  NotFoundError,
  ServerError,
  TimedOutError,
  UnauthorizedError,
  YandexMusicError,
  isRetryableStatus,
} from '../src/exceptions.js';
import { About } from '../src/models/account/account.js';
import { OAuthToken } from '../src/models/deviceAuth.js';
import { DIRECT_LINK_TTL_MS, DownloadInfo, LosslessDownloadInfo } from '../src/models/track/extras.js';
import { Track } from '../src/models/track/track.js';
import { Request } from '../src/request.js';
import type { FetchLike, ResponseLike } from '../src/request.js';
import { pathSegment } from '../src/utils/path.js';
import { clientWith, mockFetch } from './helpers/http.js';

const API = 'https://api.music.yandex.net';

const respond = (status: number, body: unknown): ResponseLike => ({
  status,
  arrayBuffer: async () => new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)).buffer as ArrayBuffer,
});

function countingRequest(status: number, opts: { retries?: number } = {}): { r: Request; count: () => number } {
  let n = 0;
  const f: FetchLike = async () => {
    n += 1;
    return respond(status, { error: { name: 'e', message: 'm' } });
  };
  return { r: new Request({ fetch: f, retryBaseMs: 1, retryMaxMs: 1, retries: opts.retries ?? 2 }), count: () => n };
}

describe('M1: status-based retry policy and error.retryable', () => {
  test.each([405, 410, 422, 451])('%i is a final ClientError, sent once', async (status) => {
    const { r, count } = countingRequest(status);
    const err = await r.get(`${API}/x`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ClientError);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err).toMatchObject({ status, retryable: false });
    expect(count()).toBe(1);
  });

  test.each([408, 425, 500, 503])('%i is retryable and retried', async (status) => {
    const { r, count } = countingRequest(status);
    const err = await r.get(`${API}/x`).catch((e: unknown) => e);
    expect((err as YandexMusicError).retryable).toBe(true);
    expect(count()).toBe(3);
  });

  test('410 maps to GoneError; deterministic subclasses are ClientErrors', async () => {
    const { r } = countingRequest(410);
    await expect(r.get(`${API}/x`)).rejects.toBeInstanceOf(GoneError);
    expect(new NotFoundError('x')).toBeInstanceOf(ClientError);
    expect(new NotFoundError('x').retryable).toBe(false);
    expect(new NetworkError('reset').retryable).toBe(true);
    expect(new TimedOutError().retryable).toBe(true);
    expect(new YandexMusicError('x').retryable).toBe(false);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
  });

  test('a transport failure is retryable and retried', async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n += 1;
      throw new TypeError('fetch failed');
    };
    const err = await new Request({ fetch: f, retryBaseMs: 1, retryMaxMs: 1 }).get(`${API}/x`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).retryable).toBe(true);
    expect(n).toBe(3);
  });
});

describe('M3 / M17: 403 and 502 classes', () => {
  test('403 is a ForbiddenError, still an UnauthorizedError; 401 is not Forbidden', async () => {
    const forbidden = await countingRequest(403).r.get(`${API}/x`).catch((e: unknown) => e);
    expect(forbidden).toBeInstanceOf(ForbiddenError);
    expect(forbidden).toBeInstanceOf(UnauthorizedError);
    const unauthorized = await countingRequest(401).r.get(`${API}/x`).catch((e: unknown) => e);
    expect(unauthorized).toBeInstanceOf(UnauthorizedError);
    expect(unauthorized).not.toBeInstanceOf(ForbiddenError);
  });

  test('502 is a BadGatewayError (ServerError) and retried', async () => {
    const { r, count } = countingRequest(502);
    const err = await r.get(`${API}/x`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadGatewayError);
    expect(err).toBeInstanceOf(ServerError);
    expect(count()).toBe(3);
  });
});

describe('M16: an error in a 2xx body', () => {
  test('a 200 with error and no result throws InvalidResponseError', async () => {
    const { client } = clientWith([{ match: '/x', body: { error: { name: 'session-expired', message: 'gone' } } }]);
    const err = await client.request.get(`${API}/x`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvalidResponseError);
    expect(err).toMatchObject({ code: 'session-expired' });
  });

  test('a 200 with result and an error key still returns the result', async () => {
    const { client } = clientWith([{ match: '/x', body: { result: 1, error: 'ignored' } }]);
    await expect(client.request.get(`${API}/x`)).resolves.toBe(1);
  });
});

describe('M6: body timeout is separate from the headers timeout', () => {
  test('a body that takes longer than timeout but less than bodyTimeout succeeds', async () => {
    const f: FetchLike = async () => ({
      status: 200,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((resolve) =>
          setTimeout(() => resolve(new TextEncoder().encode('{"result":7}').buffer as ArrayBuffer), 120),
        ),
    });
    const r = new Request({ fetch: f, timeout: 30, bodyTimeout: 2000, retries: 0 });
    await expect(r.get(`${API}/x`)).resolves.toBe(7);
  });
});

describe('M5: retrieve() uses the JSON timeout by default', () => {
  test('a stalled metadata fetch fails near the JSON timeout, not after minutes', async () => {
    const hang: FetchLike = (_u, init) =>
      new Promise((_r, reject) =>
        init.signal.addEventListener('abort', () => {
          const e = new Error('a');
          e.name = 'AbortError';
          reject(e);
        }),
      );
    const r = new Request({ fetch: hang, timeout: 40, retries: 0 });
    const started = Date.now();
    await expect(r.retrieve('https://storage.test/lyrics.txt')).rejects.toBeInstanceOf(TimedOutError);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

describe('M2 / M7: direct links', () => {
  const XML = '<download-info><host>cdn.test</host><path>/a/b.mp3</path><ts>0001</ts><region>-1</region><s>abc</s></download-info>';

  test('XML with attributes on tags parses; malformed XML throws InvalidResponseError', async () => {
    const { client } = clientWith([
      { match: '/ok', body: XML.replace('<host>', '<host type="x">') },
      { match: '/bad', body: '<error>forbidden</error>' },
    ]);
    const ok = DownloadInfo.deJson({ downloadInfoUrl: `${API}/ok` }, client)!;
    await expect(ok.getDirectLink()).resolves.toMatch(/^https:\/\/cdn\.test\/get-mp3\/[0-9a-f]{32}\/0001\/a\/b\.mp3$/);
    const bad = DownloadInfo.deJson({ downloadInfoUrl: `${API}/bad` }, client)!;
    const err = await bad.getDirectLink().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvalidResponseError);
    expect((err as Error).message).toContain('forbidden');
  });

  test('download re-resolves an expired link, and once more after a 410', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-m2-'));
    let infoCalls = 0;
    let cdnCalls = 0;
    const f: FetchLike = async (url) => {
      if (url.includes('/info')) {
        infoCalls += 1;
        return respond(200, XML);
      }
      cdnCalls += 1;
      return cdnCalls === 1 ? respond(410, 'expired') : respond(200, 'AUDIO');
    };
    const client = new Client({ fetch: f, token: 't' });
    const info = DownloadInfo.deJson({ downloadInfoUrl: `${API}/info` }, client)!;
    await info.getDirectLink();
    expect(info.directLinkExpired).toBe(false);
    await info.download(join(dir, 'a.mp3'));
    expect(infoCalls).toBe(2);
    expect(cdnCalls).toBe(2);
    info.directLinkResolvedAt = Date.now() - DIRECT_LINK_TTL_MS - 1;
    expect(info.directLinkExpired).toBe(true);
    await info.downloadBytes();
    expect(infoCalls).toBe(3);
  });
});

describe('M8: everything thrown is a YandexMusicError; local failures are final', () => {
  test('model helpers throw typed errors', () => {
    expect(() => new Track().trackId()).toThrow(IdMissingError);
    expect(() => LosslessDownloadInfo.deJson({}, undefined)!.getDirectLink()).toThrow(InvalidResponseError);
    expect(() => (Track.deJson({ id: '1' }) as unknown as { requireClient(): unknown }).requireClient()).toThrow(
      YandexMusicError,
    );
  });

  test('a disk error is not a NetworkError and stops the mirror loop', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-m8-'));
    const { fetch, calls } = mockFetch([{ match: 'cdn', body: 'AUDIO' }]);
    const client = new Client({ fetch });
    const info = LosslessDownloadInfo.deJson({ urls: ['https://cdn1.test/a', 'https://cdn2.test/a'], transport: 'raw' }, client)!;
    const err = await info.download(join(dir, 'missing-dir', 'a.flac')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(YandexMusicError);
    expect(err).not.toBeInstanceOf(NetworkError);
    expect((err as YandexMusicError).retryable).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test('a bad encraw key is a final YandexMusicError, not a NetworkError', async () => {
    const { client } = clientWith([{ match: 'cdn', body: 'AUDIO' }]);
    const info = LosslessDownloadInfo.deJson({ urls: ['https://cdn.test/a'], key: 'abcd', transport: 'encraw' }, client)!;
    const err = await info.downloadBytes().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(YandexMusicError);
    expect(err).not.toBeInstanceOf(NetworkError);
  });

  test('raceToFile does not retry other mirrors after a local failure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-l4-'));
    writeFileSync(join(dir, 'keep'), '');
    const { fetch, calls } = mockFetch([{ match: 'cdn', body: 'AUDIO' }]);
    const r = new Request({ fetch });
    await expect(r.raceToFile(['https://cdn1.test/a', 'https://cdn2.test/a'], join(dir, 'nope', 'x'))).rejects.toBeInstanceOf(
      YandexMusicError,
    );
    expect(calls).toHaveLength(2);
    expect(readdirSync(dir)).toEqual(['keep']);
  });
});

describe('M12: onUnauthorized refreshes the token once, single flight', () => {
  test('a 401 calls the hook once for concurrent requests and repeats them with the new token', async () => {
    let hookCalls = 0;
    const seen: Array<string | undefined> = [];
    const f: FetchLike = async (_url, init) => {
      seen.push(init.headers['Authorization']);
      return init.headers['Authorization'] === 'OAuth new' ? respond(200, { result: 'ok' }) : respond(401, {});
    };
    const client = new Client({
      fetch: f,
      token: 'old',
      onUnauthorized: async () => {
        hookCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return 'new';
      },
    });
    const results = await Promise.all([client.request.get(`${API}/a`), client.request.get(`${API}/b`)]);
    expect(results).toEqual(['ok', 'ok']);
    expect(hookCalls).toBe(1);
    expect(client.token).toBe('new');
    expect(seen.filter((h) => h === 'OAuth new')).toHaveLength(2);
  });

  test('403 never triggers the hook; a hook returning undefined rethrows the 401', async () => {
    let hookCalls = 0;
    const { client } = clientWith(
      [
        { match: '/forbidden', status: 403, body: {} },
        { match: '/unauth', status: 401, body: {} },
      ],
      {
        onUnauthorized: () => {
          hookCalls += 1;
          return undefined;
        },
      },
    );
    await expect(client.request.get(`${API}/forbidden`)).rejects.toBeInstanceOf(ForbiddenError);
    expect(hookCalls).toBe(0);
    await expect(client.request.get(`${API}/unauth`)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(hookCalls).toBe(1);
  });
});

describe('M13: path parameters are encoded', () => {
  test('pathSegment encodes separators and dot segments, keeps : , @', () => {
    expect(pathSegment('1/../account?x#y')).toBe('1%2F..%2Faccount%3Fx%23y');
    expect(pathSegment('..')).toBe('%2E%2E');
    expect(pathSegment('123:456')).toBe('123:456');
    expect(pathSegment('a b,c@d')).toBe('a%20b,c@d');
    expect(pathSegment(42)).toBe('42');
  });

  test('an id with a slash cannot change the endpoint', async () => {
    const { client, calls } = clientWith([{ match: '/', body: { result: null } }]);
    await client.tracksSimilar('1/../../account/settings?');
    expect(calls[0]!.url).toBe(`${API}/tracks/1%2F..%2F..%2Faccount%2Fsettings%3F/similar`);
    await client.usersPlaylists(7, 'owner:x');
    expect(calls[1]!.url.startsWith(`${API}/users/owner:x/playlists/7`)).toBe(true);
  });
});

describe('M14: device-auth errors keep code, status and cause', () => {
  test('invalid_grant from refreshAccessToken surfaces as DeviceAuthError with code', async () => {
    const { client } = clientWith([{ match: '/token', status: 400, body: { error: 'invalid_grant', error_description: 'revoked' } }]);
    const err = await client.refreshAccessToken('rt').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceAuthError);
    expect(err).toMatchObject({ code: 'invalid_grant', status: 400 });
    expect((err as Error).cause).toBeInstanceOf(YandexMusicError);
  });

  test('a 401 invalid_client from the OAuth host is a DeviceAuthError', async () => {
    const { client } = clientWith([{ match: '/token', status: 401, body: { error: 'invalid_client' } }]);
    const err = await client.refreshAccessToken('rt').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DeviceAuthError);
    expect(err).toMatchObject({ code: 'invalid_client', status: 401 });
  });

  test('OAuthToken.expiresAt is derived from expires_in', () => {
    const before = Date.now();
    const token = OAuthToken.deJson({ access_token: 'a', expires_in: 3600 })!;
    expect(token.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(token.expiresAt).toBeLessThanOrEqual(Date.now() + 3_600_000);
  });
});

describe('M15: About region fields', () => {
  test('geoRegionIso and userSessionRegionIso are mapped', () => {
    const about = About.deJson({ hasPlus: true, geoRegionIso: 'RU', userSessionRegionIso: 'KZ' })!;
    expect(about.geoRegionIso).toBe('RU');
    expect(about.userSessionRegionIso).toBe('KZ');
  });
});
