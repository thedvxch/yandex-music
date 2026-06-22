/**
 * Request signing used by endpoints that require a track signature
 * (for example lyrics and lossless download info).
 *
 * @packageDocumentation
 */
import { createHmac } from 'node:crypto';

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
    return Number.parseInt(trackId.split(':')[0]!, 10);
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

/** Codecs requested from `/get-file-info`, in the order the Android client sends them. */
export const FILE_INFO_CODECS = 'flac,flac-mp4,mp3,aac,he-aac,aac-mp4,he-aac-mp4';

/** Transport requested from `/get-file-info`. `encraw` returns an AES-CTR-encrypted stream. */
export const FILE_INFO_TRANSPORT = 'encraw';

/** A computed `/get-file-info` signature. */
export interface FileInfoSign {
  /** Unix timestamp (seconds) the signature was created at. */
  ts: number;
  /** Base64-encoded HMAC-SHA256 signature value (last character dropped). */
  value: string;
}

/**
 * Create the signature for a `/get-file-info` (lossless download) request.
 *
 * The signature is `HMAC-SHA256(key, "{ts}{trackId}{quality}{codecs}{transport}")`
 * with commas stripped, Base64-encoded, with the trailing character removed —
 * matching the Android client. The same `codecs`/`transport` strings must be sent
 * in the query for the signature to validate.
 *
 * @param trackId - The track the request is scoped to.
 * @param quality - Requested quality (for example `lossless`). Defaults to `lossless`.
 * @param codecs - Requested codecs string. Defaults to {@link FILE_INFO_CODECS}.
 * @param transport - Requested transport string. Defaults to {@link FILE_INFO_TRANSPORT}.
 * @param key - The signing key. Defaults to {@link DEFAULT_SIGN_KEY}.
 * @returns The timestamp/value pair to send alongside the request.
 */
export function getFileInfoSign(
  trackId: string | number,
  quality = 'lossless',
  codecs: string = FILE_INFO_CODECS,
  transport: string = FILE_INFO_TRANSPORT,
  key: string = DEFAULT_SIGN_KEY,
): FileInfoSign {
  const numericId = convertTrackIdToNumber(trackId);
  const ts = Math.floor(Date.now() / 1000);
  const message = `${ts}${numericId}${quality}${codecs}${transport}`.replace(/,/g, '');
  const value = createHmac('sha256', key).update(message, 'utf8').digest('base64').slice(0, -1);

  return { ts, value };
}
