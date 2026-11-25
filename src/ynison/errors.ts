/**
 * Errors specific to Ynison player commands.
 *
 * @packageDocumentation
 */
import { YnisonError } from '../exceptions.js';

/** Raised when a volume command needs an active device and the server reports none. */
export class YnisonNoActiveDeviceError extends YnisonError {}

/** Raised when next/previous would move outside the playback queue. */
export class YnisonQueueBoundaryError extends YnisonError {}
