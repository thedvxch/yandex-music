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
export const USER_AGENT = 'Yandex-Music-API';

/** Default per-request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 5000;

/** Headers sent with every request unless overridden. */
export const BASE_HEADERS: Readonly<Record<string, string>> = {
  'X-Yandex-Music-Client': 'YandexMusicAndroid/24023621',
};

/** A primitive that can be serialized into a query string or form body. */
export type ParamValue = string | number | boolean | null | undefined;

/** Query string / form parameters. Array values are repeated per key. */
export type Params = Record<string, ParamValue | ParamValue[]>;

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

  /**
   * @param options - Transport configuration.
   */
  constructor(options: RequestInit = {}) {
    this.headers = options.headers ?? { ...BASE_HEADERS };
    this.proxyUrl = options.proxyUrl;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
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
    const body = typeof data === 'string' ? data : this.encodeForm(data);
    const bytes = await this.requestWrapper('POST', url, { body, form: true }, timeout);
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
  async retrieve(url: string, timeout?: number): Promise<Uint8Array> {
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
  async download(url: string, filename: string, timeout?: number): Promise<void> {
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

    const headers: Record<string, string> = { ...this.headers, 'User-Agent': USER_AGENT };
    if (body?.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (body?.json) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body?.body,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TimedOutError();
      }
      throw new NetworkError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }

    const content = new Uint8Array(await response.arrayBuffer());
    if (response.status >= 200 && response.status <= 299) {
      return content;
    }

    this.handleErrorResponse(response.status, content);
  }

  private parseBody(bytes: Uint8Array): Envelope {
    let data: JSONValue;
    try {
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as JSONValue;
    } catch (error) {
      throw new YandexMusicError(`Invalid server response: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (isJsonObject(data)) {
      const hasResult = data['result'] !== undefined && data['result'] !== null;
      return {
        result: hasResult ? data['result']! : data,
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

  private handleErrorResponse(status: number, content: Uint8Array): never {
    let message = 'Unknown error';
    try {
      const envelope = this.parseBody(content);
      const error = envelope.error ?? '';
      const description = envelope.errorDescription ?? '';
      message = `${typeof error === 'string' ? error : JSON.stringify(error)} ${
        typeof description === 'string' ? description : JSON.stringify(description)
      }`.trim();
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
