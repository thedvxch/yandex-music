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
