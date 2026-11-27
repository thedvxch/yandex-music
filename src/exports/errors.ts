/** Public exports: errors. */
export {
  YandexMusicError,
  UnauthorizedError,
  InvalidBitrateError,
  IdMissingError,
  NetworkError,
  BadRequestError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  TooManyRequestsError,
  ServerError,
  TimedOutError,
  AbortedError,
  DeviceAuthError,
  YnisonError,
  YnisonServerError,
  YnisonUnauthorizedError,
  YnisonDeviceDisplacedError,
  YnisonTimeoutError,
  YnisonConnectionClosedError,
} from '../exceptions.js';
export type { YnisonServerErrorOptions } from '../exceptions.js';
