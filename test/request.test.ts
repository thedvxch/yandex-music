import { describe, test, expect } from 'vitest';
import { readFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv } from 'node:crypto';
import {
  Artist,
  Client,
  DEFAULT_DEVICE,
  USER_AGENT,
  Request,
  BadRequestError,
  DeviceAuthError,
  NetworkError,
  NotFoundError,
  TimedOutError,
  UnauthorizedError,
  YandexMusicError,
  type FetchLike,
} from '../src/index.js';

// A ResponseLike whose body is a real web ReadableStream emitting the given
// bytes (in one or more chunks), mirroring what global fetch returns.
function streamResponse(bytes: Uint8Array, status = 200, chunks = 1): {
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
  body: ReadableStream<Uint8Array>;
} {
  const size = Math.ceil(bytes.length / chunks);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.subarray(i, i + size));
      controller.close();
    },
  });
  return {
    status,
    body,
    arrayBuffer: async () => {
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      return copy.buffer;
    },
  };
}

// Build a Request whose fetch returns a canned body/status — or throws `fail`.
// No global mocking: the transport takes an injected fetch (the same seam used
// to plug in node-wreq), so each test gets its own isolated implementation.
function reqWith(body: string, status = 200): Request {
  const fetchImpl: FetchLike = async () => ({
    status,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  });
  return new Request({ fetch: fetchImpl });
}

function reqThrows(error: Error): Request {
  const fetchImpl: FetchLike = async () => {
    throw error;
  };
  return new Request({ fetch: fetchImpl });
}

describe('envelope unwrapping', () => {
  test('unwraps the { result } envelope', async () => {
    const r = reqWith(JSON.stringify({ result: { id: 1 }, invocationInfo: {} }));
    expect(await r.get('http://x')).toEqual({ id: 1 });
  });

  test('passes through a bare object that has no result key', async () => {
    const r = reqWith(JSON.stringify({ access_token: 'tok' }));
    expect(await r.get('http://x')).toEqual({ access_token: 'tok' });
  });

  test('preserves an explicit result: null', async () => {
    const r = reqWith(JSON.stringify({ result: null }));
    expect(await r.get('http://x')).toBeNull();
  });

  test('empty body unwraps to undefined', async () => {
    const r = reqWith('');
    expect(await r.get('http://x')).toBeUndefined();
  });

  test('invalid JSON raises YandexMusicError', async () => {
    const r = reqWith('not json');
    await expect(r.get('http://x')).rejects.toThrow(YandexMusicError);
  });
});

describe('status → error class mapping', () => {
  test('401 maps to UnauthorizedError with legacy error strings', async () => {
    const r = reqWith(JSON.stringify({ error: 'unauthorized', errorDescription: 'bad token' }), 401);
    await expect(r.get('http://x')).rejects.toThrow(
      expect.objectContaining({ name: 'UnauthorizedError', message: 'unauthorized bad token' }),
    );
  });

  test('403 also maps to UnauthorizedError', async () => {
    const r = reqWith('{}', 403);
    await expect(r.get('http://x')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('400 maps to BadRequestError using top-level { name, message }', async () => {
    const r = reqWith(JSON.stringify({ name: 'validation', message: 'bad param' }), 400);
    await expect(r.get('http://x')).rejects.toThrow(
      expect.objectContaining({ name: 'BadRequestError', message: 'validation: bad param' }),
    );
  });

  test('404 maps to NotFoundError, preferring a nested result error', async () => {
    const r = reqWith(JSON.stringify({ result: { name: 'not-found', message: 'gone' } }), 404);
    await expect(r.get('http://x')).rejects.toThrow(
      expect.objectContaining({ name: 'NotFoundError', message: 'not-found: gone' }),
    );
  });

  test('502 maps to NetworkError "Bad Gateway"', async () => {
    const r = reqWith('<html>bad gateway</html>', 502);
    await expect(r.get('http://x')).rejects.toThrow(
      expect.objectContaining({ name: 'NetworkError', message: 'Bad Gateway' }),
    );
  });

  test('unmapped status falls back to NetworkError with the code appended', async () => {
    const r = reqWith('{}', 500);
    await expect(r.get('http://x')).rejects.toThrow(/\(500\)$/);
    await expect(reqWith('{}', 500).get('http://x')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('transport failures', () => {
  test('an AbortError from fetch surfaces as TimedOutError', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    await expect(reqThrows(abort).get('http://x')).rejects.toBeInstanceOf(TimedOutError);
  });

  test('a generic fetch failure becomes NetworkError carrying the cause', async () => {
    const boom = new Error('connreset');
    await expect(reqThrows(boom).get('http://x')).rejects.toThrow(
      expect.objectContaining({ name: 'NetworkError', cause: boom }),
    );
  });

  // Regression: the body read (arrayBuffer) runs INSIDE the try, under the same
  // abort deadline as the fetch — a stalled body stream that aborts mid-read must
  // surface as TimedOutError, not hang and not degrade to NetworkError.
  test('an AbortError while reading the body surfaces as TimedOutError', async () => {
    const fetchImpl: FetchLike = async () => ({
      status: 200,
      arrayBuffer: async () => {
        const abort = new Error('aborted body');
        abort.name = 'AbortError';
        throw abort;
      },
    });
    await expect(new Request({ fetch: fetchImpl }).get('http://x')).rejects.toBeInstanceOf(TimedOutError);
  });

  // Regression: a body stream that never completes is cut off by the timeout
  // firing the abort signal, so retrieve() rejects with TimedOutError instead of
  // hanging forever (broken pipe with no TCP reset).
  test('a stalled body stream is aborted by the deadline on retrieve()', async () => {
    const fetchImpl: FetchLike = async (_url, init) => ({
      status: 200,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const abort = new Error('aborted body');
            abort.name = 'AbortError';
            reject(abort);
          });
        }),
    });
    const r = new Request({ fetch: fetchImpl, timeout: 20 });
    await expect(r.retrieve('http://x', 20)).rejects.toBeInstanceOf(TimedOutError);
  });
});

test('a custom fetch receives the signed headers and URL', async () => {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    return { status: 200, arrayBuffer: async () => new TextEncoder().encode('{"result":1}').buffer };
  };
  const r = new Request({ fetch: fetchImpl });
  r.setAuthorization('tok');
  await r.get('http://api/x', { a: 1, b: 2 });

  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe('http://api/x?a=1&b=2');
  expect(calls[0]!.headers['Authorization']).toBe('OAuth tok');
});

describe('Client option overrides', () => {
  // Capture the headers the transport actually sends.
  function capturing(): { calls: Record<string, string>[]; fetch: FetchLike } {
    const calls: Record<string, string>[] = [];
    const fetch: FetchLike = async (_url, init) => {
      calls.push(init.headers);
      return { status: 200, arrayBuffer: async () => new TextEncoder().encode('{"result":1}').buffer };
    };
    return { calls, fetch };
  }

  test('userAgent overrides the default User-Agent', async () => {
    const { calls, fetch } = capturing();
    const client = new Client({ token: 't', userAgent: 'my-app/1.0', fetch });
    await client.request.get('http://x');
    expect(calls[0]!['User-Agent']).toBe('my-app/1.0');
  });

  test('headers merge onto defaults; client header is overridable', async () => {
    const { calls, fetch } = capturing();
    const client = new Client({ headers: { 'X-Yandex-Music-Client': 'custom', 'X-Extra': 'y' }, fetch });
    await client.request.get('http://x');
    expect(calls[0]!['X-Yandex-Music-Client']).toBe('custom');
    expect(calls[0]!['X-Extra']).toBe('y');
  });

  test('User-Agent falls back to the library default when not set', async () => {
    const { calls, fetch } = capturing();
    await new Client({ fetch }).request.get('http://x');
    expect(calls[0]!['User-Agent']).toBe(USER_AGENT);
  });

  test('device defaults to DEFAULT_DEVICE and is overridable', () => {
    expect(new Client().device).toBe(DEFAULT_DEVICE);
    expect(new Client({ device: 'os=Foo; model=Bar' }).device).toBe('os=Foo; model=Bar');
  });

  test('a pre-built request takes precedence over userAgent/headers options', async () => {
    const { calls, fetch } = capturing();
    const request = new Request({ fetch, userAgent: 'transport/9' });
    // userAgent/headers on the Client are ignored when a request is supplied.
    const client = new Client({ request, userAgent: 'ignored/1', headers: { 'X-Extra': 'no' } });
    await client.request.get('http://x');
    expect(calls[0]!['User-Agent']).toBe('transport/9');
    expect(calls[0]!['X-Extra']).toBeUndefined();
  });
});

describe('refreshAccessToken (OAuth refresh grant)', () => {
  function capturingBody(body: string): { sent: { url: string; body: string }[]; fetch: FetchLike } {
    const sent: { url: string; body: string }[] = [];
    const fetch: FetchLike = async (url, init) => {
      sent.push({ url, body: String(init.body ?? '') });
      return { status: 200, arrayBuffer: async () => new TextEncoder().encode(body).buffer };
    };
    return { sent, fetch };
  }

  test('posts the refresh grant and parses the token', async () => {
    const { sent, fetch } = capturingBody(
      JSON.stringify({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 31_536_000 }),
    );
    const token = await new Client({ fetch }).refreshAccessToken('old-ref');
    expect(token.accessToken).toBe('new-acc');
    expect(token.refreshToken).toBe('new-ref');
    expect(token.expiresIn).toBe(31_536_000);
    expect(sent[0]!.url).toMatch(/oauth\.yandex\.ru\/token$/);
    expect(sent[0]!.body).toContain('grant_type=refresh_token');
    expect(sent[0]!.body).toContain('refresh_token=old-ref');
  });

  test('custom client credentials are forwarded', async () => {
    const { sent, fetch } = capturingBody(JSON.stringify({ access_token: 'a' }));
    await new Client({ fetch }).refreshAccessToken('r', 'my-id', 'my-secret');
    expect(sent[0]!.body).toContain('client_id=my-id');
    expect(sent[0]!.body).toContain('client_secret=my-secret');
  });

  test('a rejected grant surfaces as DeviceAuthError', async () => {
    const fetch: FetchLike = async () => ({
      status: 400,
      arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ error: 'invalid_grant' })).buffer,
    });
    await expect(new Client({ fetch }).refreshAccessToken('bad')).rejects.toThrow(DeviceAuthError);
  });
});

describe('likes return shapes', () => {
  test('usersLikesArtists returns full Artist[] (the endpoint sends bare artists, not Like wrappers)', async () => {
    const body = JSON.stringify({
      result: [
        { id: '1', name: 'Polly', cover: { type: 'pic', uri: 'x/%%' }, genres: ['rock'] },
        { id: '2', name: 'Other' },
      ],
    });
    const fetchImpl: FetchLike = async () => ({
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    });
    const client = new Client({ token: 't', fetch: fetchImpl });
    const artists = await client.usersLikesArtists(123);
    expect(artists).toHaveLength(2);
    expect(artists[0]).toBeInstanceOf(Artist);
    expect(artists[0]!.name).toBe('Polly');
    expect(artists[0]!.genres).toEqual(['rock']);
  });
});

describe('streaming downloads', () => {
  let dir: string;
  const file = () => join(dir, `out-${Math.random().toString(36).slice(2)}.bin`);

  test('streamToFile pipes a body stream to disk', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ym-stream-'));
    const payload = new TextEncoder().encode('hello streaming world'.repeat(100));
    const r = new Request({ fetch: async () => streamResponse(payload, 200, 4) });
    const path = file();
    await r.streamToFile(path, path);
    expect(new Uint8Array(await readFile(path))).toEqual(payload);
    await rm(dir, { recursive: true, force: true });
  });

  test('streamToFile applies a transform (AES-CTR decipher) on the fly', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ym-stream-'));
    const key = Buffer.alloc(16, 7);
    const iv = Buffer.alloc(16);
    const plain = new TextEncoder().encode('FLAC-ish payload '.repeat(500));
    const cipher = createCipheriv('aes-128-ctr', key, iv);
    const encrypted = new Uint8Array(Buffer.concat([cipher.update(plain), cipher.final()]));
    const r = new Request({ fetch: async () => streamResponse(encrypted, 200, 8) });
    const path = file();
    await r.streamToFile(path, path, { transform: () => createDecipheriv('aes-128-ctr', key, iv) });
    expect(new Uint8Array(await readFile(path))).toEqual(plain);
    await rm(dir, { recursive: true, force: true });
  });

  test('streamToFile falls back to buffering when no body stream is present', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ym-stream-'));
    const payload = new TextEncoder().encode('no-stream shim path');
    // ResponseLike without `body` → buffer-and-write fallback.
    const r = new Request({ fetch: async () => ({ status: 200, arrayBuffer: async () => payload.buffer }) });
    const path = file();
    await r.streamToFile(path, path);
    expect(new Uint8Array(await readFile(path))).toEqual(payload);
    await rm(dir, { recursive: true, force: true });
  });

  test('streamToFile maps a non-2xx status to a typed error', async () => {
    const r = new Request({ fetch: async () => streamResponse(new TextEncoder().encode('{}'), 404) });
    await expect(r.streamToFile('http://x', '/tmp/nope-xyz')).rejects.toBeInstanceOf(NotFoundError);
  });

  test('raceToFile commits to the first responding mirror', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ym-stream-'));
    const payload = new TextEncoder().encode('winning mirror payload '.repeat(50));
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('slow')) {
        await new Promise((res) => setTimeout(res, 50));
        return streamResponse(new TextEncoder().encode('SLOW'), 200);
      }
      return streamResponse(payload, 200, 3);
    };
    const r = new Request({ fetch: fetchImpl });
    const path = file();
    await r.raceToFile(['http://slow/a', 'http://fast/b'], path, {});
    expect(new Uint8Array(await readFile(path))).toEqual(payload);
    await rm(dir, { recursive: true, force: true });
  });

  test('raceToFile falls back to a working mirror when others fail to respond', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ym-stream-'));
    const payload = new TextEncoder().encode('fallback mirror payload');
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes('dead')) throw new Error('ECONNREFUSED');
      return streamResponse(payload, 200);
    };
    const r = new Request({ fetch: fetchImpl });
    const path = file();
    await r.raceToFile(['http://dead/a', 'http://live/b'], path, {});
    expect(new Uint8Array(await readFile(path))).toEqual(payload);
    await rm(dir, { recursive: true, force: true });
  });
});
