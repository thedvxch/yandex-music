import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { clientWith, mockFetch } from './helpers/http.js';

const root = fileURLToPath(new URL('..', import.meta.url));

function exportNames(): string[] {
  const cfgPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')!;
  const cfg = ts.getParsedCommandLineOfConfigFile(
    cfgPath,
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  )!;
  const entry = `${root}src/index.ts`;
  const program = ts.createProgram([entry], cfg.options);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entry)!;
  return checker.getExportsOfModule(checker.getSymbolAtLocation(sf)!).map((s) => s.name);
}

describe('public API', () => {
  it('still exports every 0.3.0 name', () => {
    const baseline: string[] = JSON.parse(
      readFileSync(new URL('./fixtures/public-api-0.3.0.json', import.meta.url), 'utf8'),
    );
    const current = new Set(exportNames());
    expect(baseline.filter((n) => !current.has(n))).toEqual([]);
  }, 60_000);
});

describe('mockFetch helper', () => {
  it('records a GET and answers with the route body', async () => {
    const { fetch, calls } = mockFetch([{ match: '/ping', body: { result: 'pong' } }]);
    const res = await fetch('https://x.test/ping', { method: 'GET', headers: { a: 'b' }, signal: new AbortController().signal });
    expect(res.status).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(await res.arrayBuffer()))).toEqual({ result: 'pong' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ url: 'https://x.test/ping', method: 'GET' });
  });

  it('records a POST JSON body, 404s unmatched URLs and exposes headers', async () => {
    const { fetch, calls } = mockFetch([
      { method: 'POST', match: /\/post$/, status: 201, body: { ok: true }, headers: { 'Retry-After': '3' } },
    ]);
    const signal = new AbortController().signal;
    const ok = await fetch('https://x.test/post', { method: 'POST', headers: {}, body: '{"a":1}', signal });
    expect(ok.status).toBe(201);
    expect((ok as { headers?: { get(n: string): string | null } }).headers?.get('retry-after')).toBe('3');
    const missing = await fetch('https://x.test/other', { method: 'GET', headers: {}, signal });
    expect(missing.status).toBe(404);
    expect(calls.map((c) => c.url)).toEqual(['https://x.test/post', 'https://x.test/other']);
    expect(calls[0]?.body).toBe('{"a":1}');
  });

  it('clientWith builds a client with the injected fetch and a token', async () => {
    const { client, calls } = clientWith([{ match: '/status', body: { result: { account: { uid: 1 } } } }]);
    expect(client.token).toBe('tok');
    await client.request.get('https://api.test/status').catch(() => undefined);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.headers['Authorization']).toBe('OAuth tok');
  });
});
