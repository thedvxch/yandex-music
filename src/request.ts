/**
 * HTTP transport used by the client.
 *
 * Wraps the global `fetch` with the headers, response-envelope unwrapping and
 * error mapping expected by the Yandex Music API. The API wraps successful
 * payloads in a `{ "result": ... }` envelope and reports failures through HTTP
 * status codes plus an `error`/`errorDescription` body; this module hides both
 * so callers receive the unwrapped result or a typed exception.
 *
 * @packageDocumentation
 */
import { randomUUID } from 'node:crypto';
import { writeFile, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Transform } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import {
  AbortedError,
  BadRequestError,
  ConflictError,
  NetworkError,
  NotFoundError,
  PayloadTooLargeError,
  ServerError,
  TimedOutError,
  TooManyRequestsError,
  UnauthorizedError,
  YandexMusicError,
} from './exceptions.js';
import { isJsonObject } from './base.js';
import type { Client } from './client.js';
import type { JSONValue } from './types.js';

/** `User-Agent` sent with every request. */
export const USER_AGENT = 'dvxch-yandex-music';

/** Default per-request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Default timeout for raw downloads ({@link Request.retrieve} / {@link Request.download}).
 * Audio files (especially lossless) far outlast the JSON timeout, so they get a
 * much larger budget.
 */
export const DEFAULT_DOWNLOAD_TIMEOUT_MS = 300_000;

/**
 * Default idle timeout for streaming downloads: abort when no bytes are written
 * for this long, catching a stalled connection well before the overall
 * {@link DEFAULT_DOWNLOAD_TIMEOUT_MS} deadline.
 */
export const DEFAULT_DOWNLOAD_IDLE_MS = 60_000;

/** Headers sent with every request unless overridden. */
export const BASE_HEADERS: Readonly<Record<string, string>> = {
  'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
};

/** A primitive that can be serialized into a query string or form body. */
export type ParamValue = string | number | boolean | null | undefined;

/** Query string / form parameters. Array values are repeated per key. */
export type Params = Record<string, ParamValue | ParamValue[]>;

/** The minimal slice of a `fetch` Response the transport reads. */
export interface ResponseLike {
  /** HTTP status code. */
  status: number;
  /** The response body as bytes. */
  arrayBuffer(): Promise<ArrayBuffer>;
  /**
   * The response body as a stream, when the fetch implementation exposes one
   * (the global `fetch` does). Enables streaming downloads straight to disk; on
   * minimal fetch shims that omit it, downloads transparently fall back to
   * buffering via {@link ResponseLike.arrayBuffer}.
   */
  body?: ReadableStream<Uint8Array> | null;
  /** Response headers, when the fetch implementation exposes them (the global `fetch` does). */
  headers?: { get(name: string): string | null } | Record<string, string | undefined>;
}

/** A JSON request body: {@link JSONValue} whose object properties may be `undefined` (dropped on serialization). */
export type JsonInput = JSONValue | undefined | { [k: string]: JsonInput } | JsonInput[];

/** Origin of the default API host; receives the `Authorization` header even without a client. */
export const DEFAULT_API_ORIGIN = 'https://api.music.yandex.net';

/**
 * Per-call transport options. Pass them to {@link Request.send} (and the other
 * verb helpers), or scope them to a whole client view with
 * {@link ClientBase.withOptions} / {@link Request.withOptions}.
 */
export interface RequestOptions {
  /**
   * Cancels the request, including retries and the backoff sleep between them.
   * A caller abort rejects with {@link AbortedError} (never retried), distinct
   * from {@link TimedOutError}.
   */
  signal?: AbortSignal;
  /** Per-attempt timeout in milliseconds (JSON requests). */
  timeout?: number;
  /** Retries for transient failures (`0` disables). Negative or non-finite values count as `0`. */
  retries?: number;
}

/** Options for {@link Request.send}. */
export interface SendOptions extends RequestOptions {
  /** Query-string parameters. */
  params?: Params;
  /** Form-encoded body (an object) or a pre-encoded JSON string. Ignored when `json` is set. */
  form?: Params | string;
  /** JSON body. */
  json?: JsonInput;
  /** Extra headers for this request; a `null` value removes that header. */
  headers?: Record<string, string | null>;
  /** Retry transient failures even for a non-`GET` method (idempotent reads over `POST`). */
  retry?: boolean;
}

/** Options for {@link Request.streamToFile} and {@link Request.raceToFile}. */
export interface StreamOptions {
  /** Overall deadline in ms. Defaults to {@link DEFAULT_DOWNLOAD_TIMEOUT_MS}. */
  timeout?: number;
  /** Transform factory (a fresh transform per call, since a transform can't be reused). */
  transform?: () => Transform;
  /** Abort when no bytes are written for this long. Defaults to {@link DEFAULT_DOWNLOAD_IDLE_MS}. */
  idleTimeoutMs?: number;
  /** Cancels the download; rejects with {@link AbortedError}. */
  signal?: AbortSignal;
}

interface BodyInit {
  body: string;
  form?: boolean;
  json?: boolean;
}

/**
 * The minimal `fetch` contract the transport relies on. The global `fetch` and
 * drop-in replacements (e.g. `node-wreq` for browser TLS impersonation) both
 * satisfy it, so either can be injected via {@link RequestInit.fetch}.
 */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal },
) => Promise<ResponseLike>;

/** Options accepted by {@link Request} constructor. */
export interface RequestInit {
  /** The owning client, used to attach the `Authorization` header. */
  client?: Client;
  /** Starting headers. Defaults to a copy of {@link BASE_HEADERS}. */
  headers?: Record<string, string>;
  /**
   * Optional proxy URL applied to every request.
   * @deprecated Ignored. Pass a proxy-capable `fetch` (undici `ProxyAgent` / `node-wreq`) instead.
   */
  proxyUrl?: string;
  /** Default timeout in milliseconds. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeout?: number;
  /** `fetch` implementation to use. Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** `User-Agent` header value. Defaults to {@link USER_AGENT}. */
  userAgent?: string;
  /** Number of retries for transient failures on idempotent (`GET`) requests.
   * Defaults to `2` (3 attempts total). Set `0` to disable. */
  retries?: number;
  /** Initial retry backoff in ms. Defaults to `300`. */
  retryBaseMs?: number;
  /** Maximum retry backoff in ms. Defaults to `4000`. */
  retryMaxMs?: number;
  /**
   * Extra origins (for example `https://proxy.example`) that may receive the
   * `Authorization` and `X-Yandex-Music-Client` headers. The owning client's
   * `baseUrl` origin (or {@link DEFAULT_API_ORIGIN} without a client) is always
   * allowed; every other host (CDN mirrors, lyrics storage, arbitrary URLs)
   * gets neither header.
   */
  authOrigins?: string[];
}

interface Envelope {
  result: JSONValue;
  error?: JSONValue;
  errorDescription?: JSONValue;
}

/** Internal sentinel: every mirror failed the header race, so fall back to the
 * sequential retry. Never surfaces to callers. */
class RaceFailed extends Error {}

/** Headers that carry credentials or app identity and are only sent to allowed origins. */
const PRIVILEGED_HEADERS = new Set(['authorization', 'x-yandex-music-client']);

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

function abortedError(signal: AbortSignal): AbortedError {
  return new AbortedError(undefined, { cause: signal.reason });
}

/** Sleep for `ms`, rejecting with {@link AbortedError} as soon as `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortedError(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Abort `controller` when `signal` aborts; returns the listener cleanup. */
function forwardAbort(signal: AbortSignal | undefined, controller: AbortController): () => void {
  if (!signal) {
    return () => undefined;
  }
  if (signal.aborted) {
    controller.abort();
    return () => undefined;
  }
  const onAbort = (): void => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

/** Combine two optional signals into one (either aborting aborts the result). */
function anySignal(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a || !b || a === b) {
    return a ?? b;
  }
  return AbortSignal.any([a, b]);
}

/** Clamp a retry count to a non-negative integer (negative, `NaN` and `Infinity` → `0`). */
function normalizeRetries(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Origin of a URL, or `null` when it does not parse. */
function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Unique sibling path a download is written to before the atomic rename. */
function partPath(filename: string): string {
  return `${filename}.${randomUUID().slice(0, 8)}.part`;
}

/** Copy of `headers` with the `Authorization` value masked, for logging and inspection. */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = name.toLowerCase() === 'authorization' ? 'OAuth [redacted]' : value;
  }
  return out;
}

/**
 * Read a response header without ever throwing: custom fetch shims may expose
 * `headers` as a plain object, a `Headers`-like without `get`, or nothing.
 */
function readHeader(headers: unknown, name: string): string | null {
  try {
    if (headers === null || typeof headers !== 'object') {
      return null;
    }
    const get = (headers as { get?: unknown }).get;
    if (typeof get === 'function') {
      const value: unknown = get.call(headers, name);
      return typeof value === 'string' ? value : null;
    }
    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === wanted && typeof value === 'string') {
        return value;
      }
    }
  } catch {
    // A broken shim must not mask the HTTP error being reported.
  }
  return null;
}

/** Exponential backoff with full jitter (`random() * min(max, base·2^attempt)`),
 * spreading retries to avoid thundering-herd against the API. */
function backoff(attempt: number, baseMs: number, maxMs: number): number {
  return Math.random() * Math.min(maxMs, baseMs * 2 ** attempt);
}

/** Run a whole buffer through a Node transform and collect the output (the
 * in-memory fallback for {@link Request.streamToFile} when no body stream is
 * available). */
async function runTransform(transform: Transform, input: Uint8Array): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => {
    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', resolve);
    transform.on('error', reject);
  });
  transform.end(input);
  try {
    await done;
  } catch (err) {
    transform.destroy();
    throw err;
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * Helper for performing requests against the API.
 *
 * An instance is created automatically by {@link Client}, but may also be
 * pre-configured (custom headers, proxy, timeout) and passed in.
 */
export class Request {
  /** Headers merged into every outgoing request. */
  headers: Record<string, string>;
  /**
   * Proxy URL applied to every request, if any.
   * @deprecated Ignored. Pass a proxy-capable `fetch` (undici `ProxyAgent` / `node-wreq`) instead.
   */
  proxyUrl?: string;
  /** Default timeout in milliseconds. */
  timeout: number;
  /** The owning client (non-enumerable, so serializing the transport does not walk back into the client). */
  declare client?: Client;
  /** `User-Agent` sent with every request. */
  userAgent: string;
  /** Retries for transient failures on idempotent requests. */
  retries: number;
  /** Initial retry backoff in ms. */
  retryBaseMs: number;
  /** Maximum retry backoff in ms. */
  retryMaxMs: number;
  /** Extra origins allowed to receive the auth headers (see {@link RequestInit.authOrigins}). */
  authOrigins: string[];
  /** The `fetch` implementation used for every request. */
  private readonly fetchImpl: FetchLike;
  /** Defaults applied to every call made through this instance (set by {@link Request.withOptions}). */
  private callDefaults: RequestOptions = {};

  /**
   * @param options - Transport configuration.
   */
  constructor(options: RequestInit = {}) {
    // Custom headers merge onto BASE_HEADERS so defaults (e.g. the client
    // header) survive unless explicitly overridden.
    this.headers = { ...BASE_HEADERS, ...options.headers };
    this.proxyUrl = options.proxyUrl;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike);
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.retries = normalizeRetries(options.retries ?? 2);
    this.retryBaseMs = options.retryBaseMs ?? 300;
    this.retryMaxMs = options.retryMaxMs ?? 4000;
    this.authOrigins = (options.authOrigins ?? []).map((o) => originOf(o)).filter((o): o is string => o !== null);
    Object.defineProperty(this, 'client', { value: undefined, writable: true, configurable: true, enumerable: false });
    if (options.client) {
      this.setClient(options.client);
    }
  }

  /**
   * A view of this transport whose calls default to `options` (an explicit
   * per-call option still wins; signals are combined). The view shares headers,
   * token, `fetch` and configuration with this instance.
   *
   * @param options - Defaults for every call made through the view.
   * @returns The view.
   */
  withOptions(options: RequestOptions): Request {
    const view = Object.create(this) as Request;
    view.callDefaults = {
      ...this.callDefaults,
      ...options,
      signal: anySignal(this.callDefaults.signal, options.signal),
    };
    return view;
  }

  /** Whether `url` may receive the `Authorization` / `X-Yandex-Music-Client` headers. */
  isAuthOrigin(url: string): boolean {
    const origin = originOf(url);
    if (origin === null) {
      return false;
    }
    return origin === originOf(this.client?.baseUrl ?? DEFAULT_API_ORIGIN) || this.authOrigins.includes(origin);
  }

  /** Redacted, cycle-free data view (the `Authorization` value is masked). */
  toJSON(): Record<string, unknown> {
    return {
      headers: redactHeaders(this.headers),
      timeout: this.timeout,
      userAgent: this.userAgent,
      retries: this.retries,
      retryBaseMs: this.retryBaseMs,
      retryMaxMs: this.retryMaxMs,
      authOrigins: this.authOrigins,
    };
  }

  /** `util.inspect` / `console.log` output with the token redacted. */
  [INSPECT](): string {
    return `Request ${JSON.stringify(this.toJSON())}`;
  }

  /**
   * Attach a client and, when it carries a token, the authorization header.
   *
   * @param client - The client to associate with this transport.
   * @returns The same client, for convenience.
   */
  setClient(client: Client): Client {
    this.client = client;
    if (client.token) {
      this.setAuthorization(client.token);
    }
    return client;
  }

  /**
   * Set the `Authorization` header from an OAuth token.
   *
   * @param token - The OAuth token.
   */
  setAuthorization(token: string): void {
    this.headers['Authorization'] = `OAuth ${token}`;
  }

  /** Remove the `Authorization` header. */
  clearAuthorization(): void {
    delete this.headers['Authorization'];
  }

  /**
   * Set the `Accept-Language` header.
   *
   * @param lang - Language code (one of `en`, `uz`, `uk`, `us`, `ru`, `kk`, `hy`).
   */
  setLanguage(lang: string): void {
    this.headers['Accept-Language'] = lang;
  }

  /**
   * Perform a `GET` request and return the unwrapped result.
   *
   * @param url - Absolute request URL.
   * @param params - Optional query parameters.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async get(url: string, params?: Params, timeout?: number, extraHeaders?: Record<string, string | null>): Promise<JSONValue | undefined> {
    return this.send('GET', url, { params, timeout, headers: extraHeaders });
  }

  /**
   * Perform a `POST` request with a form-encoded body and return the result.
   *
   * @param url - Absolute request URL.
   * @param data - Object (form-encoded) or pre-encoded string body.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async post(url: string, data?: Params | string, timeout?: number, extraHeaders?: Record<string, string | null>): Promise<JSONValue | undefined> {
    // A pre-serialized string body is JSON (e.g. queue payloads); object bodies
    // are form-encoded. Tagging a JSON string as form-urlencoded makes some
    // endpoints (notably `/queues`) drop the connection, so pick the matching
    // `Content-Type` per body kind.
    return this.send('POST', url, { form: data ?? {}, timeout, headers: extraHeaders });
  }

  /**
   * Perform a request and return the unwrapped result. The other verb helpers
   * delegate here; use it directly to combine a query string with a body.
   *
   * @param method - HTTP method.
   * @param url - Absolute request URL.
   * @param options - Query, body, headers, timeout and retry options.
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async send(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    options: SendOptions = {},
  ): Promise<JSONValue | undefined> {
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      body = { body: JSON.stringify(options.json), json: true };
    } else if (typeof options.form === 'string') {
      // A pre-serialized string body is JSON (e.g. queue payloads).
      body = { body: options.form, json: true };
    } else if (options.form !== undefined) {
      body = { body: this.encodeForm(options.form), form: true };
    }
    const bytes = await this.requestWrapper(method, this.withQuery(url, options.params), body, options);
    return this.unwrap(bytes);
  }

  /**
   * Perform a `POST` request with a JSON body and return the result.
   *
   * @param url - Absolute request URL.
   * @param json - Object serialized as the JSON request body.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @param options - Optional query `params` and `headers` (a `null` value removes a header).
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async postJson(
    url: string,
    json?: JsonInput,
    timeout?: number,
    options?: { params?: Params; headers?: Record<string, string | null> },
  ): Promise<JSONValue | undefined> {
    return this.send('POST', url, { json: json ?? {}, timeout, ...options });
  }

  /**
   * Perform a `PUT` request with a JSON body and return the result.
   *
   * @param url - Absolute request URL.
   * @param json - Object serialized as the JSON request body.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async put(
    url: string,
    json?: JsonInput,
    timeout?: number,
    options?: { params?: Params; headers?: Record<string, string | null> },
  ): Promise<JSONValue | undefined> {
    return this.send('PUT', url, { json: json ?? {}, timeout, ...options });
  }

  /**
   * Perform a `DELETE` request with a JSON body and return the result.
   *
   * @param url - Absolute request URL.
   * @param json - Object serialized as the JSON request body.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async delete(
    url: string,
    json?: JsonInput,
    timeout?: number,
    options?: { params?: Params; headers?: Record<string, string | null> },
  ): Promise<JSONValue | undefined> {
    return this.send('DELETE', url, { json: json ?? {}, timeout, ...options });
  }

  /**
   * Perform a `GET` request and return the raw response bytes without parsing.
   *
   * Used for non-JSON payloads such as download-info XML and audio files.
   *
   * @param url - Absolute request URL.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @returns The raw response body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async retrieve(url: string, timeout: number = DEFAULT_DOWNLOAD_TIMEOUT_MS, options: RequestOptions = {}): Promise<Uint8Array> {
    return this.requestWrapper('GET', url, undefined, { ...options, timeout });
  }

  /**
   * Download a URL straight to a file on disk.
   *
   * Streams the response body to disk when the fetch implementation exposes a
   * stream (the global `fetch` does), so memory stays O(chunk) instead of
   * buffering the whole file and the write overlaps the download. Falls back to
   * buffering on shims without a body stream.
   *
   * @param url - Absolute request URL.
   * @param filename - Destination path, including extension.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @param options - Optional `signal`.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async download(
    url: string,
    filename: string,
    timeout: number = DEFAULT_DOWNLOAD_TIMEOUT_MS,
    options: Pick<RequestOptions, 'signal'> = {},
  ): Promise<void> {
    return this.streamToFile(url, filename, { timeout, signal: options.signal });
  }

  /**
   * Stream a `GET` response straight to a file, optionally piping it through a
   * transform first (for example an AES-CTR decipher for an `encraw` stream).
   *
   * The whole transfer — including the body read and the transform — runs under
   * a single abort deadline, so a stalled stream is torn down instead of hanging.
   * When the fetch implementation exposes no body stream, it falls back to
   * buffering the bytes, running the transform in memory and writing once.
   *
   * @param url - Absolute request URL.
   * @param filename - Destination path, including extension.
   * @param options - `timeout` (ms) and an optional `transform` stream factory
   *   (a fresh transform per call, since a transform can't be reused).
   * @throws {YandexMusicError} On any transport or API error.
   */
  async streamToFile(url: string, filename: string, options: StreamOptions = {}): Promise<void> {
    const signal = anySignal(this.callDefaults.signal, options.signal);
    if (signal?.aborted) {
      throw abortedError(signal);
    }
    const controller = new AbortController();
    const ms = options.timeout ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), ms);
    const unforward = forwardAbort(signal, controller);
    const idleMs = options.idleTimeoutMs ?? DEFAULT_DOWNLOAD_IDLE_MS;
    // Write to a unique sibling and rename on success: a failure never touches
    // an existing file at `filename`, and readers never see a partial file.
    const part = partPath(filename);
    try {
      const response = await this.openValidated(url, controller.signal);
      await this.pipeBody(response, part, options.transform?.(), { controller, idleMs });
      await rename(part, filename);
    } catch (error) {
      await rm(part, { force: true }).catch(() => undefined);
      throw this.wrapTransportError(error, signal);
    } finally {
      clearTimeout(timer);
      unforward();
    }
  }

  /**
   * Stream a `GET` to a file, racing several mirror URLs and committing to the
   * first that responds — the fastest CDN host wins, cutting tail latency when
   * one mirror is slow. Losing connections are aborted. If the winning stream
   * fails mid-download (or every mirror's headers fail), it falls back to trying
   * the URLs sequentially, so racing never costs robustness.
   *
   * @param urls - Candidate mirror URLs (preference order; used for the fallback).
   * @param filename - Destination path, including extension.
   * @param options - `timeout` (ms), `signal` and an optional `transform` stream factory.
   * @throws {YandexMusicError} On any transport or API error (after the fallback).
   */
  async raceToFile(urls: string[], filename: string, options: StreamOptions = {}): Promise<void> {
    if (urls.length <= 1) {
      return this.streamToFile(urls[0] ?? '', filename, options);
    }
    const signal = anySignal(this.callDefaults.signal, options.signal);
    if (signal?.aborted) {
      throw abortedError(signal);
    }
    const ms = options.timeout ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    const idleMs = options.idleTimeoutMs ?? DEFAULT_DOWNLOAD_IDLE_MS;
    const deadline = Date.now() + ms;
    const controllers = urls.map(() => new AbortController());
    const timer = setTimeout(() => controllers.forEach((c) => c.abort()), ms);
    const unforward = controllers.map((c) => forwardAbort(signal, c));
    const part = partPath(filename);
    try {
      let winner: number;
      let response: ResponseLike;
      try {
        const opened = await Promise.any(
          urls.map((u, i) => this.openValidated(u, controllers[i]!.signal).then((r) => ({ r, i }))),
        );
        winner = opened.i;
        response = opened.r;
      } catch {
        // every mirror failed to respond — fall through to the sequential retry.
        throw new RaceFailed();
      }
      // commit to the winner; drop the losing connections.
      controllers.forEach((c, i) => i !== winner && c.abort());
      await this.pipeBody(response, part, options.transform?.(), {
        controller: controllers[winner]!,
        idleMs,
      });
      await rename(part, filename);
    } catch (error) {
      // winner stream broke (or no mirror responded): robust sequential fallback.
      // Only the temp file is removed; an existing `filename` is left untouched.
      await rm(part, { force: true }).catch(() => undefined);
      if (signal?.aborted) {
        throw abortedError(signal);
      }
      let lastError: unknown = error instanceof RaceFailed ? undefined : error;
      for (const url of urls) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        try {
          await this.streamToFile(url, filename, { ...options, signal, timeout: remaining });
          return;
        } catch (e) {
          lastError = e;
          if (e instanceof AbortedError) {
            break;
          }
        }
      }
      throw this.wrapTransportError(lastError ?? new TimedOutError(), signal);
    } finally {
      clearTimeout(timer);
      unforward.forEach((f) => f());
    }
  }

  /**
   * Headers for one request: the transport headers plus `User-Agent`, with the
   * privileged headers (`Authorization`, `X-Yandex-Music-Client`) dropped for
   * origins outside the allowlist, then the per-call `extraHeaders` applied (an
   * explicit per-call header is always honoured; `null` removes a header).
   */
  private buildHeaders(url: string, extraHeaders?: Record<string, string | null>): Record<string, string> {
    const headers: Record<string, string> = { ...this.headers, 'User-Agent': this.userAgent };
    if (!this.isAuthOrigin(url)) {
      for (const name of Object.keys(headers)) {
        if (PRIVILEGED_HEADERS.has(name.toLowerCase())) {
          delete headers[name];
        }
      }
    }
    for (const [name, value] of Object.entries(extraHeaders ?? {})) {
      if (value === null) {
        const wanted = name.toLowerCase();
        for (const existing of Object.keys(headers)) {
          if (existing.toLowerCase() === wanted) {
            delete headers[existing];
          }
        }
      } else {
        headers[name] = value;
      }
    }
    return headers;
  }

  /** Open a `GET` and validate a 2xx status, throwing a typed error otherwise. */
  private async openValidated(url: string, signal: AbortSignal): Promise<ResponseLike> {
    const response = await this.fetchImpl(url, { method: 'GET', headers: this.buildHeaders(url), signal });
    if (response.status < 200 || response.status > 299) {
      this.handleErrorResponse(response.status, new Uint8Array(await response.arrayBuffer()), response.headers);
    }
    return response;
  }

  /** Pipe a response body to a file, through `transform` when given; streams when
   * the body is a stream, otherwise buffers and writes once.
   *
   * When `idle` is provided, a watchdog aborts a stalled stream after `idleMs` of
   * no write progress — detecting a dead connection in seconds rather than only
   * at the overall deadline, while a still-flowing download is never interrupted. */
  private async pipeBody(
    response: ResponseLike,
    filename: string,
    transform?: Transform,
    idle?: { controller: AbortController; idleMs: number },
  ): Promise<void> {
    const webBody = response.body;
    if (webBody && typeof (webBody as { getReader?: unknown }).getReader === 'function') {
      const source = Readable.fromWeb(webBody as NodeWebReadableStream<Uint8Array>);
      const sink = createWriteStream(filename);
      const stages = transform ? [source, transform, sink] : [source, sink];
      // idle watchdog: abort if the file hasn't grown for `idleMs` (a silently
      // broken pipe). Progress is measured by bytes actually written to disk.
      let idleTimer: ReturnType<typeof setInterval> | null = null;
      if (idle && idle.idleMs > 0) {
        let lastBytes = 0;
        let lastProgressAt = Date.now();
        idleTimer = setInterval(() => {
          if (sink.bytesWritten > lastBytes) {
            lastBytes = sink.bytesWritten;
            lastProgressAt = Date.now();
          } else if (Date.now() - lastProgressAt > idle.idleMs) {
            idle.controller.abort();
          }
        }, Math.max(1000, Math.min(idle.idleMs, 5000)));
      }
      try {
        // `pipeline` propagates the abort (via the stream erroring) and closes
        // every stage, including the file handle, on success or failure.
        await pipeline(stages as [Readable, ...NodeJS.WritableStream[]]);
      } finally {
        if (idleTimer !== null) {
          clearInterval(idleTimer);
        }
      }
    } else {
      const raw = new Uint8Array(await response.arrayBuffer());
      await writeFile(filename, transform ? await runTransform(transform, raw) : raw);
    }
  }

  /** Map a transport-layer throwable to the library's typed errors; a caller
   * abort (`signal` aborted) becomes {@link AbortedError}. */
  private wrapTransportError(error: unknown, signal?: AbortSignal): Error {
    if (error instanceof YandexMusicError) {
      return error;
    }
    if (signal?.aborted) {
      return abortedError(signal);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return new TimedOutError();
    }
    return new NetworkError(error instanceof Error ? error.message : String(error), { cause: error });
  }

  /** Build a `URLSearchParams` from `Params`, repeating array values per key and
   * skipping `undefined`/`null`. Shared by query-string and form-body encoding. */
  private toSearchParams(params?: Params): URLSearchParams {
    const search = new URLSearchParams();
    if (!params) {
      return search;
    }
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            search.append(key, String(item));
          }
        }
      } else {
        search.append(key, String(value));
      }
    }
    return search;
  }

  private withQuery(url: string, params?: Params): string {
    const qs = this.toSearchParams(params).toString();
    return qs ? `${url}?${qs}` : url;
  }

  private encodeForm(data?: Params): string {
    return this.toSearchParams(data).toString();
  }

  /**
   * Perform a request, retrying transient transport failures on idempotent
   * (`GET`) methods with exponential backoff + jitter. Mutating methods are not
   * retried (one attempt) unless the call opts in with `retry`. Typed API errors (4xx/auth) are not retried either —
   * only {@link NetworkError} and {@link TimedOutError} are. A caller abort stops
   * the attempt and the backoff sleep immediately.
   */
  private async requestWrapper(
    method: string,
    url: string,
    body: BodyInit | undefined,
    options: SendOptions,
  ): Promise<Uint8Array> {
    const defaults = this.callDefaults;
    const signal = anySignal(defaults.signal, options.signal);
    const timeout = options.timeout ?? defaults.timeout;
    const retries = normalizeRetries(options.retries ?? defaults.retries ?? this.retries);
    const maxAttempts = method === 'GET' || options.retry === true ? retries + 1 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) {
        throw abortedError(signal);
      }
      try {
        return await this.attemptRequest(method, url, body, timeout, options.headers, signal);
      } catch (error) {
        lastError = error;
        // Retry only transient transport/server failures. NetworkError covers
        // connection resets and 5xx; TimedOutError covers stalls. Its 4xx
        // subclasses (Bad Request, Not Found, Conflict, Payload Too Large) and
        // auth errors are deterministic — never retried.
        const retryable =
          (error instanceof NetworkError || error instanceof TimedOutError) &&
          !(error instanceof BadRequestError) &&
          !(error instanceof NotFoundError) &&
          !(error instanceof ConflictError) &&
          !(error instanceof PayloadTooLargeError);
        if (attempt === maxAttempts - 1 || !retryable) {
          throw error;
        }
        const serverDelay = error instanceof YandexMusicError ? error.retryAfterMs : undefined;
        if (serverDelay !== undefined && serverDelay > this.retryMaxMs) {
          throw error;
        }
        await sleep(serverDelay ?? backoff(attempt, this.retryBaseMs, this.retryMaxMs), signal);
      }
    }
    throw lastError;
  }

  private async attemptRequest(
    method: string,
    url: string,
    body?: BodyInit,
    timeout?: number,
    extraHeaders?: Record<string, string | null>,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const controller = new AbortController();
    const ms = timeout ?? this.timeout;
    const timer = setTimeout(() => controller.abort(), ms);
    const unforward = forwardAbort(signal, controller);

    const headers = this.buildHeaders(url, extraHeaders);
    if (body?.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (body?.json) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: body?.body,
        signal: controller.signal,
      });
      // Read the body under the same deadline: the timeout must cover the full
      // download, not just the headers — a stalled body stream (broken pipe with
      // no RST) would otherwise hang forever.
      const content = new Uint8Array(await response.arrayBuffer());
      if (response.status >= 200 && response.status <= 299) {
        return content;
      }
      this.handleErrorResponse(response.status, content, response.headers);
    } catch (error) {
      throw this.wrapTransportError(error, signal);
    } finally {
      clearTimeout(timer);
      unforward();
    }
  }

  private parseBody(bytes: Uint8Array): Envelope {
    let data: JSONValue;
    try {
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as JSONValue;
    } catch (error) {
      throw new YandexMusicError(`Invalid server response: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (isJsonObject(data)) {
      // The API wraps payloads in `{ result, invocationInfo }`. Detect the
      // envelope by key presence so a legitimate `result: null` is preserved
      // (and unwrapped responses, e.g. OAuth, pass through as-is).
      if ('result' in data) {
        return {
          result: data['result'] ?? null,
          error: data['error'] ?? undefined,
          errorDescription: data['errorDescription'] ?? undefined,
        };
      }
      return {
        result: data,
        error: data['error'] ?? undefined,
        errorDescription: data['errorDescription'] ?? undefined,
      };
    }
    return { result: data };
  }

  private unwrap(bytes: Uint8Array): JSONValue | undefined {
    if (bytes.length === 0) {
      return undefined;
    }
    return this.parseBody(bytes).result;
  }

  /**
   * Pull a human-readable error out of an error response body.
   *
   * The API reports failures in several shapes: a top-level
   * `{ error, errorDescription }` (OAuth/legacy), a top-level `{ name, message }`,
   * or — for newer services such as `/queues` — the same `{ name, message }`
   * nested under `result`. All are coalesced into a single `name: message` string.
   */
  private extractErrorMessage(content: Uint8Array): string {
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content)) as JSONValue;
    if (!isJsonObject(data)) {
      return '';
    }
    const pick = (obj: JSONValue | undefined): { name: string; message: string } | undefined => {
      if (!isJsonObject(obj)) {
        return undefined;
      }
      const name = typeof obj['name'] === 'string' ? obj['name'] : '';
      const message = typeof obj['message'] === 'string' ? obj['message'] : '';
      return name || message ? { name, message } : undefined;
    };
    // Priority: nested `result` error → top-level `{name,message}` → `error` object.
    const found = pick(data['result']) ?? pick(data) ?? pick(data['error']);
    if (found) {
      return [found.name, found.message].filter(Boolean).join(': ');
    }
    // Legacy `{ error, errorDescription }` (strings). OAuth endpoints use snake_case `error_description`.
    const error = typeof data['error'] === 'string' ? data['error'] : '';
    const description =
      typeof data['errorDescription'] === 'string'
        ? data['errorDescription']
        : typeof data['error_description'] === 'string'
          ? data['error_description']
          : '';
    return [error, description].filter(Boolean).join(' ').trim();
  }

  /** Error `code` from a response body: the OAuth `error` string, or an error object's `name`. */
  private extractErrorCode(content: Uint8Array): string | undefined {
    try {
      const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content)) as JSONValue;
      if (!isJsonObject(data)) {
        return undefined;
      }
      const result = data['result'];
      const error = data['error'];
      const candidates = [
        typeof error === 'string' ? error : undefined,
        isJsonObject(error) ? error['name'] : undefined,
        data['name'],
        isJsonObject(result) ? result['name'] : undefined,
      ];
      return candidates.find((c): c is string => typeof c === 'string' && c !== '');
    } catch {
      return undefined;
    }
  }

  /** Parse `Retry-After` (delta-seconds or HTTP date) into milliseconds. */
  private parseRetryAfter(headers?: ResponseLike['headers']): number | undefined {
    const raw = readHeader(headers, 'retry-after')?.trim();
    if (!raw) {
      return undefined;
    }
    if (/^\d+$/.test(raw)) {
      return Number(raw) * 1000;
    }
    const at = Date.parse(raw);
    return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
  }

  private handleErrorResponse(status: number, content: Uint8Array, headers?: ResponseLike['headers']): never {
    let message: string;
    try {
      message = this.extractErrorMessage(content) || `HTTP ${status}`;
    } catch {
      const text = new TextDecoder('utf-8').decode(content).slice(0, 200).trim();
      message = text ? `HTTP ${status}: ${text}` : `HTTP ${status}`;
    }
    const code = this.extractErrorCode(content);
    const info = { status, code };
    const withStatus = (m: string): string => (m.startsWith(`HTTP ${status}`) ? m : `${m} (${status})`);

    if (status === 401 || status === 403) {
      throw new UnauthorizedError(message, info);
    }
    if (status === 400) {
      throw new BadRequestError(message, info);
    }
    if (status === 404) {
      throw new NotFoundError(message, info);
    }
    if (status === 409) {
      throw new ConflictError(message, info);
    }
    if (status === 413) {
      throw new PayloadTooLargeError(message, info);
    }
    if (status === 429) {
      throw new TooManyRequestsError(message, { ...info, retryAfterMs: this.parseRetryAfter(headers) });
    }
    if (status === 502) {
      // Kept as a plain NetworkError (pinned by the existing 0.3.0 tests).
      throw new NetworkError('Bad Gateway', info);
    }
    if (status >= 500 && status <= 599) {
      const retryAfterMs = status === 503 ? this.parseRetryAfter(headers) : undefined;
      throw new ServerError(withStatus(message), { ...info, retryAfterMs });
    }
    throw new NetworkError(withStatus(message), info);
  }
}
