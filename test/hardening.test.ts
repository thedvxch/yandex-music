import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, test } from 'vitest';
import { Client } from '../src/client.js';
import { AbortedError, NotFoundError, TimedOutError } from '../src/exceptions.js';
import { Track } from '../src/models/track/track.js';
import { LosslessDownloadInfo } from '../src/models/track/extras.js';
import { Request } from '../src/request.js';
import type { FetchLike, ResponseLike } from '../src/request.js';
import { clientWith, mockFetch } from './helpers/http.js';

const bytesResponse = (status: number, text: string): ResponseLike => ({
  status,
  arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
});

/** A fetch that never answers on its own and rejects with an AbortError when its signal fires. */
const hangingFetch = (count: { n: number }): FetchLike => (_url, init) => {
  count.n += 1;
  return new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      reject(e);
    });
  });
};

describe('H1: models and the client do not leak the token', () => {
  test('JSON.stringify(track) works, and omits client and token', () => {
    const { client } = clientWith([], { token: 'SECRET-TOKEN' });
    const track = Track.deJson({ id: '1', title: 'Song', albums: [{ id: 2, title: 'A' }] }, client)!;
    const json = JSON.stringify(track);
    expect(JSON.parse(json)).toMatchObject({ id: '1', title: 'Song' });
    expect(json).not.toContain('SECRET-TOKEN');
    expect(json).not.toContain('client');
    expect(track.client).toBe(client);
    expect(Object.keys(track)).not.toContain('client');
    expect(structuredClone(track.toJSON())).toMatchObject({ id: '1' });
  });

  test('inspect() of a model, the client and the transport redacts the token', () => {
    const { client } = clientWith([], { token: 'SECRET-TOKEN' });
    const track = Track.deJson({ id: '1', title: 'Song' }, client)!;
    for (const value of [track, client, client.request]) {
      expect(inspect(value, { depth: 10 })).not.toContain('SECRET-TOKEN');
    }
    expect(JSON.stringify(client)).not.toContain('SECRET-TOKEN');
    expect(inspect(client)).toContain('[redacted]');
    expect(Object.keys(client)).not.toContain('token');
    expect(client.token).toBe('SECRET-TOKEN');
  });
});

describe('H2: auth headers only go to allowed origins', () => {
  test('the API origin gets Authorization and the client header; another host gets neither', async () => {
    const { client, calls } = clientWith([{ match: '/', body: { result: 1 } }], { token: 'SECRET' });
    await client.request.get(`${client.baseUrl}/account/status`);
    await client.request.retrieve('https://evil.example/x');
    expect(calls[0]!.headers['Authorization']).toBe('OAuth SECRET');
    expect(calls[0]!.headers['X-Yandex-Music-Client']).toBeDefined();
    expect(calls[1]!.headers['Authorization']).toBeUndefined();
    expect(calls[1]!.headers['X-Yandex-Music-Client']).toBeUndefined();
    expect(calls[1]!.headers['User-Agent']).toBeDefined();
  });

  test('a custom baseUrl and explicit authOrigins are allowed; the default API host is not implied', async () => {
    const { client, calls } = clientWith([{ match: '/', body: { result: 1 } }], {
      baseUrl: 'https://proxy.test/api',
      authOrigins: ['https://extra.test'],
    });
    await client.request.get('https://proxy.test/api/x');
    await client.request.get('https://extra.test/x');
    await client.request.get('https://api.music.yandex.net/x');
    expect(calls.map((c) => c.headers['Authorization'])).toEqual(['OAuth tok', 'OAuth tok', undefined]);
  });

  test('downloads (streamToFile) do not send the token to CDN mirrors', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-h2-'));
    const { fetch, calls } = mockFetch([{ match: 'cdn.test', body: 'audio' }]);
    const client = new Client({ fetch, token: 'SECRET' });
    await client.request.streamToFile('https://cdn.test/a', join(dir, 'a.bin'));
    expect(calls[0]!.headers['Authorization']).toBeUndefined();
  });

  test('a per-call header is honoured even for a foreign origin', async () => {
    const { fetch, calls } = mockFetch([{ match: '/', body: { result: 1 } }]);
    const r = new Request({ fetch });
    await r.get('https://other.test/x', undefined, undefined, { Authorization: 'explicit' });
    expect(calls[0]!.headers['Authorization']).toBe('explicit');
  });
});

describe('H5: downloads are atomic', () => {
  test('a failed download leaves an existing file untouched and no temp file behind', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-h5-'));
    const file = join(dir, 'track.mp3');
    writeFileSync(file, 'GOOD');
    const { fetch } = mockFetch([{ match: '/missing', status: 404, body: { error: 'nope' } }]);
    const r = new Request({ fetch });
    await expect(r.streamToFile('https://cdn.test/missing', file)).rejects.toBeInstanceOf(NotFoundError);
    expect(readFileSync(file, 'utf8')).toBe('GOOD');
    expect(readdirSync(dir)).toEqual(['track.mp3']);
  });

  test('raceToFile failure keeps the existing file; success replaces it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-h5-'));
    const file = join(dir, 'track.flac');
    writeFileSync(file, 'GOOD');
    const bad = mockFetch([{ match: '/', status: 404, body: {} }]);
    await expect(new Request({ fetch: bad.fetch }).raceToFile(['https://a.test/1', 'https://b.test/2'], file)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(readFileSync(file, 'utf8')).toBe('GOOD');
    const good = mockFetch([{ match: '/', body: 'NEW' }]);
    await new Request({ fetch: good.fetch }).raceToFile(['https://a.test/1', 'https://b.test/2'], file);
    expect(readFileSync(file, 'utf8')).toBe('NEW');
    expect(readdirSync(dir)).toEqual(['track.flac']);
  });
});

describe('H6: cancellation and per-call options', () => {
  test('an aborted signal cancels the in-flight request with AbortedError (not TimedOutError)', async () => {
    const count = { n: 0 };
    const r = new Request({ fetch: hangingFetch(count), timeout: 10_000 });
    const ctrl = new AbortController();
    const viaView = r.withOptions({ signal: ctrl.signal }).get('https://api.music.yandex.net/y');
    setTimeout(() => ctrl.abort(new Error('user')), 20);
    const err = await viaView.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AbortedError);
    expect(err).not.toBeInstanceOf(TimedOutError);
    expect((err as AbortedError).cause).toBeInstanceOf(Error);
  });

  test('an abort during the retry backoff stops immediately without another attempt', async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n += 1;
      return bytesResponse(500, '{}');
    };
    const r = new Request({ fetch: f, retries: 5, retryBaseMs: 5000, retryMaxMs: 5000 });
    const ctrl = new AbortController();
    const started = Date.now();
    const p = r.send('GET', 'https://api.music.yandex.net/x', { signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 30);
    await expect(p).rejects.toBeInstanceOf(AbortedError);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(n).toBe(1);
  });

  test('an already-aborted signal never calls fetch', async () => {
    const count = { n: 0 };
    const r = new Request({ fetch: hangingFetch(count) });
    await expect(r.send('GET', 'https://h/x', { signal: AbortSignal.abort() })).rejects.toBeInstanceOf(AbortedError);
    expect(count.n).toBe(0);
  });

  test('per-call retries and timeout override the transport defaults', async () => {
    const count = { n: 0 };
    const r = new Request({ fetch: hangingFetch(count), timeout: 10_000, retries: 3, retryBaseMs: 1, retryMaxMs: 1 });
    await expect(r.send('GET', 'https://h/x', { timeout: 20, retries: 1 })).rejects.toBeInstanceOf(TimedOutError);
    expect(count.n).toBe(2);
  });

  test('client.withOptions() shares token and state, scopes options, and models keep the view', async () => {
    const { fetch, calls } = mockFetch([
      { match: '/tracks', body: { result: [{ id: '1', title: 'x' }] } },
      { match: '/slow', status: 500, body: {} },
    ]);
    const client = new Client({ fetch, token: 'tok', retries: 3, retryBaseMs: 1, retryMaxMs: 1 });
    const view = client.withOptions({ retries: 0 });
    expect(view).toBeInstanceOf(Client);
    const [track] = await view.tracks(1);
    expect(track!.client).toBe(view);
    client.token = 'rotated';
    await view.request.get(`${client.baseUrl}/slow`).catch(() => undefined);
    const slow = calls.filter((c) => c.url.includes('/slow'));
    expect(slow).toHaveLength(1);
    expect(slow[0]!.headers['Authorization']).toBe('OAuth rotated');
    await client.request.get(`${client.baseUrl}/slow`).catch(() => undefined);
    expect(calls.filter((c) => c.url.includes('/slow'))).toHaveLength(5);
  });

  test('a download can be cancelled; the existing file survives', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ym-h6-'));
    const file = join(dir, 'a.flac');
    writeFileSync(file, 'GOOD');
    const count = { n: 0 };
    const client = new Client({ fetch: hangingFetch(count) });
    const info = LosslessDownloadInfo.deJson({ urls: ['https://cdn.test/1', 'https://cdn.test/2'], transport: 'raw' }, client)!;
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    await expect(info.download(file, { signal: ctrl.signal })).rejects.toBeInstanceOf(AbortedError);
    expect(count.n).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe('GOOD');
  });

  test('deviceAuth stops polling when its signal aborts', async () => {
    const { client, calls } = clientWith([
      { match: '/device/code', body: { device_code: 'dc', user_code: 'U', verification_url: 'v', interval: 5, expires_in: 300 } },
      { match: '/token', status: 400, body: { error: 'authorization_pending' } },
    ]);
    const ctrl = new AbortController();
    const started = Date.now();
    const p = client.deviceAuth(() => undefined, { signal: ctrl.signal });
    setTimeout(() => ctrl.abort(), 50);
    await expect(p).rejects.toBeInstanceOf(AbortedError);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(calls.filter((c) => c.url.endsWith('/token'))).toHaveLength(1);
  });
});
