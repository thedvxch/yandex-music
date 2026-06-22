/**
 * OAuth Device Flow client methods.
 *
 * Lets an application obtain a Yandex OAuth token without embedding a browser:
 * request a code, show it to the user, and poll until they confirm the login.
 *
 * @packageDocumentation
 */
import { randomBytes } from 'node:crypto';
import { ClientBase } from '../clientBase.js';
import { BadRequestError, DeviceAuthError } from '../exceptions.js';
import { DeviceCode, OAuthToken } from '../models/deviceAuth.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Public OAuth credentials of the official Yandex Music Android app. */
const DEFAULT_CLIENT_ID = '23cabbbdc6cd418abb4b39c32c41195d';
const DEFAULT_CLIENT_SECRET = '53bc75238f0c4d08a118e51fe9203300';
const DEFAULT_DEVICE_NAME = 'YandexMusicAPI';
const OAUTH_BASE_URL = 'https://oauth.yandex.ru';

/** Callback invoked with the device code once it is issued. */
export type OnCodeCallback = (code: DeviceCode) => void | Promise<void>;

/** Options for the blocking device flow (see `deviceAuth`). */
export interface DeviceAuthOptions {
  /** Override the polling interval in seconds (defaults to the server's hint). */
  pollInterval?: number;
  /** Overall timeout in seconds (defaults to the code's lifetime). */
  timeout?: number;
  /** Return `true` to abort polling early. */
  shouldCancel?: () => boolean;
  /** Device id. Defaults to a random 10-character string. */
  deviceId?: string;
  /** Human-readable device name. Defaults to `YandexMusicAPI`. */
  deviceName?: string;
  /** OAuth client id. Defaults to the Android app's id. */
  clientId?: string;
  /** OAuth client secret. Defaults to the Android app's secret. */
  clientSecret?: string;
}

function randomDeviceId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(10);
  let id = '';
  for (let i = 0; i < 10; i += 1) {
    id += alphabet[bytes[i]! % alphabet.length];
  }
  return id;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Adds OAuth Device Flow endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with device-auth methods.
 */
export function DeviceAuthMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class DeviceAuthMethods extends Base {
    /**
     * Request a device/user code pair to start the OAuth Device Flow.
     *
     * @param deviceId - Device id. Defaults to a random 10-character string.
     * @param deviceName - Device name. Defaults to `YandexMusicAPI`.
     * @param clientId - OAuth client id. Defaults to the Android app's id.
     * @returns The issued {@link DeviceCode}.
     * @throws {DeviceAuthError} When the response cannot be parsed.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async requestDeviceCode(deviceId?: string, deviceName?: string, clientId?: string): Promise<DeviceCode> {
      const result = await this.request.post(`${OAUTH_BASE_URL}/device/code`, {
        client_id: clientId ?? DEFAULT_CLIENT_ID,
        device_id: deviceId ?? randomDeviceId(),
        device_name: deviceName ?? DEFAULT_DEVICE_NAME,
      });
      const code = DeviceCode.deJson(result, this as unknown as Client);
      if (!code) {
        throw new DeviceAuthError('failed to parse device code response');
      }
      return code;
    }

    /**
     * Poll once for the token of a pending device authorization.
     *
     * @param deviceCode - The `deviceCode` from `requestDeviceCode`.
     * @param clientId - OAuth client id.
     * @param clientSecret - OAuth client secret.
     * @returns The token, or `null` while the user has not yet confirmed.
     * @throws {DeviceAuthError} On any OAuth error other than `authorization_pending`.
     * @throws {YandexMusicError} On any transport error.
     */
    async pollDeviceToken(
      deviceCode: string,
      clientId?: string,
      clientSecret?: string,
    ): Promise<OAuthToken | null> {
      try {
        const result = await this.request.post(`${OAUTH_BASE_URL}/token`, {
          grant_type: 'device_code',
          code: deviceCode,
          client_id: clientId ?? DEFAULT_CLIENT_ID,
          client_secret: clientSecret ?? DEFAULT_CLIENT_SECRET,
        });
        return OAuthToken.deJson(result, this as unknown as Client);
      } catch (error) {
        if (error instanceof BadRequestError && error.message.includes('authorization_pending')) {
          return null;
        }
        throw error instanceof BadRequestError ? new DeviceAuthError(error.message) : error;
      }
    }

    /**
     * Run the full blocking device flow: request a code, surface it through
     * `onCode`, then poll until the user confirms and a token is returned.
     *
     * @param onCode - Callback receiving the {@link DeviceCode} to show the user.
     * @param options - Polling/timeout configuration and credential overrides.
     * @returns The issued {@link OAuthToken}.
     * @throws {DeviceAuthError} On timeout, cancellation or OAuth error.
     * @throws {YandexMusicError} On any transport error.
     */
    async deviceAuth(onCode: OnCodeCallback, options: DeviceAuthOptions = {}): Promise<OAuthToken> {
      const code = await this.requestDeviceCode(options.deviceId, options.deviceName, options.clientId);
      await onCode(code);

      const intervalMs = (options.pollInterval ?? code.interval ?? 5) * 1000;
      const lifetimeMs = (options.timeout ?? code.expiresIn ?? 0) * 1000;
      const deadline = lifetimeMs > 0 ? Date.now() + lifetimeMs : Number.POSITIVE_INFINITY;

      for (;;) {
        if (options.shouldCancel?.()) {
          throw new DeviceAuthError('device authorization cancelled');
        }
        if (Date.now() > deadline) {
          throw new DeviceAuthError('device authorization timed out');
        }
        const token = await this.pollDeviceToken(code.deviceCode ?? '', options.clientId, options.clientSecret);
        if (token) {
          return token;
        }
        await sleep(intervalMs);
      }
    }
  }

  return DeviceAuthMethods;
}
