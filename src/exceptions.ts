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

/**
 * Whether an HTTP status is transient and worth retrying: `408`, `425`, `429`
 * and every `5xx`.
 *
 * @param status - HTTP status code.
 * @returns `true` for a retryable status.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

/** Options accepted by every {@link YandexMusicError} constructor. */
export interface YandexMusicErrorOptions {
  /** The underlying error. */
  cause?: unknown;
  /** HTTP status code. */
  status?: number;
  /** Machine-readable error code. */
  code?: string;
  /** Server-requested wait before retrying, in milliseconds. */
  retryAfterMs?: number;
  /** Override the computed {@link YandexMusicError.retryable}. */
  retryable?: boolean;
}

/** Base class for every error raised by the library. */
export class YandexMusicError extends Error {
  /** Default {@link YandexMusicError.retryable} for errors without an HTTP status. */
  protected static readonly defaultRetryable: boolean = false;
  /** HTTP status code, when the error originates from an HTTP response. */
  readonly status?: number;
  /** Machine-readable error code from the response body (for example the OAuth `error` field). */
  readonly code?: string;
  /** Server-requested wait before retrying (`Retry-After`), in milliseconds. */
  readonly retryAfterMs?: number;
  /**
   * Whether repeating the same operation may succeed. Decided by the HTTP
   * status when there is one (see {@link isRetryableStatus}); otherwise by the
   * error class: transport failures and timeouts are retryable, everything
   * else (bad input, local file-system or crypto failures, cancellation) is not.
   * The transport retries exactly the errors where this is `true`.
   */
  readonly retryable: boolean;

  constructor(message?: string, options?: YandexMusicErrorOptions) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.status = options?.status;
    this.code = options?.code;
    this.retryAfterMs = options?.retryAfterMs;
    this.retryable =
      options?.retryable ??
      (options?.status !== undefined
        ? isRetryableStatus(options.status)
        : (new.target as unknown as { defaultRetryable: boolean }).defaultRetryable);
    // Restore the prototype chain — required when targeting ES5/ES2015 down-level,
    // and harmless otherwise. Also gives every subclass a correct `name`.
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on authentication/authorization failures (HTTP 401/403, invalid token). See {@link ForbiddenError} for 403. */
export class UnauthorizedError extends YandexMusicError {}

/**
 * Raised on HTTP 403: the token is valid but not allowed this resource (region,
 * subscription, foreign content). Subclasses {@link UnauthorizedError} so
 * existing `instanceof UnauthorizedError` checks keep matching; refresh a token
 * only on a plain 401 (`!(e instanceof ForbiddenError)` or `e.status === 401`).
 */
export class ForbiddenError extends UnauthorizedError {}

/** Raised when the API answers 2xx with an unusable body (malformed JSON or XML, an `error` envelope, missing fields). */
export class InvalidResponseError extends YandexMusicError {}

/** Raised when a track is requested with a bitrate/codec that is not available. */
export class InvalidBitrateError extends YandexMusicError {}

/** Raised when an operation needs an identifier that was not provided. */
export class IdMissingError extends YandexMusicError {}

/** Base class for errors caused by communication with the server. Transport failures without a status are retryable. */
export class NetworkError extends YandexMusicError {
  protected static override readonly defaultRetryable: boolean = true;
}

/**
 * Raised on a definitive HTTP 4xx answer (other than auth, 408, 425 and 429).
 * Not retryable. The specific subclasses below cover the common statuses;
 * anything else (405, 422, 451, …) is a plain `ClientError` with `status` set.
 */
export class ClientError extends NetworkError {
  protected static override readonly defaultRetryable: boolean = false;
}

/** Raised when the server rejects a request as malformed (HTTP 400). */
export class BadRequestError extends ClientError {}

/** Raised when the requested resource does not exist (HTTP 404). */
export class NotFoundError extends ClientError {}

/** Raised when the request conflicts with the resource's current state (HTTP 409). Deterministic — retrying an identical request fails the same way. */
export class ConflictError extends ClientError {}

/** Raised when a resource is permanently gone (HTTP 410), for example an expired direct download link. */
export class GoneError extends ClientError {}

/** Raised when the request payload exceeds the server's size limit (HTTP 413). Deterministic — retrying an identical request fails the same way. */
export class PayloadTooLargeError extends ClientError {}

/** Raised when the server throttles the client (HTTP 429). Retryable; see `retryAfterMs`. */
export class TooManyRequestsError extends NetworkError {}

/** Raised on server-side failures (HTTP 5xx). Retryable. */
export class ServerError extends NetworkError {}

/** Raised on HTTP 502. Message stays `Bad Gateway` for compatibility with 0.4.0, which threw a plain {@link NetworkError}. */
export class BadGatewayError extends ServerError {}

/**
 * Raised when the caller cancels an operation through an `AbortSignal`
 * (see `RequestOptions.signal`). Never retried; distinct from {@link TimedOutError}.
 * The signal's `reason` is kept as `cause`.
 */
export class AbortedError extends YandexMusicError {
  constructor(message = 'Aborted', options?: { cause?: unknown }) {
    super(message, { cause: options?.cause, retryable: false });
  }
}

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

/**
 * Raised when Ynison moves the session to another host (codes `300100001` /
 * `300100002`). Not a failure: the realtime client reconnects through the
 * redirector at once, without waiting for the backoff.
 */
export class YnisonRebalancedError extends YnisonServerError {}
