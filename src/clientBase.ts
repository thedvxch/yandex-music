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
import { Request, type FetchLike } from './request.js';
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
}

/** Object types addressable through the batch "list" endpoints. */
export type BatchObjectType = 'track' | 'album' | 'artist' | 'playlist';

/**
 * Carrier of configuration and transport shared by all method groups.
 */
export abstract class ClientBase {
  /** OAuth token used to authenticate requests, if any. */
  token?: string;
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
  /** The HTTP transport. */
  readonly request: Request;

  /**
   * @param options - Client configuration.
   */
  constructor(options: ClientOptions = {}) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.language = options.language ?? 'ru';
    this.device = options.device ?? DEFAULT_DEVICE;
    this.reportUnknownFields = options.reportUnknownFields ?? false;
    this.onUnknownField = options.onUnknownField;

    if (options.request) {
      this.request = options.request;
      this.request.setClient(this as unknown as Client);
    } else {
      this.request = new Request({
        client: this as unknown as Client,
        fetch: options.fetch,
        userAgent: options.userAgent,
        headers: options.headers,
      });
    }
    this.request.setLanguage(this.language);
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
    const result = await this.request.post(url, body);
    return deList(deJson, result as JSONValue, this as unknown as Client);
  }
}
