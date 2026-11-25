import { Client } from '../../src/client.js';
import type { ClientOptions } from '../../src/client.js';
import type { FetchLike } from '../../src/request.js';

export interface MockRoute {
  /** HTTP method to match. Any method when omitted. */
  method?: string;
  /** Substring (string) or pattern (RegExp) matched against the full URL. */
  match: string | RegExp;
  status?: number;
  /** Response body. Non-strings are JSON-encoded. */
  body?: unknown;
  /** Response headers; when set, the response exposes `headers.get(name)`. */
  headers?: Record<string, string>;
}

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export function mockFetch(routes: MockRoute[]): { fetch: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: { ...init.headers }, body: init.body });
    const route = routes.find(
      (r) =>
        (r.method === undefined || r.method.toUpperCase() === init.method.toUpperCase()) &&
        (typeof r.match === 'string' ? url.includes(r.match) : r.match.test(url)),
    );
    const status = route ? (route.status ?? 200) : 404;
    const payload = route ? route.body : { error: { name: 'not-found', message: 'no mock route' } };
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const headers = route?.headers;
    const lower = headers
      ? Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
      : undefined;
    return {
      status,
      arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
      ...(lower ? { headers: { get: (name: string) => lower[name.toLowerCase()] ?? null } } : {}),
    };
  };
  return { fetch: fetchImpl, calls };
}

export function clientWith(
  routes: MockRoute[],
  opts: Partial<ClientOptions> = {},
): { client: Client; calls: RecordedCall[] } {
  const { fetch, calls } = mockFetch(routes);
  return { client: new Client({ fetch, token: 'tok', ...opts }), calls };
}
