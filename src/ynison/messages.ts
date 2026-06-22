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
import { randomUUID } from 'node:crypto';

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

/** Generate a random device id (`hex(floor(1e16 * random()))`). */
export function generateDeviceId(): string {
  return Math.floor(10 ** 16 * Math.random()).toString(16);
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
        title: deviceInfo.title ?? 'Python SDK',
        type: deviceInfo.type,
        appName: deviceInfo.appName,
        ...(deviceInfo.appVersion ? { appVersion: deviceInfo.appVersion } : {}),
      }
    : { deviceId, title: 'Python SDK', type: 'WEB', appName: 'yandex-music' };
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

/** An Android client identity that makes the server expose richer state. */
export const ANDROID_DEVICE_INFO: DeviceInfoOverride = {
  type: 'ANDROID',
  headerType: '2',
  appName: 'ru.yandex.music',
  appVersion: '2026.05.3',
  title: 'yandex-music',
};
