/**
 * URL path helpers.
 *
 * @packageDocumentation
 */

/**
 * Encode a value for use as one URL path segment.
 *
 * Applies `encodeURIComponent`, so `/`, `?`, `#`, `%` and spaces in an id can no
 * longer change which authenticated endpoint a request hits, and encodes the
 * dot-segments `.` / `..` that URL normalization would otherwise resolve. `:`,
 * `,` and `@` stay literal: they are valid in a path segment (RFC 3986 `pchar`)
 * and appear in real ids such as `trackId:albumId` or `owner:kind`.
 *
 * @internal Used by method mixins; not part of the public API.
 * @param value - The id or name to embed.
 * @returns The encoded segment.
 */
export function pathSegment(value: string | number): string {
  const text = String(value);
  if (text === '.' || text === '..') {
    return text.replace(/\./g, '%2E');
  }
  return encodeURIComponent(text).replace(/%3A/gi, ':').replace(/%2C/gi, ',').replace(/%40/gi, '@');
}
