/**
 * Request signing used by endpoints that require a track signature
 * (for example lyrics and lossless download info).
 *
 * @packageDocumentation
 */
import { createHmac } from 'node:crypto';
import { YandexMusicError } from './exceptions.js';

/** Signing key extracted from the official Android application. */
export const DEFAULT_SIGN_KEY = 'p93jhgh689SBReK6ghtw62';

/** A computed request signature. */
export interface Sign {
  /** Unix timestamp (seconds) the signature was created at. */
  timestamp: number;
  /** Base64-encoded HMAC-SHA256 signature value. */
  value: string;
}

/**
 * Normalize a track identifier to its numeric form.
 *
 * Identifiers may arrive as a plain id (`"42"`) or in the compound
 * `"{trackId}:{albumId}"` form; both collapse to the numeric track id.
 *
 * @param trackId - The track identifier, numeric or string.
 * @returns The numeric track id.
 */
export function convertTrackIdToNumber(trackId: string | number): number {
  if (typeof trackId === 'string') {
    const numeric = Number.parseInt(trackId.split(':')[0]!, 10);
    if (Number.isNaN(numeric)) {
      throw new YandexMusicError(`Invalid track id: ${JSON.stringify(trackId)}`);
    }
    return numeric;
  }
  return trackId;
}

/**
 * Create a signature for a track-scoped request.
 *
 * The signature is `HMAC-SHA256(key, "{trackId}{timestamp}")` encoded as Base64,
 * matching the scheme used by the Android client.
 *
 * @param trackId - The track the request is scoped to.
 * @param key - The signing key. Defaults to {@link DEFAULT_SIGN_KEY}.
 * @returns The timestamp/value pair to send alongside the request.
 */
export function getSignRequest(trackId: string | number, key: string = DEFAULT_SIGN_KEY): Sign {
  const numericId = convertTrackIdToNumber(trackId);
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${numericId}${timestamp}`;
  const value = createHmac('sha256', key).update(message, 'utf8').digest('base64');

  return { timestamp, value };
}

/** Signing key used by the desktop client for `/get-file-info`. Bound to {@link DESKTOP_CLIENT}. */
export const DESKTOP_SIGN_KEY = 'kzqU4XhfCaY6B6JTHODeq5';

/** `X-Yandex-Music-Client` header value that {@link DESKTOP_SIGN_KEY} is bound to. */
export const DESKTOP_CLIENT = 'YandexMusicDesktopAppWindows/5.95.0';

/** Codecs requested from `/get-file-info`, in the order the desktop client sends them. */
export const FILE_INFO_CODECS_LIST: readonly string[] = [
  'flac',
  'flac-mp4',
  'aac-mp4',
  'he-aac-mp4',
  'aac',
  'he-aac',
  'mp3',
];

/** Comma-joined form of {@link FILE_INFO_CODECS_LIST}, as sent in the query. */
export const FILE_INFO_CODECS = FILE_INFO_CODECS_LIST.join(',');

/** Default transport requested from `/get-file-info`. `encraw` returns an AES-CTR-encrypted stream. */
export const FILE_INFO_TRANSPORT = 'encraw';

/** A computed `/get-file-info` signature. */
export interface FileInfoSign {
  /** Unix timestamp (seconds) the signature was created at. */
  ts: number;
  /** Base64-encoded HMAC-SHA256 signature value (last character dropped). */
  value: string;
}

/**
 * Create the signature for a `/get-file-info` request.
 *
 * The signature is `HMAC-SHA256(key, "{ts}{trackId}{quality}{codecs}{transport}")`
 * with the codecs joined without commas, Base64-encoded, with the trailing
 * character removed. The track id is used exactly as it will be sent in the query
 * (no numeric conversion), and the request must carry the `X-Yandex-Music-Client`
 * header the key is bound to ({@link DESKTOP_CLIENT} for {@link DESKTOP_SIGN_KEY}).
 *
 * @param trackId - The track the request is scoped to, as sent in the query.
 * @param quality - Requested quality (for example `lossless`). Defaults to `lossless`.
 * @param codecs - Requested codecs, as a list or a comma-separated string. Defaults to {@link FILE_INFO_CODECS_LIST}.
 * @param transport - Requested transport. Defaults to {@link FILE_INFO_TRANSPORT}.
 * @param key - The signing key. Defaults to {@link DESKTOP_SIGN_KEY}.
 * @returns The timestamp/value pair to send alongside the request.
 */
export function getFileInfoSign(
  trackId: string | number,
  quality = 'lossless',
  codecs: string | readonly string[] = FILE_INFO_CODECS_LIST,
  transport: string = FILE_INFO_TRANSPORT,
  key: string = DESKTOP_SIGN_KEY,
): FileInfoSign {
  const ts = Math.floor(Date.now() / 1000);
  const codecText = typeof codecs === 'string' ? codecs.replace(/,/g, '') : codecs.join('');
  const message = `${ts}${String(trackId)}${quality}${codecText}${transport}`;
  const value = createHmac('sha256', key).update(message, 'utf8').digest('base64').slice(0, -1);

  return { ts, value };
}
