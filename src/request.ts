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
import { writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Transform } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import {
  BadRequestError,
  NetworkError,
  NotFoundError,
  TimedOutError,
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
  /** Optional proxy URL applied to every request. */
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
}

interface Envelope {
  result: JSONValue;
  error?: JSONValue;
  errorDescription?: JSONValue;
}

/** Internal sentinel: every mirror failed the header race, so fall back to the
 * sequential retry. Never surfaces to callers. */
class RaceFailed extends Error {}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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
  await done;
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
  /** Proxy URL applied to every request, if any. */
  proxyUrl?: string;
  /** Default timeout in milliseconds. */
  timeout: number;
  /** The owning client. */
  client?: Client;
  /** `User-Agent` sent with every request. */
  userAgent: string;
  /** Retries for transient failures on idempotent requests. */
  retries: number;
  /** Initial retry backoff in ms. */
  retryBaseMs: number;
  /** Maximum retry backoff in ms. */
  retryMaxMs: number;
  /** The `fetch` implementation used for every request. */
  private readonly fetchImpl: FetchLike;

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
    this.retries = options.retries ?? 2;
    this.retryBaseMs = options.retryBaseMs ?? 300;
    this.retryMaxMs = options.retryMaxMs ?? 4000;
    if (options.client) {
      this.setClient(options.client);
    }
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
  async get(url: string, params?: Params, timeout?: number): Promise<JSONValue | undefined> {
    const bytes = await this.requestWrapper('GET', this.withQuery(url, params), undefined, timeout);
    return this.unwrap(bytes);
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
  async post(url: string, data?: Params | string, timeout?: number): Promise<JSONValue | undefined> {
    // A pre-serialized string body is JSON (e.g. queue payloads); object bodies
    // are form-encoded. Tagging a JSON string as form-urlencoded makes some
    // endpoints (notably `/queues`) drop the connection, so pick the matching
    // `Content-Type` per body kind.
    const init =
      typeof data === 'string'
        ? { body: data, json: true }
        : { body: this.encodeForm(data), form: true };
    const bytes = await this.requestWrapper('POST', url, init, timeout);
    return this.unwrap(bytes);
  }

  /**
   * Perform a `POST` request with a JSON body and return the result.
   *
   * @param url - Absolute request URL.
   * @param json - Object serialized as the JSON request body.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @returns The unwrapped `result` payload, or `undefined` for an empty body.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async postJson(url: string, json?: JSONValue, timeout?: number): Promise<JSONValue | undefined> {
    const bytes = await this.requestWrapper('POST', url, { body: JSON.stringify(json ?? {}), json: true }, timeout);
    return this.unwrap(bytes);
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
  async put(url: string, json?: JSONValue, timeout?: number): Promise<JSONValue | undefined> {
    const bytes = await this.requestWrapper('PUT', url, { body: JSON.stringify(json ?? {}), json: true }, timeout);
    return this.unwrap(bytes);
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
  async delete(url: string, json?: JSONValue, timeout?: number): Promise<JSONValue | undefined> {
    const bytes = await this.requestWrapper('DELETE', url, { body: JSON.stringify(json ?? {}), json: true }, timeout);
    return this.unwrap(bytes);
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
  async retrieve(url: string, timeout: number = DEFAULT_DOWNLOAD_TIMEOUT_MS): Promise<Uint8Array> {
    return this.requestWrapper('GET', url, undefined, timeout);
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
   * @throws {YandexMusicError} On any transport or API error.
   */
  async download(url: string, filename: string, timeout: number = DEFAULT_DOWNLOAD_TIMEOUT_MS): Promise<void> {
    return this.streamToFile(url, filename, { timeout });
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
  async streamToFile(
    url: string,
    filename: string,
    options: { timeout?: number; transform?: () => Transform; idleTimeoutMs?: number } = {},
  ): Promise<void> {
    const controller = new AbortController();
    const ms = options.timeout ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), ms);
    const idleMs = options.idleTimeoutMs ?? DEFAULT_DOWNLOAD_IDLE_MS;
    try {
      const response = await this.openValidated(url, controller.signal);
      await this.pipeBody(response, filename, options.transform?.(), { controller, idleMs });
    } catch (error) {
      throw this.wrapTransportError(error);
    } finally {
      clearTimeout(timer);
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
   * @param options - `timeout` (ms) and an optional `transform` stream factory.
   * @throws {YandexMusicError} On any transport or API error (after the fallback).
   */
  async raceToFile(
    urls: string[],
    filename: string,
    options: { timeout?: number; transform?: () => Transform; idleTimeoutMs?: number } = {},
  ): Promise<void> {
    if (urls.length <= 1) {
      return this.streamToFile(urls[0] ?? '', filename, options);
    }
    const ms = options.timeout ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    const idleMs = options.idleTimeoutMs ?? DEFAULT_DOWNLOAD_IDLE_MS;
    const controllers = urls.map(() => new AbortController());
    const timer = setTimeout(() => controllers.forEach((c) => c.abort()), ms);
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
      await this.pipeBody(response, filename, options.transform?.(), {
        controller: controllers[winner]!,
        idleMs,
      });
    } catch (error) {
      // winner stream broke (or no mirror responded): robust sequential fallback.
      let lastError: unknown = error instanceof RaceFailed ? undefined : error;
      for (const url of urls) {
        try {
          await this.streamToFile(url, filename, options);
          return;
        } catch (e) {
          lastError = e;
        }
      }
      throw this.wrapTransportError(lastError);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Open a `GET` and validate a 2xx status, throwing a typed error otherwise. */
  private async openValidated(url: string, signal: AbortSignal): Promise<ResponseLike> {
    const headers: Record<string, string> = { ...this.headers, 'User-Agent': this.userAgent };
    const response = await this.fetchImpl(url, { method: 'GET', headers, signal });
    if (response.status < 200 || response.status > 299) {
      this.handleErrorResponse(response.status, new Uint8Array(await response.arrayBuffer()));
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

  /** Map a transport-layer throwable to the library's typed errors. */
  private wrapTransportError(error: unknown): Error {
    if (error instanceof Error && error.name === 'AbortError') {
      return new TimedOutError();
    }
    if (error instanceof YandexMusicError) {
      return error;
    }
    return new NetworkError(error instanceof Error ? error.message : String(error), { cause: error });
  }

  private withQuery(url: string, params?: Params): string {
    if (!params) {
      return url;
    }
    const search = new URLSearchParams();
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
    const qs = search.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private encodeForm(data?: Params): string {
    const search = new URLSearchParams();
    if (data) {
      for (const [key, value] of Object.entries(data)) {
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
    }
    return search.toString();
  }

  /**
   * Perform a request, retrying transient transport failures on idempotent
   * (`GET`) methods with exponential backoff + jitter. Mutating methods are never
   * retried (one attempt). Typed API errors (4xx/auth) are not retried either —
   * only {@link NetworkError} and {@link TimedOutError} are.
   */
  private async requestWrapper(
    method: string,
    url: string,
    body?: { body: string; form?: boolean; json?: boolean },
    timeout?: number,
  ): Promise<Uint8Array> {
    const maxAttempts = method === 'GET' ? this.retries + 1 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await this.attemptRequest(method, url, body, timeout);
      } catch (error) {
        lastError = error;
        // Retry only transient transport/server failures. NetworkError covers
        // connection resets and 5xx; TimedOutError covers stalls. Its 4xx
        // subclasses (Bad Request, Not Found) and auth errors are deterministic —
        // never retried.
        const retryable =
          (error instanceof NetworkError || error instanceof TimedOutError) &&
          !(error instanceof BadRequestError) &&
          !(error instanceof NotFoundError);
        if (attempt === maxAttempts - 1 || !retryable) {
          throw error;
        }
        await sleep(backoff(attempt, this.retryBaseMs, this.retryMaxMs));
      }
    }
    throw lastError;
  }

  private async attemptRequest(
    method: string,
    url: string,
    body?: { body: string; form?: boolean; json?: boolean },
    timeout?: number,
  ): Promise<Uint8Array> {
    const controller = new AbortController();
    const ms = timeout ?? this.timeout;
    const timer = setTimeout(() => controller.abort(), ms);

    const headers: Record<string, string> = { ...this.headers, 'User-Agent': this.userAgent };
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
      this.handleErrorResponse(response.status, content);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimedOutError();
      }
      // Typed API errors (from handleErrorResponse) must propagate unchanged.
      if (error instanceof YandexMusicError) {
        throw error;
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error), { cause: error });
    } finally {
      clearTimeout(timer);
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
    // Legacy `{ error, errorDescription }` (strings).
    const error = typeof data['error'] === 'string' ? data['error'] : '';
    const description = typeof data['errorDescription'] === 'string' ? data['errorDescription'] : '';
    return [error, description].filter(Boolean).join(' ').trim();
  }

  private handleErrorResponse(status: number, content: Uint8Array): never {
    let message: string;
    try {
      message = this.extractErrorMessage(content) || `HTTP ${status}`;
    } catch {
      message = 'Unknown HTTPError';
    }

    if (status === 401 || status === 403) {
      throw new UnauthorizedError(message);
    }
    if (status === 400) {
      throw new BadRequestError(message);
    }
    if (status === 404) {
      throw new NotFoundError(message);
    }
    if (status === 409 || status === 413) {
      throw new NetworkError(message);
    }
    if (status === 502) {
      throw new NetworkError('Bad Gateway');
    }
    throw new NetworkError(`${message} (${status})`);
  }
}
