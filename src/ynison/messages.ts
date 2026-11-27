/**
 * Builders for Ynison WebSocket requests.
 *
 * @remarks
 * The protocol is betterproto's `.to_json()` shape: camelCase keys, int64 values
 * as strings, and default values (`0`, `''`, `false`, enum `0`) omitted. The
 * literals below mirror that exactly.
 *
 * @packageDocumentation
 */
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { YnisonError } from '../exceptions.js';
import type { YnisonState } from './client.js';
import { YnisonQueueBoundaryError } from './errors.js';
import { getCurrentProgressMs, getNeighbourIndex } from './utils.js';

/**
 * Device identity override for the full-state request.
 *
 * @remarks
 * Presenting as a known app (for example the Android client) makes the server
 * expose more state fields than it does for an anonymous web client.
 */
export interface DeviceInfoOverride {
  /** Device type for the request body (`device.info.type`): `WEB` | `ANDROID` | … */
  type: string;
  /** Numeric code for the `Ynison-Device-Info` header (`1` = web, `2` = android). */
  headerType: string;
  /** App name. */
  appName: string;
  /** App version. */
  appVersion?: string;
  /** Device title. */
  title?: string;
}

/** Generate a random device id (8 cryptographically-random bytes as hex). */
export function generateDeviceId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Derive a stable device id from a token: the first 12 hex chars of
 * `sha256('yandex-music-ynison:' + token)`.
 *
 * @remarks
 * Two watchers using the same derived id on one token displace each other
 * (server code `400090001`), which is why {@link generateDeviceId} stays the default.
 */
export function deviceIdFromToken(token: string): string {
  return createHash('sha256').update(`yandex-music-ynison:${token}`).digest('hex').slice(0, 12);
}

/** Generate a request id (a UUID v4). */
export function generateRequestId(): string {
  return randomUUID();
}

/** The shape of an `UpdateFullState` request (betterproto JSON, defaults omitted). */
export interface UpdateFullStateRequest {
  updateFullState: {
    playerState: {
      status: { paused: true; playbackSpeed: 1; version: { deviceId: string } };
      playerQueue: {
        entityType: 'VARIOUS';
        currentPlayableIndex: -1;
        options: { repeatMode: 'NONE' };
        version: { deviceId: string };
        fromOptional: '';
      };
    };
    device: {
      info: { deviceId: string; title: string; type: string; appName: string; appVersion?: string };
      capabilities: { canBeRemoteController: true };
      volumeInfo: Record<string, never>;
    };
  };
  rid: string;
}

/**
 * Build the initial request that registers the device as a remote controller
 * with an empty queue. Sent immediately after the state socket opens.
 *
 * @param deviceId - The device id used throughout the session.
 * @param deviceInfo - Optional identity override (defaults to a web SDK identity).
 * @returns The request payload.
 */
export function buildUpdateFullStateRequest(
  deviceId: string,
  deviceInfo: DeviceInfoOverride | null = null,
): UpdateFullStateRequest {
  const info: UpdateFullStateRequest['updateFullState']['device']['info'] = deviceInfo
    ? {
        deviceId,
        title: deviceInfo.title ?? 'Node.js SDK',
        type: deviceInfo.type,
        appName: deviceInfo.appName,
        ...(deviceInfo.appVersion ? { appVersion: deviceInfo.appVersion } : {}),
      }
    : { deviceId, title: 'Node.js SDK', type: 'WEB', appName: 'yandex-music' };
  return {
    updateFullState: {
      playerState: {
        status: { paused: true, playbackSpeed: 1, version: { deviceId } },
        playerQueue: {
          entityType: 'VARIOUS',
          currentPlayableIndex: -1,
          options: { repeatMode: 'NONE' },
          version: { deviceId },
          fromOptional: '',
        },
      },
      device: {
        info,
        capabilities: { canBeRemoteController: true },
        volumeInfo: {},
      },
    },
    rid: generateRequestId(),
  };
}

/** Android app version reported by {@link ANDROID_DEVICE_INFO} (Google Play release of 2026-11). */
export const YNISON_ANDROID_APP_VERSION = '2026.11.1';

/** An Android client identity that makes the server expose richer state. */
export const ANDROID_DEVICE_INFO: DeviceInfoOverride = {
  type: 'ANDROID',
  headerType: '2',
  appName: 'ru.yandex.music',
  appVersion: YNISON_ANDROID_APP_VERSION,
  title: 'yandex-music',
};

/**
 * The Android identity with overrides, for example a different `appVersion`
 * once the default ages: `androidDeviceInfo({ appVersion: '2027.01.1' })`.
 *
 * @param overrides - Fields replacing those of {@link ANDROID_DEVICE_INFO}.
 * @returns A new identity object.
 */
export function androidDeviceInfo(overrides: Partial<DeviceInfoOverride> = {}): DeviceInfoOverride {
  return { ...ANDROID_DEVICE_INFO, ...overrides };
}

/** Optional overrides that make command builders deterministic (tests). */
export interface CommandBuildOptions {
  /** Current time in ms. Defaults to `Date.now()`. */
  nowMs?: number;
  /** Request id. Defaults to a fresh UUID. */
  rid?: string;
  /** Version counter (an int64 as a string). Defaults to a random 18-digit number. */
  version?: string;
}

/** A command frame: a `PutYnisonStateRequest` body in betterproto JSON. */
export type YnisonCommandRequest = Record<string, unknown> & {
  rid: string;
  playerActionTimestampMs: string;
  activityInterceptionType: 'DO_NOT_INTERCEPT_BY_DEFAULT';
};

function newVersion(deviceId: string, opts: CommandBuildOptions): { deviceId: string; version: string; timestampMs: string } {
  return {
    deviceId,
    version: opts.version ?? String(Math.floor(Math.random() * 1e18)),
    timestampMs: String(opts.nowMs ?? Date.now()),
  };
}

function wrapRequest(body: Record<string, unknown>, opts: CommandBuildOptions): YnisonCommandRequest {
  return {
    ...body,
    rid: opts.rid ?? generateRequestId(),
    playerActionTimestampMs: String(opts.nowMs ?? Date.now()),
    activityInterceptionType: 'DO_NOT_INTERCEPT_BY_DEFAULT',
  };
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** Deep-convert object keys from snake_case to camelCase (the wire format used here). */
function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [snakeToCamel(k), camelizeKeys(v)]));
  }
  return value;
}

/**
 * Build the `updatePlayingStatus` request that pauses or resumes playback.
 * The position is recomputed to `nowMs` and the duration is kept.
 */
export function buildSetPausedRequest(
  deviceId: string,
  state: YnisonState,
  paused: boolean,
  opts: CommandBuildOptions = {},
): YnisonCommandRequest {
  return wrapRequest(
    {
      updatePlayingStatus: {
        playingStatus: {
          progressMs: String(getCurrentProgressMs(state, opts.nowMs)),
          durationMs: String(state.durationMs),
          paused,
          playbackSpeed: state.playbackSpeed !== 0 ? state.playbackSpeed : 1,
          version: newVersion(deviceId, opts),
        },
      },
    },
    opts,
  );
}

/**
 * Build the `updatePlayerState` request that moves `delta` tracks in playback
 * order. The queue is cloned with a new `currentPlayableIndex`; progress and
 * duration reset to 0 and the pause flag is kept.
 *
 * @throws {YnisonQueueBoundaryError} When the move leaves the queue.
 * @throws {YnisonError} When the state carries no raw queue.
 */
export function buildChangeTrackRequest(
  deviceId: string,
  state: YnisonState,
  delta: number,
  opts: CommandBuildOptions = {},
): YnisonCommandRequest {
  const newIndex = getNeighbourIndex(state, delta);
  if (newIndex === null) {
    throw new YnisonQueueBoundaryError(
      `cannot move ${delta > 0 ? '+' : ''}${delta} from track ${state.currentPlayableIndex} in a queue of ${state.playableList.length}`,
    );
  }
  const playerState = asRecord(state.raw?.['player_state'] ?? state.raw?.['playerState']);
  const rawQueue = asRecord(playerState?.['player_queue'] ?? playerState?.['playerQueue']);
  if (!rawQueue) throw new YnisonError('state frame has no player queue to clone');
  const queue = camelizeKeys(rawQueue) as Record<string, unknown>;
  return wrapRequest(
    {
      updatePlayerState: {
        playerState: {
          playerQueue: { ...queue, currentPlayableIndex: newIndex, version: newVersion(deviceId, opts) },
          status: {
            progressMs: '0',
            durationMs: '0',
            paused: state.paused,
            playbackSpeed: state.playbackSpeed !== 0 ? state.playbackSpeed : 1,
            version: newVersion(deviceId, opts),
          },
        },
      },
    },
    opts,
  );
}

/** Build the `updateVolumeInfo` request; `volume` is clamped to `0..1`. */
export function buildSetVolumeRequest(
  deviceId: string,
  targetDeviceId: string,
  volume: number,
  opts: CommandBuildOptions = {},
): YnisonCommandRequest {
  return wrapRequest(
    {
      updateVolumeInfo: {
        deviceId: targetDeviceId,
        volumeInfo: { volume: Math.max(0, Math.min(1, volume)), version: newVersion(deviceId, opts) },
      },
    },
    opts,
  );
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}
