/**
 * Error hierarchy raised by the library.
 *
 * Every error thrown by yamuse derives from {@link YandexMusicError}, so a single
 * `catch (e) { if (e instanceof YandexMusicError) ... }` is enough to handle all
 * library-originated failures. Network-related failures additionally derive from
 * {@link NetworkError}.
 *
 * @packageDocumentation
 */

/** Base class for every error raised by the library. */
export class YandexMusicError extends Error {
  constructor(message?: string, options?: { cause?: unknown }) {
    super(message, options);
    // Restore the prototype chain — required when targeting ES5/ES2015 down-level,
    // and harmless otherwise. Also gives every subclass a correct `name`.
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on authentication/authorization failures (HTTP 401/403, invalid token). */
export class UnauthorizedError extends YandexMusicError {}

/** Raised when a track is requested with a bitrate/codec that is not available. */
export class InvalidBitrateError extends YandexMusicError {}

/** Raised when an operation needs an identifier that was not provided. */
export class IdMissingError extends YandexMusicError {}

/** Base class for errors caused by communication with the server. */
export class NetworkError extends YandexMusicError {}

/** Raised when the server rejects a request as malformed (HTTP 400). */
export class BadRequestError extends NetworkError {}

/** Raised when the requested resource does not exist (HTTP 404). */
export class NotFoundError extends NetworkError {}

/** Raised when a request exceeds its timeout. */
export class TimedOutError extends NetworkError {
  constructor(message = 'Timed out') {
    super(message);
  }
}

/**
 * Raised on OAuth Device Flow failures, except the expected `authorization_pending`
 * state which callers are meant to poll through.
 */
export class DeviceAuthError extends YandexMusicError {}

/** Base class for errors related to the Ynison (remote control) protocol. */
export class YnisonError extends YandexMusicError {
  /** When the server sent a "go away" frame, how long to wait before reconnecting (ms). */
  readonly retryAfterMs?: number;

  constructor(message?: string, retryAfterMs?: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}
