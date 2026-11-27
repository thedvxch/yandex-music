import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  RealtimeClient,
  YnisonClient,
  YnisonConnectionClosedError,
  YnisonDeviceDisplacedError,
  YnisonError,
  YnisonServerError,
  YnisonTimeoutError,
  YnisonUnauthorizedError,
  deviceIdFromToken,
  parseRedirectFrame,
  parseServerError,
} from '../src/index.js';
import {
  DISPLACED_FRAME,
  FakeYnisonServer,
  UNAUTHORIZED_FRAME,
  errorFrame,
  sendFramesThenClose,
  sendFramesThenWait,
  stateFrame,
  stayInSilence,
} from './helpers/fakeYnison.js';

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

function waitEvent<T = unknown[]>(rt: RealtimeClient, event: string): Promise<T> {
  return new Promise<T>((resolve) => {
    (rt as unknown as { once(e: string, l: (...a: unknown[]) => void): void }).once(event, (...args) =>
      resolve(args as T),
    );
  });
}

describe('handshake', () => {
  test('subprotocols carry the device info; the state one adds ticket and session', async () => {
    const rt = realtime({ deviceId: 'dev123' });
    server.stateScripts.push(sendFramesThenWait(stateFrame()));
    const open = waitEvent(rt, 'open');
    const run = rt.start();
    await open;
    rt.stop();
    await run;

    const decode = (header: string): Record<string, string> => {
      const parts = header.split(',').map((s) => s.trim());
      expect(parts.slice(0, 2)).toEqual(['Bearer', 'v2']);
      return JSON.parse(decodeURIComponent(parts[2]!)) as Record<string, string>;
    };
    const redirect = server.subprotocols.find((s) => s.path === '/redirect')!;
    const state = server.subprotocols.find((s) => s.path === '/state')!;
    const r = decode(redirect.header);
    expect(r['Ynison-Device-Id']).toBe('dev123');
    expect(r['Ynison-Redirect-Ticket']).toBeUndefined();
    const s = decode(state.header);
    expect(s['Ynison-Device-Id']).toBe('dev123');
    expect(s['Ynison-Redirect-Ticket']).toBe('fake-ticket');
    expect(s['Ynison-Session-Id']).toBe('123');
    expect(typeof s['Ynison-Session-Id']).toBe('string');
    expect(server.received[0]).toHaveProperty('updateFullState');
  });

  test('the first state frame reaches open and state', async () => {
    const rt = realtime();
    server.stateScripts.push(sendFramesThenWait(stateFrame('777')));
    const open = waitEvent(rt, 'open');
    const state = waitEvent<[{ playableList: Array<{ playableId: string }> }]>(rt, 'state');
    const run = rt.start();
    await open;
    const [s] = await state;
    expect(s.playableList[0]?.playableId).toBe('777');
    rt.stop();
    await run;
  });

  test('parseRedirectFrame reads keep_alive_params', () => {
    const r = parseRedirectFrame(server.redirectFrame());
    expect(r.keepAliveTimeSeconds).toBe(60);
    expect(r.keepAliveTimeoutSeconds).toBe(30);
    const bare = parseRedirectFrame(JSON.stringify({ host: 'h', redirect_ticket: 't', session_id: 1 }));
    expect(bare.keepAliveTimeSeconds).toBeUndefined();
  });
});

describe('error frames', () => {
  test('parseServerError classifies and parses details / extra_headers', () => {
    const u = parseServerError({
      grpc_code: 16,
      http_code: 401,
      message: 'no',
      extra_headers: { 'ynison-backoff-millis': '0:1000:5000' },
    });
    expect(u).toBeInstanceOf(YnisonUnauthorizedError);
    expect(u).toBeInstanceOf(YnisonServerError);
    expect(u).toBeInstanceOf(YnisonError);
    expect(u.grpcCode).toBe(16);
    expect(u.httpCode).toBe(401);
    expect(u.backoffMs).toEqual([0, 1000, 5000]);

    const forbidden = parseServerError({ http_code: 403, message: 'x' });
    expect(forbidden).toBeInstanceOf(YnisonUnauthorizedError);

    const d = parseServerError({
      details: { 'ynison-error-code': '400090001', 'ynison-go-away-for-seconds': '3600' },
      grpc_code: 9,
      http_code: 400,
      message: 'displaced',
    });
    expect(d).toBeInstanceOf(YnisonDeviceDisplacedError);
    expect(d.errorCode).toBe('400090001');
    expect(d.goAwaySeconds).toBe(3600);
    expect(d.retryAfterMs).toBe(3_600_000);

    const plain = parseServerError({ message: 'm', details: { 'ynison-backoff-millis': 'x:7' } });
    expect(plain.constructor).toBe(YnisonServerError);
    expect(plain.backoffMs).toEqual([7]);
  });

  test('grpc 16 is terminal: error, then close, no reconnect', async () => {
    const rt = realtime();
    server.stateScripts.push(sendFramesThenClose(UNAUTHORIZED_FRAME));
    const errors: Error[] = [];
    const reconnects: number[] = [];
    const order: string[] = [];
    rt.on('error', (e) => {
      errors.push(e);
      order.push('error');
    });
    rt.on('reconnect', (ms) => reconnects.push(ms));
    rt.on('close', () => order.push('close'));
    await rt.start();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(YnisonUnauthorizedError);
    expect(order).toEqual(['error', 'close']);
    expect(reconnects).toEqual([]);
    expect(server.stateCount).toBe(1);
    expect(rt.isRunning).toBe(false);
  });

  test('terminalError is set when nobody listens to error, passed to close, cleared by start()', async () => {
    const rt = realtime();
    server.stateScripts.push(sendFramesThenClose(UNAUTHORIZED_FRAME));
    expect(rt.terminalError).toBeNull();
    const closed = waitEvent<[Error | null]>(rt, 'close');
    await rt.start();
    expect(rt.terminalError).toBeInstanceOf(YnisonUnauthorizedError);
    expect((await closed)[0]).toBe(rt.terminalError);
    server.stateScripts.push(sendFramesThenWait(stateFrame()));
    const open = waitEvent(rt, 'open');
    const run = rt.start();
    await open;
    expect(rt.terminalError).toBeNull();
    rt.stop();
    await run;
  });

  test('code 400090001 is terminal (device displaced)', async () => {
    const rt = realtime();
    server.stateScripts.push(sendFramesThenClose(DISPLACED_FRAME));
    const errors: Error[] = [];
    rt.on('error', (e) => errors.push(e));
    await rt.start();
    expect(errors[0]).toBeInstanceOf(YnisonDeviceDisplacedError);
    expect(server.stateCount).toBe(1);
  });
});

describe('reconnect policy', () => {
  test('a go-away reconnects after the go-away, capped by goAwayMaxMs', async () => {
    const rt = realtime({ goAwayMaxMs: 120, reconnect: true });
    server.stateScripts.push(sendFramesThenClose(errorFrame(undefined, 1)));
    server.stateScripts.push(sendFramesThenWait(stateFrame()));
    const reconnects: number[] = [];
    rt.on('error', (e) => {
      expect((e as YnisonServerError).retryAfterMs).toBe(1000);
    });
    rt.on('reconnect', (ms) => reconnects.push(ms));
    const open = waitEvent(rt, 'open');
    const run = rt.start();
    await open;
    expect(reconnects).toEqual([120]);
    expect(server.stateCount).toBe(2);
    rt.stop();
    await run;
  });

  test('a session that dropped within stableSessionMs is retried after at least 1000 ms', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const rt = realtime();
    server.defaultStateScript = sendFramesThenClose(stateFrame());
    const reconnects: number[] = [];
    rt.on('reconnect', (ms) => {
      reconnects.push(ms);
      if (reconnects.length === 2) rt.stop();
    });
    await rt.start();
    expect(reconnects[0]).toBeGreaterThanOrEqual(1000);
    expect(reconnects[1]).toBeGreaterThanOrEqual(1000);
  });

  test('a stable session resets the attempt counter', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const rt = realtime({ stableSessionMs: 0 });
    server.defaultStateScript = sendFramesThenClose(stateFrame());
    const reconnects: number[] = [];
    rt.on('reconnect', (ms) => {
      reconnects.push(ms);
      if (reconnects.length === 3) rt.stop();
    });
    await rt.start();
    expect(reconnects).toEqual([0, 0, 0]);
  });

  test('a server backoff ladder replaces the default schedule', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const rt = realtime();
    server.defaultStateScript = sendFramesThenClose(errorFrame('5:6:7'));
    const reconnects: number[] = [];
    rt.on('reconnect', (ms) => {
      reconnects.push(ms);
      if (reconnects.length === 4) rt.stop();
    });
    await rt.start();
    expect(reconnects).toEqual([5, 6, 7, 7]);
  });

  test('the default schedule is 0, 1000, 5000, 30000 plus jitter, capped by reconnectMaxMs', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const rt = realtime({ reconnectMaxMs: 2000 });
    server.defaultStateScript = sendFramesThenClose(errorFrame());
    const reconnects: number[] = [];
    rt.on('reconnect', (ms) => {
      reconnects.push(ms);
      // do not wait for the long delays: stop after the second (1125 ms) one is announced
      if (reconnects.length === 2) rt.stop();
    });
    await rt.start();
    expect(reconnects).toEqual([125, 1125]);
  });

  test('stop() during a pending reconnect clears the timer and resolves start()', async () => {
    const rt = realtime({ reconnectBaseMs: 60_000, reconnectMaxMs: 60_000 });
    server.defaultStateScript = sendFramesThenClose(errorFrame());
    rt.on('reconnect', () => {
      // stop while the wait is pending (and once synchronously inside the event)
      setTimeout(() => rt.stop(), 30);
    });
    const closed = waitEvent(rt, 'close');
    const started = Date.now();
    await Promise.race([
      rt.start(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('start() did not resolve')), 1500)),
    ]);
    await closed;
    expect(Date.now() - started).toBeLessThan(1500);
    expect((rt as unknown as { reconnectTimer: unknown }).reconnectTimer).toBeNull();
    expect(rt.isRunning).toBe(false);
  });
});

describe('listener isolation and restart (H3, H4)', () => {
  test('throwing state / trackChange / playStateChange listeners cause no unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const rt = realtime();
      const errors: Error[] = [];
      rt.on('error', (e) => errors.push(e));
      rt.on('state', () => {
        throw new Error('state listener');
      });
      rt.on('playStateChange', () => {
        throw new Error('play listener');
      });
      rt.on('trackChange', () => {
        throw new Error('track listener');
      });
      const done = rt.start();
      await vi.waitFor(() => expect(errors.map((e) => e.message)).toContain('track listener'), { timeout: 2000 });
      rt.stop();
      await done;
      await new Promise((r) => setTimeout(r, 20));
      expect(errors.map((e) => e.message)).toEqual(expect.arrayContaining(['state listener', 'play listener']));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  test('stop() then start() back-to-back leaves exactly one live session loop', async () => {
    const rt = realtime();
    const first = rt.start();
    await waitEvent(rt, 'open');
    expect(server.stateCount).toBe(1);
    rt.stop();
    const second = rt.start();
    await waitEvent(rt, 'open');
    // the superseded loop must not reconnect (default first delay is 0..250 ms)
    await new Promise((r) => setTimeout(r, 600));
    expect(server.stateCount).toBe(2);
    expect(rt.isRunning).toBe(true);
    await first;
    expect(rt.isRunning).toBe(true);
    rt.stop();
    await second;
    expect(rt.isRunning).toBe(false);
  });
});

describe('YnisonClient robustness', () => {
  test('a server that accepts but never answers gives YnisonTimeoutError', async () => {
    server.stateScripts.push(stayInSilence);
    const client = new YnisonClient({ token: 't', ...server.ynisonOptions, connectTimeoutMs: 100 });
    await expect(client.connect()).rejects.toBeInstanceOf(YnisonTimeoutError);
    client.disconnect();
  });

  test('a missing pong closes the socket (keep-alive from the redirect frame)', async () => {
    await server.close();
    server = await FakeYnisonServer.start({ keepAlive: { time: 0.05, timeout: 0.05 }, autoPong: false });
    server.stateScripts.push(sendFramesThenWait(stateFrame()));
    const client = new YnisonClient({ token: 't', ...server.ynisonOptions, connectTimeoutMs: 2000 });
    await expect(client.connect()).rejects.toBeInstanceOf(YnisonConnectionClosedError);
    client.disconnect();
  });

  test('unparseable state frames are reported through onError', async () => {
    server.stateScripts.push(sendFramesThenClose('not json {', stateFrame('42')));
    const client = new YnisonClient({ token: 't', ...server.ynisonOptions, connectTimeoutMs: 2000 });
    const errors: Error[] = [];
    const states: string[] = [];
    client.onError((e) => errors.push(e));
    client.onState((s) => {
      states.push(s.playableList[0]?.playableId ?? '');
    });
    await client.connect();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(YnisonError);
    expect(states).toEqual(['42']);
  });
});

describe('deviceIdFromToken', () => {
  test('matches an independent sha256 prefix', () => {
    const expected = createHash('sha256').update('yandex-music-ynison:t').digest('hex').slice(0, 12);
    expect(deviceIdFromToken('t')).toBe(expected);
    expect(deviceIdFromToken('t')).toHaveLength(12);
    expect(deviceIdFromToken('u')).not.toBe(expected);
  });
});
