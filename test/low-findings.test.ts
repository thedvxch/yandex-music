import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { NetworkError } from '../src/exceptions.js';
import { DownloadInfo } from '../src/models/track/extras.js';
import { Request } from '../src/request.js';
import type { FetchLike } from '../src/request.js';
import { buildSetVolumeRequest } from '../src/ynison/messages.js';
import { clientWith } from './helpers/http.js';

describe('L1: retries are normalized', () => {
  test.each([-1, Number.NaN, Number.NEGATIVE_INFINITY])('retries %d sends one attempt and throws the real error', async (retries) => {
    let n = 0;
    const f: FetchLike = async () => {
      n += 1;
      throw new TypeError('fetch failed');
    };
    const r = new Request({ fetch: f, retries });
    expect(r.retries).toBe(0);
    await expect(r.get('https://h/x')).rejects.toBeInstanceOf(NetworkError);
    expect(n).toBe(1);
  });

  test('a fractional per-call retries value is floored', async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n += 1;
      throw new TypeError('fetch failed');
    };
    await expect(new Request({ fetch: f, retryBaseMs: 1, retryMaxMs: 1 }).send('GET', 'https://h/x', { retries: 1.9 })).rejects.toBeInstanceOf(
      NetworkError,
    );
    expect(n).toBe(2);
  });
});

describe('L2 / L3: transport header state', () => {
  test('setting client.language updates Accept-Language', async () => {
    const { client, calls } = clientWith([{ match: '/', body: { result: 1 } }]);
    client.language = 'en';
    await client.request.get(`${client.baseUrl}/x`);
    expect(calls[0]!.headers['Accept-Language']).toBe('en');
    expect(client.language).toBe('en');
  });

  test('attaching a token-less client to a reused Request clears the old Authorization', () => {
    const { client } = clientWith([], { token: 'first' });
    const { client: other } = clientWith([], { token: undefined, request: client.request });
    expect(other.request.headers['Authorization']).toBeUndefined();
  });
});

describe('L8: Ynison version ids', () => {
  test('random versions are decimal int64 strings with random low digits', () => {
    const versions = Array.from({ length: 50 }, () => {
      const req = buildSetVolumeRequest('dev', 'target', 0.5) as unknown as { updateVolumeInfo: { volumeInfo: { version: { version: string } } } };
      return req.updateVolumeInfo.volumeInfo.version.version;
    });
    for (const v of versions) {
      expect(v).toMatch(/^\d{1,18}$/);
      expect(BigInt(v) < 2n ** 63n).toBe(true);
    }
    expect(new Set(versions.map((v) => v.slice(-3))).size).toBeGreaterThan(1);
  });
});

describe('L10: eager direct links resolve in parallel', () => {
  test('deListAsync(getDirectLinks) resolves every link', async () => {
    const xml = '<download-info><host>cdn.test</host><path>/p</path><ts>1</ts><s>s</s></download-info>';
    const { client, calls } = clientWith([{ match: '/info', body: xml }]);
    const infos = await DownloadInfo.deListAsync(
      [{ downloadInfoUrl: `${client.baseUrl}/info/1` }, { downloadInfoUrl: `${client.baseUrl}/info/2` }],
      client,
      true,
    );
    expect(infos.every((i) => i.directLink?.startsWith('https://cdn.test/'))).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('L11: package exports', () => {
  test('exports carry a default condition and ./package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports['./package.json']).toBe('./package.json');
    expect((pkg.exports['.'] as Record<string, string>)['default']).toBe('./dist/index.mjs');
  });
});
