/**
 * OAuth Device Flow models: {@link DeviceCode} and {@link OAuthToken}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/**
 * Read a value by snake_case key, falling back to its camelCase spelling.
 *
 * The OAuth endpoints (`oauth.yandex.ru`) return snake_case keys, unlike the main
 * Yandex Music API which uses camelCase.
 */
function pick<T extends JSONValue>(raw: Record<string, JSONValue>, snake: string, camel: string): T | undefined {
  const value = raw[snake] ?? raw[camel];
  return value === null || value === undefined ? undefined : (value as T);
}

/**
 * The device/user code pair issued at the start of the OAuth Device Flow.
 *
 * Show {@link DeviceCode.userCode} to the user and direct them to
 * {@link DeviceCode.verificationUrl}; meanwhile poll with
 * {@link DeviceCode.deviceCode}.
 */
export class DeviceCode extends YandexMusicModel {
  /** Code used when polling for the token. */
  deviceCode?: string;
  /** Code the user enters at the verification URL. */
  userCode?: string;
  /** URL the user visits to confirm the login. */
  verificationUrl?: string;
  /** Lifetime of the codes in seconds. */
  expiresIn?: number;
  /** Recommended polling interval in seconds. */
  interval?: number;

  /** @see {@link DeviceCode} */
  static deJson(raw: JSONValue | undefined, client?: Client): DeviceCode | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new DeviceCode(client);
    model.deviceCode = pick(raw, 'device_code', 'deviceCode');
    model.userCode = pick(raw, 'user_code', 'userCode');
    model.verificationUrl = pick(raw, 'verification_url', 'verificationUrl');
    model.expiresIn = pick(raw, 'expires_in', 'expiresIn');
    model.interval = pick(raw, 'interval', 'interval');
    reportUnknown(client, 'DeviceCode', raw, model);
    return model;
  }
}

/** An OAuth token issued once the user confirms the device login. */
export class OAuthToken extends YandexMusicModel {
  /** The access token used as the client `token`. */
  accessToken?: string;
  /** Refresh token, when provided. */
  refreshToken?: string;
  /** Token lifetime in seconds. */
  expiresIn?: number;
  /** Token type, typically `bearer`. */
  tokenType?: string;

  /** @see {@link OAuthToken} */
  static deJson(raw: JSONValue | undefined, client?: Client): OAuthToken | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new OAuthToken(client);
    model.accessToken = pick(raw, 'access_token', 'accessToken');
    model.refreshToken = pick(raw, 'refresh_token', 'refreshToken');
    model.expiresIn = pick(raw, 'expires_in', 'expiresIn');
    model.tokenType = pick(raw, 'token_type', 'tokenType');
    reportUnknown(client, 'OAuthToken', raw, model);
    return model;
  }
}
