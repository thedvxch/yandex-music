/**
 * Shared client state and low-level helpers.
 *
 * {@link ClientBase} holds the configuration and transport that every method
 * group ("mixin") relies on. The public {@link Client} is assembled by layering
 * the mixins on top of this base.
 *
 * @packageDocumentation
 */
import { deList, type UnknownFieldReporter } from './base.js';
import { Request, type FetchLike, type RequestOptions } from './request.js';
import { IdMissingError, type UnauthorizedError } from './exceptions.js';
import type { Client } from './client.js';
import type { Status } from './models/account/account.js';
import type { DeJson, JSONValue } from './types.js';

/** Default API origin. */
export const DEFAULT_BASE_URL = 'https://api.music.yandex.net';

/** Default device descriptor sent with queue-related requests. */
export const DEFAULT_DEVICE =
  'os=TypeScript; os_version=; manufacturer=dvxch; model=yandex-music; clid=; device_id=random; uuid=random';

/** Options accepted by the {@link Client} constructor. */
export interface ClientOptions {
  /** OAuth token used to authenticate requests. */
  token?: string;
  /** Override the API origin. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** A pre-configured {@link Request} transport (custom headers, proxy, timeout). */
  request?: Request;
  /**
   * A custom `fetch` implementation (e.g. `node-wreq` for browser TLS
   * impersonation). Ignored when `request` is supplied. Defaults to global `fetch`.
   */
  fetch?: FetchLike;
  /** `User-Agent` value. Ignored when `request` is supplied. Defaults to the library UA. */
  userAgent?: string;
  /** Extra headers merged onto the defaults. Ignored when `request` is supplied. */
  headers?: Record<string, string>;
  /** Device descriptor for queue requests. Defaults to {@link DEFAULT_DEVICE}. */
  device?: string;
  /** Response language. Defaults to `ru`. One of `en`/`uz`/`uk`/`us`/`ru`/`kk`/`hy`. */
  language?: string;
  /**
   * When `true`, log a warning (via `console.warn`) whenever the API returns a
   * field the library does not yet model. Useful for spotting upstream API
   * changes. Ignored when {@link ClientOptions.onUnknownField} is set.
   */
  reportUnknownFields?: boolean;
  /**
   * A hook called whenever the API returns fields the library does not model.
   * Setting it enables detection (no need to also set `reportUnknownFields`) and
   * routes reports here instead of to `console.warn` — wire it to your logger,
   * metrics or a test assertion.
   */
  onUnknownField?: UnknownFieldReporter;
  /** Retries for transient failures on idempotent (`GET`) requests. Defaults to
   * `2` (3 attempts). Set `0` to disable. Ignored when `request` is supplied. */
  retries?: number;
  /** Initial retry backoff in ms. Defaults to `300`. Ignored when `request` is supplied. */
  retryBaseMs?: number;
  /** Maximum retry backoff in ms. Defaults to `4000`. Ignored when `request` is supplied. */
  retryMaxMs?: number;
  /** Default per-request timeout in ms. Defaults to `5000`. Ignored when `request` is supplied. */
  timeout?: number;
  /**
   * Extra origins allowed to receive the `Authorization` and
   * `X-Yandex-Music-Client` headers, besides the `baseUrl` origin. Every other
   * host (CDN mirrors, lyrics storage, any absolute URL) gets neither header.
   * Ignored when `request` is supplied (set `RequestInit.authOrigins` there).
   */
  authOrigins?: string[];
  /**
   * Called when the API answers HTTP 401 (never on 403). The returned token is
   * stored as `client.token` and the request is repeated once. Concurrent 401s
   * share one call (single flight), and a request that failed with a token that
   * was already rotated is simply repeated with the current one. The realtime
   * client created by `client.realtime()` uses the same hook when Ynison rejects
   * the token.
   */
  onUnauthorized?: UnauthorizedHandler;
}

/**
 * Supplies a fresh OAuth token after the API answered 401 — for example by
 * running `refreshAccessToken` with a stored refresh token. Return the new
 * token, or `undefined` to give up (the original error is then thrown).
 */
export type UnauthorizedHandler = (error: UnauthorizedError) => string | undefined | Promise<string | undefined>;

/** The in-flight token refresh per client, shared by concurrent 401s (a WeakMap: private members break the mixin `.d.ts`). */
const inFlightRefresh = new WeakMap<object, Promise<boolean>>();

/** Object types addressable through the batch "list" endpoints. */
export type BatchObjectType = 'track' | 'album' | 'artist' | 'playlist';

/**
 * Carrier of configuration and transport shared by all method groups.
 */
export abstract class ClientBase {
  /**
   * OAuth token used to authenticate requests, if any. Setting it updates the
   * `Authorization` header (clearing it removes the header). Implemented as an
   * accessor installed in the constructor, because a declared accessor inside
   * the mixin base breaks `.d.ts` bundling.
   */
  declare token: string | undefined;
  /** API origin used to build request URLs. */
  baseUrl: string;
  /** Response language code. */
  language: string;
  /** Device descriptor used for queue requests. */
  device: string = DEFAULT_DEVICE;
  /** Whether unknown-field warnings are enabled. */
  reportUnknownFields: boolean;
  /** Optional hook for unmapped-field reports; see {@link ClientOptions.onUnknownField}. */
  onUnknownField?: UnknownFieldReporter;
  /** Account status, populated by {@link Client.init}. */
  me?: Status;
  /** Account uid, populated by {@link Client.init}. */
  accountUid?: number;
  /** Token refresh hook; see {@link ClientOptions.onUnauthorized}. */
  onUnauthorized?: UnauthorizedHandler;
  /** The HTTP transport. */
  readonly request: Request;

  /**
   * @param options - Client configuration.
   */
  constructor(options: ClientOptions = {}) {
    // The accessor writes the backing value only; `setClient` below attaches the header.
    let currentToken = options.token;
    // Non-enumerable: keeps the token out of `JSON.stringify`, spread copies and `console.log`.
    Object.defineProperty(this, 'token', {
      enumerable: false,
      configurable: true,
      get: (): string | undefined => currentToken,
      set: (value: string | undefined): void => {
        currentToken = value;
        if (value) {
          this.request.setAuthorization(value);
        } else {
          this.request.clearAuthorization();
        }
      },
    });
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.language = options.language ?? 'ru';
    this.device = options.device ?? DEFAULT_DEVICE;
    this.reportUnknownFields = options.reportUnknownFields ?? false;
    this.onUnknownField = options.onUnknownField;
    this.onUnauthorized = options.onUnauthorized;

    if (options.request) {
      this.request = options.request;
      this.request.setClient(this as unknown as Client);
    } else {
      this.request = new Request({
        client: this as unknown as Client,
        fetch: options.fetch,
        userAgent: options.userAgent,
        headers: options.headers,
        retries: options.retries,
        retryBaseMs: options.retryBaseMs,
        retryMaxMs: options.retryMaxMs,
        timeout: options.timeout,
        authOrigins: options.authOrigins,
      });
    }
    this.request.setLanguage(this.language);
  }

  /**
   * A view of this client whose requests default to `options` — a caller
   * `signal`, a per-attempt `timeout` and a `retries` budget. The view shares
   * the token, transport, account state and configuration with this client;
   * models it returns keep using the view, so their convenience calls (for
   * example `DownloadInfo.getDirectLink`) inherit the same options.
   *
   * @example
   * ```ts
   * const ctrl = new AbortController();
   * const fast = client.withOptions({ signal: ctrl.signal, timeout: 3000, retries: 0 });
   * const [track] = await fast.tracks(42);
   * ```
   *
   * @param options - Defaults for every request made through the view.
   * @returns The view (same type as this client).
   */
  withOptions(options: RequestOptions): this {
    const view = Object.create(this) as this;
    Object.defineProperty(view, 'request', {
      value: this.request.withOptions(options),
      enumerable: true,
      configurable: true,
      writable: false,
    });
    return view;
  }

  /** Redacted, cycle-free data view: the token is masked. */
  toJSON(): Record<string, unknown> {
    return {
      baseUrl: this.baseUrl,
      language: this.language,
      device: this.device,
      token: this.token ? '[redacted]' : undefined,
      accountUid: this.accountUid,
      request: this.request.toJSON(),
    };
  }

  /** `util.inspect` / `console.log` output with the token redacted. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `Client ${JSON.stringify(this.toJSON())}`;
  }

  /**
   * Refresh the token after a 401 through {@link ClientOptions.onUnauthorized}.
   *
   * @internal Used by the transport and the realtime client; not part of the public API.
   * @param error - The 401 that triggered the refresh.
   * @param failedToken - The token the failed request was sent with. When the
   *   current token already differs (another caller refreshed it meanwhile),
   *   no new refresh is started.
   * @returns Whether a different token is now in place (repeat the request).
   */
  async refreshAuth(error: UnauthorizedError, failedToken?: string): Promise<boolean> {
    if (this.token && this.token !== failedToken) {
      return true;
    }
    const hook = this.onUnauthorized;
    if (!hook) {
      return false;
    }
    let pending = inFlightRefresh.get(this);
    if (!pending) {
      pending = (async (): Promise<boolean> => {
        try {
          const next = await hook(error);
          if (next && next !== failedToken) {
            this.token = next;
            return true;
          }
          return false;
        } catch {
          return false;
        } finally {
          inFlightRefresh.delete(this);
        }
      })();
      inFlightRefresh.set(this, pending);
    }
    return pending;
  }

  /**
   * Resolve a user id, falling back to the account uid set by {@link Client.init}.
   *
   * @internal Used by method mixins; not part of the public API.
   * @throws {IdMissingError} When neither is available.
   */
  resolveUid(userId?: string | number): string | number {
    const uid = userId ?? this.accountUid;
    if (uid === undefined) {
      throw new IdMissingError('userId not given and client.init() not called');
    }
    return uid;
  }

  /**
   * Fetch a batch of objects from a `/{type}s` (or `/playlists/list`) endpoint.
   *
   * @internal Used by the batch-capable method mixins; not part of the public API.
   * @typeParam T - The model type produced by `deJson`.
   * @param objectType - Object kind, used to build the URL and the `{type}-ids` param.
   * @param ids - One or many identifiers.
   * @param deJson - Deserializer for the produced model.
   * @param params - Extra form parameters merged into the request body.
   * @returns The list of deserialized objects.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async getList<T>(
    objectType: BatchObjectType,
    ids: Array<string | number> | string | number,
    deJson: DeJson<T>,
    params: Record<string, string | number> = {},
  ): Promise<T[]> {
    const body: Record<string, string | number | Array<string | number>> = {
      ...params,
      [`${objectType}-ids`]: ids,
    };
    const url = `${this.baseUrl}/${objectType}s${objectType === 'playlist' ? '/list' : ''}`;
    const result = await this.request.send('POST', url, { form: body, retry: true });
    return deList(deJson, result as JSONValue, this as unknown as Client);
  }

  /**
   * Fetch and deserialize a single object from a parameter-less `GET` endpoint —
   * the common shape behind most single-entity method mixins.
   *
   * @internal Used by method mixins; not part of the public API.
   * @typeParam T - The model type produced by `deJson`.
   * @param url - The full request URL.
   * @param deJson - Deserializer for the produced model.
   * @returns The deserialized object, or `null`.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async getModel<T>(url: string, deJson: DeJson<T>): Promise<T | null> {
    const result = await this.request.get(url);
    return deJson(result, this as unknown as Client);
  }
}
