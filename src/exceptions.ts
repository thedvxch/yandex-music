/**
 * Error hierarchy raised by the library.
 *
 * Every error thrown by this library derives from {@link YandexMusicError}, so a single
 * `catch (e) { if (e instanceof YandexMusicError) ... }` is enough to handle all
 * library-originated failures. Network-related failures additionally derive from
 * {@link NetworkError}.
 *
 * @packageDocumentation
 */

/** Base class for every error raised by the library. */
export class YandexMusicError extends Error {
  /** HTTP status code, when the error originates from an HTTP response. */
  readonly status?: number;
  /** Machine-readable error code from the response body (for example the OAuth `error` field). */
  readonly code?: string;
  /** Server-requested wait before retrying (`Retry-After`), in milliseconds. */
  readonly retryAfterMs?: number;

  constructor(
    message?: string,
    options?: { cause?: unknown; status?: number; code?: string; retryAfterMs?: number },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.status = options?.status;
    this.code = options?.code;
    this.retryAfterMs = options?.retryAfterMs;
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

/** Raised when the request conflicts with the resource's current state (HTTP 409). Deterministic — retrying an identical request fails the same way. */
export class ConflictError extends NetworkError {}

/** Raised when the request payload exceeds the server's size limit (HTTP 413). Deterministic — retrying an identical request fails the same way. */
export class PayloadTooLargeError extends NetworkError {}

/** Raised when the server throttles the client (HTTP 429). Retryable; see `retryAfterMs`. */
export class TooManyRequestsError extends NetworkError {}

/** Raised on server-side failures (HTTP 5xx). Retryable. */
export class ServerError extends NetworkError {}

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
  constructor(message?: string, retryAfterMs?: number) {
    super(message, { retryAfterMs });
  }
}

/** Raised when a Ynison handshake step does not complete within its timeout. */
export class YnisonTimeoutError extends YnisonError {}

/** Raised when the Ynison connection is lost or is not open. */
export class YnisonConnectionClosedError extends YnisonError {}

/** Options for {@link YnisonServerError}. */
export interface YnisonServerErrorOptions {
  /** gRPC status code from the error frame. */
  grpcCode?: number;
  /** HTTP status code from the error frame. */
  httpCode?: number;
  /** Value of `ynison-error-code`. */
  errorCode?: string;
  /** Reconnect delay ladder (ms) from `ynison-backoff-millis`. */
  backoffMs?: number[];
  /** Value of `ynison-go-away-for-seconds`. */
  goAwaySeconds?: number;
}

/** Raised when the Ynison server answers with an error frame. */
export class YnisonServerError extends YnisonError {
  /** gRPC status code from the error frame. */
  readonly grpcCode?: number;
  /** HTTP status code from the error frame. */
  readonly httpCode?: number;
  /** Value of `ynison-error-code`. */
  readonly errorCode?: string;
  /** Reconnect delay ladder (ms) the server asks for; empty when absent. */
  readonly backoffMs: number[];
  /** Seconds the server asks the client to stay away for. */
  readonly goAwaySeconds?: number;

  constructor(message?: string, options: YnisonServerErrorOptions = {}) {
    super(message, options.goAwaySeconds ? options.goAwaySeconds * 1000 : undefined);
    this.grpcCode = options.grpcCode;
    this.httpCode = options.httpCode;
    this.errorCode = options.errorCode;
    this.backoffMs = options.backoffMs ?? [];
    this.goAwaySeconds = options.goAwaySeconds;
  }
}

/** Raised when Ynison rejects the token (gRPC 16/7 or HTTP 401/403). Terminal for the realtime client. */
export class YnisonUnauthorizedError extends YnisonServerError {}

/** Raised when another client with the same device id displaced this one (code `400090001`). Terminal for the realtime client. */
export class YnisonDeviceDisplacedError extends YnisonServerError {}
