import { describe, test, expect } from 'vitest';
import {
  Request,
  BadRequestError,
  NetworkError,
  NotFoundError,
  TimedOutError,
  UnauthorizedError,
  YandexMusicError,
  type FetchLike,
} from '../src/index.js';

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
