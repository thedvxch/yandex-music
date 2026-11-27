/**
 * Regression tests for the findings of the overhaul review
 * (`.omc/research/review-overhaul.md`). Each test fails on the code before its fix.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Client, NetworkError, RealtimeClient, TimedOutError, UnauthorizedError, YandexMusicError } from '../src/index.js';
import { Request } from '../src/request.js';
import { LosslessDownloadInfo } from '../src/models/track/extras.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FetchLike, ResponseLike } from '../src/request.js';
import { FakeYnisonServer, UNAUTHORIZED_FRAME, sendFramesThenClose, sendFramesThenWait, stateFrame } from './helpers/fakeYnison.js';
import { clientWith, mockFetch } from './helpers/http.js';

function respond(status: number, body: unknown): ResponseLike {
  const bytes = new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body));
  return { status, arrayBuffer: async () => bytes.buffer as ArrayBuffer };
}

let server: FakeYnisonServer;

beforeEach(async () => {
  server = await FakeYnisonServer.start();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await server.close();
});

function realtime(extra: Record<string, unknown> = {}): RealtimeClient {
  return new RealtimeClient({
    token: 'secret-token',
    ynison: { ...server.ynisonOptions, connectTimeoutMs: 2000 },
    ...extra,
  });
}

describe('#1: a throwing token provider', () => {
  test('is handled like a connect failure: start() resolves, the client is not left running', async () => {
    const errors: Error[] = [];
    let closes = 0;
    const rt = realtime({
      token: () => {
        throw new Error('provider down');
      },
      reconnect: false,
    });
    rt.on('error', (e) => errors.push(e));
    rt.on('close', () => {
      closes += 1;
    });
    await expect(rt.start()).resolves.toBeUndefined();
    expect(rt.isRunning).toBe(false);
    expect(errors.map((e) => e.message)).toContain('provider down');
    expect(closes).toBe(1);
  });

  test('with reconnect on, a provider that recovers gets the session open', async () => {
    let calls = 0;
    const rt = realtime({
      token: () => {
        calls += 1;
        if (calls === 1) throw new Error('provider down');
        return 'tok';
      },
      reconnectMaxMs: 10,
    });
    rt.on('error', () => undefined);
    const opened = new Promise<void>((resolve) => rt.once('open', () => resolve()));
    const done = rt.start();
    await opened;
    expect(calls).toBe(2);
    rt.stop();
    await done;
  });
});

describe('#2: onUnauthorized that throws synchronously', () => {
  test('does not disable later refreshes', async () => {
    let hookCalls = 0;
    const f: FetchLike = async (_url, init) =>
      init.headers['Authorization'] === 'OAuth new' ? respond(200, { result: 1 }) : respond(401, {});
    const client = new Client({
      fetch: f,
      token: 'old',
      onUnauthorized: () => {
        hookCalls += 1;
        if (hookCalls === 1) throw new Error('sync failure');
        return 'new';
      },
    });
    await expect(client.request.get(`${client.baseUrl}/x`)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(client.request.get(`${client.baseUrl}/x`)).resolves.toBe(1);
    expect(hookCalls).toBe(2);
    expect(client.token).toBe('new');
  });
});

describe('#3: auth allowlist with a custom baseUrl', () => {
  test('api.music.yandex.net still gets Authorization; other hosts do not', async () => {
    const { client, calls } = clientWith([{ match: '/', body: 'ok' }], { baseUrl: 'https://proxy.example' });
    await client.request.retrieve('https://api.music.yandex.net/get-mp3/x');
    await client.request.retrieve('https://proxy.example/y');
    await client.request.retrieve('https://cdn.example/z');
    expect(calls.map((c) => c.headers['Authorization'])).toEqual(['OAuth tok', 'OAuth tok', undefined]);
  });
});

describe('#4: landingBlockSource with a relative uri', () => {
  test('is resolved against baseUrl before fetching', async () => {
    const { client, calls } = clientWith([{ match: '/', body: { result: { ok: true } } }]);
    await client.landingBlockSource('landing/block/chart');
    await client.landingBlockSource('https://api.music.yandex.net/landing/block/x');
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.music.yandex.net/landing/block/chart',
      'https://api.music.yandex.net/landing/block/x',
    ]);
  });
});

describe('#5: withOptions views share account state with the parent', () => {
  test('init() through a view sets me / accountUid on the parent; writes flow both ways', async () => {
    const { client } = clientWith([{ match: '/account/status', body: { result: { account: { uid: 42 } } } }]);
    const view = client.withOptions({ retries: 0 });
    await view.init();
    expect(client.accountUid).toBe(42);
    expect(client.me).toBe(view.me);
    view.device = 'dev-view';
    view.baseUrl = 'https://proxy.example';
    expect(client.device).toBe('dev-view');
    expect(client.baseUrl).toBe('https://proxy.example');
    client.accountUid = 7;
    expect(view.accountUid).toBe(7);
    expect(view.withOptions({}).accountUid).toBe(7);
    expect(Object.keys(view)).not.toContain('token');
  });
});

describe('#6: provider token plus onUnauthorized', () => {
  test('the refreshed token is used for the next connect even if the provider still returns the old one', async () => {
    server.stateScripts.push(sendFramesThenClose(UNAUTHORIZED_FRAME));
    server.stateScripts.push(sendFramesThenWait(stateFrame()));
    const rt = realtime({ token: () => 'old', onUnauthorized: async () => 'fresh' });
    rt.on('error', () => undefined);
    const opened = new Promise<void>((resolve) => rt.once('open', () => resolve()));
    const done = rt.start();
    await opened;
    const state = server.authorizations.filter((a) => a.path === '/state').map((a) => a.header);
    expect(state).toEqual(['OAuth old', 'OAuth fresh']);
    expect(rt.terminalError).toBeNull();
    rt.stop();
    await done;
  });
});

describe('#7: a superseded realtime loop', () => {
  test('does not emit close while the new loop runs; a plain stop() still emits it', async () => {
    const rt = realtime();
    let closes = 0;
    rt.on('close', () => {
      closes += 1;
    });
    const first = rt.start();
    await new Promise<void>((resolve) => rt.once('open', () => resolve()));
    rt.stop();
    const second = rt.start();
    await first;
    expect(closes).toBe(0);
    expect(rt.isRunning).toBe(true);
    rt.stop();
    await second;
    expect(closes).toBe(1);
  });
});

/** Headers arrive at once; the body never does (until the request is aborted). */
function stalledBodyFetch(count: { n: number }): FetchLike {
  return async (_url, init) => {
    count.n += 1;
    return {
      status: 200,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }),
    };
  };
}

describe('#8: a hard deadline for the whole request', () => {
  test('withOptions({ deadline }) caps the body read, not only the time to headers', async () => {
    const count = { n: 0 };
    const r = new Request({ fetch: stalledBodyFetch(count), bodyTimeout: 2000, retries: 0 });
    const started = Date.now();
    await expect(r.withOptions({ timeout: 50, deadline: 120 }).get('https://h/x')).rejects.toBeInstanceOf(TimedOutError);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('the deadline also bounds retries and backoff', async () => {
    const count = { n: 0 };
    const r = new Request({ fetch: stalledBodyFetch(count), bodyTimeout: 60, retries: 10, retryBaseMs: 1, retryMaxMs: 1 });
    const started = Date.now();
    await expect(r.send('GET', 'https://h/x', { timeout: 60, deadline: 150 })).rejects.toBeInstanceOf(TimedOutError);
    expect(Date.now() - started).toBeLessThan(500);
    expect(count.n).toBeLessThanOrEqual(3);
  });
});

/** Never answers until the request is aborted. */
function hangingFetch(count: { n: number }): FetchLike {
  return (_url, init) => {
    count.n += 1;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  };
}

describe('#9: sequential mirrors share one deadline', () => {
  const urls = ['https://cdn1.test/a', 'https://cdn2.test/a', 'https://cdn3.test/a'];

  test('downloadBytes: timeout caps the whole mirror loop', async () => {
    const count = { n: 0 };
    const client = new Client({ fetch: hangingFetch(count), retries: 0 });
    const info = LosslessDownloadInfo.deJson({ urls, transport: 'raw' }, client)!;
    const started = Date.now();
    await expect(info.downloadBytes({ timeout: 150 })).rejects.toBeInstanceOf(TimedOutError);
    expect(Date.now() - started).toBeLessThan(400);
  });

  test('download: timeout caps the whole mirror loop', async () => {
    const count = { n: 0 };
    const client = new Client({ fetch: hangingFetch(count) });
    const info = LosslessDownloadInfo.deJson({ urls, transport: 'raw' }, client)!;
    const file = join(mkdtempSync(join(tmpdir(), 'ym-9-')), 'a.flac');
    const started = Date.now();
    await expect(info.download(file, { timeout: 150 })).rejects.toBeInstanceOf(TimedOutError);
    expect(Date.now() - started).toBeLessThan(400);
  });
});

describe('#10: setClient and a caller-set Authorization header', () => {
  test('a token-less client keeps the Authorization configured on a fresh Request', async () => {
    const { fetch, calls } = mockFetch([{ match: '/', body: { result: 1 } }]);
    const client = new Client({ request: new Request({ fetch, headers: { Authorization: 'OAuth caller' } }) });
    await client.request.get(`${client.baseUrl}/x`);
    expect(calls[0]!.headers['Authorization']).toBe('OAuth caller');
  });
});

describe('#11: 401 with an explicit per-call Authorization', () => {
  test('does not run onUnauthorized or rotate client.token', async () => {
    let hookCalls = 0;
    const { client, calls } = clientWith([{ match: '/', status: 401, body: {} }], {
      onUnauthorized: () => {
        hookCalls += 1;
        return 'rotated';
      },
    });
    await expect(
      client.request.send('GET', `${client.baseUrl}/x`, { headers: { Authorization: 'OAuth other' } }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(hookCalls).toBe(0);
    expect(client.token).toBe('tok');
    expect(calls).toHaveLength(1);
  });
});

describe('#12: errno codes thrown by a custom fetch', () => {
  function failingFetch(code: string, count: { n: number }): FetchLike {
    return async () => {
      count.n += 1;
      if (count.n === 1) throw Object.assign(new Error(`connect ${code}`), { code, syscall: 'connect' });
      return respond(200, { result: 1 });
    };
  }

  test.each(['EMFILE', 'ENFILE'])('%s is transient: retried as a NetworkError', async (code) => {
    const count = { n: 0 };
    const r = new Request({ fetch: failingFetch(code, count), retryBaseMs: 1, retryMaxMs: 1 });
    await expect(r.get('https://h/x')).resolves.toBe(1);
    expect(count.n).toBe(2);
    await expect(new Request({ fetch: failingFetch(code, { n: 0 }), retries: 0 }).get('https://h/x')).rejects.toBeInstanceOf(NetworkError);
  });

  test.each(['EACCES', 'EPERM'])('%s stays final (not retried)', async (code) => {
    const count = { n: 0 };
    const r = new Request({ fetch: failingFetch(code, count), retryBaseMs: 1, retryMaxMs: 1 });
    const error = await r.get('https://h/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(YandexMusicError);
    expect((error as YandexMusicError).retryable).toBe(false);
    expect(count.n).toBe(1);
  });
});
