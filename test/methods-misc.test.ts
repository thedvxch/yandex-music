import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceAuthError } from '../src/exceptions.js';
import { Client } from '../src/client.js';
import { clientWith } from './helpers/http.js';

const CODE = { device_code: 'dc', user_code: 'uc', verification_url: 'https://ya.ru/d', expires_in: 300, interval: 5 };
const TOKEN = { access_token: 'AT', refresh_token: 'RT', token_type: 'bearer', expires_in: 100 };

const tokenCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.endsWith('/token'));

describe('device flow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('OAuth requests carry no music Authorization / client headers', async () => {
    const { client, calls } = clientWith([
      { method: 'POST', match: '/device/code', body: CODE },
      { method: 'POST', match: '/token', body: TOKEN },
    ]);
    await client.requestDeviceCode('dev', 'name');
    await client.pollDeviceToken('dc');
    await client.refreshAccessToken('RT');
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      const names = Object.keys(call.headers).map((h) => h.toLowerCase());
      expect(names).not.toContain('authorization');
      expect(names).not.toContain('x-yandex-music-client');
      expect(call.url.startsWith('https://oauth.yandex.ru/')).toBe(true);
    }
    expect(calls[0]!.body).toContain('client_id=');
    expect(calls[1]!.body).toContain('grant_type=device_code');
  });

  it('lowercase user-supplied Authorization / client headers are removed from OAuth requests too', async () => {
    const { client, calls } = clientWith(
      [{ method: 'POST', match: '/device/code', body: CODE }],
      { headers: { authorization: 'OAuth leaked', 'x-yandex-music-client': 'leaked', 'X-Other': 'kept' } },
    );
    await client.requestDeviceCode('dev', 'name');
    const names = Object.keys(calls[0]!.headers).map((h) => h.toLowerCase());
    expect(names).not.toContain('authorization');
    expect(names).not.toContain('x-yandex-music-client');
    expect(calls[0]!.headers['X-Other']).toBe('kept');
  });

  it('pollDeviceToken returns null for authorization_pending and slow_down', async () => {
    const pending = clientWith([{ match: '/token', status: 400, body: { error: 'authorization_pending' } }]);
    expect(await pending.client.pollDeviceToken('dc')).toBeNull();
    const slow = clientWith([{ match: '/token', status: 400, body: { error: 'slow_down' } }]);
    expect(await slow.client.pollDeviceToken('dc')).toBeNull();
  });

  it('pollDeviceToken throws DeviceAuthError on other OAuth errors', async () => {
    const { client } = clientWith([{ match: '/token', status: 400, body: { error: 'access_denied' } }]);
    await expect(client.pollDeviceToken('dc')).rejects.toBeInstanceOf(DeviceAuthError);
  });

  it('waits 5 s, then 10 s after slow_down, then returns the token', async () => {
    vi.useFakeTimers();
    let n = 0;
    const responses = [
      { status: 400, body: { error: 'authorization_pending' } },
      { status: 400, body: { error: 'slow_down' } },
      { status: 200, body: TOKEN },
    ];
    const seen: number[] = [];
    const c = new Client({
      token: 'tok',
      fetch: async (url) => {
        seen.push(Date.now());
        const r = url.endsWith('/device/code') ? { status: 200, body: CODE } : responses[n++]!;
        const text = JSON.stringify(r.body);
        return { status: r.status, arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer };
      },
    });
    const promise = c.deviceAuth(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(n).toBe(1);
    await vi.advanceTimersByTimeAsync(1); // 5 s: second poll -> slow_down
    expect(n).toBe(2);
    await vi.advanceTimersByTimeAsync(9999);
    expect(n).toBe(2);
    await vi.advanceTimersByTimeAsync(1); // 10 s later: third poll
    const token = await promise;
    expect(token.accessToken).toBe('AT');
    expect(n).toBe(3);
    expect(seen[3]! - seen[2]!).toBe(10000);
    expect(seen[2]! - seen[1]!).toBe(5000);
  });

  it('throws expired at the deadline without an extra sleep', async () => {
    vi.useFakeTimers();
    const { client, calls } = clientWith([
      { match: '/device/code', body: { ...CODE, expires_in: 12, interval: 5 } },
      { match: '/token', status: 400, body: { error: 'authorization_pending' } },
    ]);
    const start = Date.now();
    const promise = client.deviceAuth(() => undefined);
    const assertion = expect(promise).rejects.toBeInstanceOf(DeviceAuthError);
    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
    // polls at t=0, 5, 10; the next (t=15) is past the 12 s deadline -> no sleep
    expect(tokenCalls(calls)).toHaveLength(3);
    expect(Date.now() - start).toBe(60000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honours shouldCancel', async () => {
    const { client } = clientWith([{ match: '/device/code', body: CODE }]);
    await expect(client.deviceAuth(() => undefined, { shouldCancel: () => true })).rejects.toThrow(/cancelled/);
  });
});

describe('queue and misc requests', () => {
  it('queueUpdatePosition posts currentIndex in the query and isInteractive in the form body', async () => {
    const { client, calls } = clientWith([{ match: '/queues/q1/update-position', body: { status: 'ok' } }]);
    expect(await client.queueUpdatePosition('q1', 3)).toBe(true);
    const call = calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.url).toContain('/queues/q1/update-position?currentIndex=3');
    expect(call.body).toBe('isInteractive=false');
    expect(call.headers['X-Yandex-Music-Device']).toContain('os=TypeScript');
  });

  it('queue methods use the explicit device or fall back to the client device', async () => {
    const { client, calls } = clientWith([{ match: '/queues', body: { queues: [] } }]);
    await client.queuesList('custom');
    await client.queuesList('');
    expect(calls[0]!.headers['X-Yandex-Music-Device']).toBe('custom');
    expect(calls[1]!.headers['X-Yandex-Music-Device']).toBe(client.device);
  });

  it('credits and disclaimers GET the expected endpoints', async () => {
    const { client, calls } = clientWith([{ match: '/', body: {} }]);
    await client.tracksCredits(5);
    await client.clipsCredits(6);
    await client.tracksDisclaimer(7);
    await client.albumsDisclaimer(8);
    await client.clipsDisclaimer(9);
    await client.artistsDisclaimer(10);
    expect(calls.map((c) => c.url.replace(/^https:\/\/[^/]+/, ''))).toEqual([
      '/tracks/5/credits',
      '/clips/6/credits',
      '/tracks/7/disclaimer',
      '/albums/8/disclaimer',
      '/clips/9/disclaimer',
      '/artists/10/disclaimer',
    ]);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('queueCreate posts the JSON body with the device header and returns the id', async () => {
    const { client, calls } = clientWith([{ method: 'POST', match: '/queues', body: { result: { id: 'q1' } } }]);
    const queue = { context: { type: 'various', id: 'x' }, tracks: [{ trackId: '1', albumId: '2' }], currentIndex: 0 };
    expect(await client.queueCreate(queue, 'dev-1')).toBe('q1');
    expect(await client.queueCreate(JSON.stringify(queue))).toBe('q1');
    expect(calls[0]!.url.endsWith('/queues')).toBe(true);
    expect(calls[0]!.headers['X-Yandex-Music-Device']).toBe('dev-1');
    expect(calls[0]!.headers['Content-Type']).toContain('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual(queue);
    expect(calls[1]!.headers['X-Yandex-Music-Device']).toBe(client.device);
    expect(JSON.parse(calls[1]!.body!)).toEqual(queue);
  });
});
