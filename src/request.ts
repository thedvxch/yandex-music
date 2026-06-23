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
}

interface Envelope {
  result: JSONValue;
  error?: JSONValue;
  errorDescription?: JSONValue;
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
   * @param url - Absolute request URL.
   * @param filename - Destination path, including extension.
   * @param timeout - Optional per-call timeout override (milliseconds).
   * @throws {YandexMusicError} On any transport or API error.
   */
  async download(url: string, filename: string, timeout: number = DEFAULT_DOWNLOAD_TIMEOUT_MS): Promise<void> {
    const bytes = await this.retrieve(url, timeout);
    await writeFile(filename, bytes);
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

  private async requestWrapper(
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
