import { describe, expect, test, vi } from 'vitest';
import { Client } from '../src/client.js';
import {
  IdMissingError,
  NetworkError,
  ServerError,
  TimedOutError,
  TooManyRequestsError,
  YandexMusicError,
} from '../src/exceptions.js';
import { Request } from '../src/request.js';
import type { FetchLike, ResponseLike } from '../src/request.js';
import { clientWith, mockFetch } from './helpers/http.js';

const respond = (status: number, body: unknown, headers?: Record<string, string>): ResponseLike => ({
  status,
  arrayBuffer: async () => new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body)).buffer as ArrayBuffer,
  ...(headers ? { headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } } : {}),
});

describe('token accessor', () => {
  test('setting the token updates the Authorization header; clearing removes it', async () => {
    const { client, calls } = clientWith([{ match: '/x', body: { result: 1 } }]);
    await client.request.get('http://h/x');
    expect(calls[0]!.headers['Authorization']).toBe('OAuth tok');
    client.token = 'b';
    await client.request.get('http://h/x');
    expect(calls[1]!.headers['Authorization']).toBe('OAuth b');
    client.token = undefined;
    await client.request.get('http://h/x');
    expect(calls[2]!.headers['Authorization']).toBeUndefined();
    expect(client.token).toBeUndefined();
  });
});

describe('timeout option', () => {
  test('a fetch that never resolves yields TimedOutError near the timeout', async () => {
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
    const client = new Client({ fetch: hang, timeout: 50, retries: 0 });
    const started = Date.now();
    await expect(client.request.get('http://h/x')).rejects.toBeInstanceOf(TimedOutError);
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

describe('Retry-After and status mapping', () => {
  test('429 with Retry-After: 1 is retried after the delay, then succeeds', async () => {
    let n = 0;
    const f: FetchLike = async () => (n++ === 0 ? respond(429, {}, { 'retry-after': '1' }) : respond(200, { result: 'ok' }));
    const r = new Request({ fetch: f, retryMaxMs: 5000 });
    const started = Date.now();
    await expect(r.get('http://h/x')).resolves.toBe('ok');
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(n).toBe(2);
  });

  test('429 with Retry-After above retryMaxMs is thrown immediately', async () => {
    const { fetch, calls } = mockFetch([{ match: '/x', status: 429, body: {}, headers: { 'Retry-After': '999' } }]);
    const r = new Request({ fetch });
    const err = await r.get('http://h/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TooManyRequestsError);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as TooManyRequestsError).status).toBe(429);
    expect((err as TooManyRequestsError).retryAfterMs).toBe(999_000);
    expect(calls).toHaveLength(1);
  });

  test('Retry-After accepts an HTTP date', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
      const { fetch } = mockFetch([
        { match: '/x', status: 429, body: {}, headers: { 'Retry-After': 'Tue, 01 Jan 2030 00:00:10 GMT' } },
      ]);
      const err = await new Request({ fetch, retries: 0 }).get('http://h/x').catch((e: unknown) => e);
      expect((err as YandexMusicError).retryAfterMs).toBe(10_000);
    } finally {
      vi.useRealTimers();
    }
  });

  test('503 maps to ServerError, still a NetworkError, with status', async () => {
    const { fetch } = mockFetch([{ match: '/x', status: 503, body: {} }]);
    const err = await new Request({ fetch, retries: 0 }).get('http://h/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServerError);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as ServerError).status).toBe(503);
  });

  test('a 500 HTML body gives a message containing "HTTP 500:"', async () => {
    const { fetch } = mockFetch([{ match: '/x', status: 500, body: '<html>boom</html>' }]);
    const err = await new Request({ fetch, retries: 0 }).get('http://h/x').catch((e: unknown) => e);
    expect((err as Error).message).toContain('HTTP 500:');
    expect((err as Error).message).toContain('<html>boom</html>');
  });

  test('a 500 with an empty body gives "HTTP 500" without a doubled status', async () => {
    const { fetch } = mockFetch([{ match: '/x', status: 500, body: '' }]);
    const err = await new Request({ fetch, retries: 0 }).get('http://h/x').catch((e: unknown) => e);
    expect((err as Error).message).toBe('HTTP 500');
  });

  test('shims without headers.get still map 429 and 503', async () => {
    const body = (): Promise<ArrayBuffer> => Promise.resolve(new TextEncoder().encode('{}').buffer as ArrayBuffer);
    const shims: Array<[number, unknown]> = [
      [429, { 'Retry-After': '7' }],
      [429, undefined],
      [503, { 'retry-after': '3' }],
      [503, {}],
      [503, null],
    ];
    for (const [status, headers] of shims) {
      const fetch = (async () => ({ status, arrayBuffer: body, headers })) as unknown as FetchLike;
      const err = await new Request({ fetch, retries: 0 }).get('http://h/x').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(status === 429 ? TooManyRequestsError : ServerError);
      expect((err as YandexMusicError).status).toBe(status);
    }
    const plain = (async () => ({ status: 429, arrayBuffer: body, headers: { 'Retry-After': '7' } })) as unknown as FetchLike;
    const err = await new Request({ fetch: plain, retries: 0 }).get('http://h/x').catch((e: unknown) => e);
    expect((err as YandexMusicError).retryAfterMs).toBe(7000);
  });

  test('the error code comes from the OAuth error field', async () => {
    const { fetch } = mockFetch([{ match: '/x', status: 400, body: { error: 'slow_down' } }]);
    const err = await new Request({ fetch }).get('http://h/x').catch((e: unknown) => e);
    expect((err as YandexMusicError).code).toBe('slow_down');
    expect((err as YandexMusicError).status).toBe(400);
  });
});

describe('getList', () => {
  test('retries a POST once after a 503', async () => {
    let n = 0;
    const calls: string[] = [];
    const f: FetchLike = async (url, init) => {
      calls.push(`${init.method} ${url}`);
      return n++ === 0 ? respond(503, {}) : respond(200, { result: [] });
    };
    const { client } = { client: new Client({ fetch: f, retryBaseMs: 1, retryMaxMs: 2 }) };
    await client.tracks(['1']);
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.startsWith('POST '))).toBe(true);
  });
});

describe('send', () => {
  test('params and json together give a query string and a JSON body', async () => {
    const { client, calls } = clientWith([{ match: '/x', body: { result: { ok: true } } }]);
    const res = await client.request.send('POST', 'http://h/x', { params: { a: 1, b: 'q' }, json: { k: 'v' } });
    expect(res).toEqual({ ok: true });
    expect(calls[0]!.url).toBe('http://h/x?a=1&b=q');
    expect(calls[0]!.body).toBe('{"k":"v"}');
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
  });

  test('a header set to null is absent', async () => {
    const { client, calls } = clientWith([{ match: '/x', body: { result: 1 } }]);
    await client.request.send('GET', 'http://h/x', { headers: { 'X-Yandex-Music-Client': null, 'X-Extra': 'y' } });
    expect(calls[0]!.headers['X-Yandex-Music-Client']).toBeUndefined();
    expect(calls[0]!.headers['X-Extra']).toBe('y');
  });

  test('get/post accept a null header too', async () => {
    const { client, calls } = clientWith([{ match: '/x', body: { result: 1 } }]);
    await client.request.get('http://h/x', undefined, undefined, { 'X-Yandex-Music-Client': null });
    expect(calls[0]!.headers['X-Yandex-Music-Client']).toBeUndefined();
  });

  test('form bodies are url-encoded', async () => {
    const { client, calls } = clientWith([{ match: '/x', body: { result: 1 } }]);
    await client.request.send('POST', 'http://h/x', { form: { a: [1, 2] } });
    expect(calls[0]!.body).toBe('a=1&a=2');
    expect(calls[0]!.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  test('postJson drops undefined properties and supports query params', async () => {
    const { client, calls } = clientWith([{ match: '/x', body: { result: 1 } }]);
    await client.request.postJson('http://h/x', { a: 1, b: undefined, c: [undefined, { d: undefined, e: 2 }] }, undefined, {
      params: { q: 'z' },
    });
    expect(calls[0]!.body).toBe('{"a":1,"c":[null,{"e":2}]}');
    expect(calls[0]!.url).toBe('http://h/x?q=z');
  });
});

describe('resolveUid', () => {
  test('throws IdMissingError with no uid', () => {
    const { client } = clientWith([]);
    expect(() => client.resolveUid()).toThrow(IdMissingError);
  });

  test('returns the given id, else the account uid', () => {
    const { client } = clientWith([]);
    expect(client.resolveUid('5')).toBe('5');
    client.accountUid = 7;
    expect(client.resolveUid()).toBe(7);
  });
});
