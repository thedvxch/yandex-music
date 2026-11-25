/**
 * Helpers that read a {@link YnisonState}: playback order, active device and
 * live progress. Ports of the reference `ynison/utils.py`.
 *
 * @packageDocumentation
 */
import type { YnisonDevice, YnisonState } from './client.js';
import { YnisonNoActiveDeviceError } from './errors.js';

/**
 * The queue indices in playback order. With shuffle on, this is the server's
 * `playableIndices`; otherwise `0..n-1`.
 */
export function getPlaybackOrder(state: YnisonState): number[] {
  const total = state.playableList.length;
  const shuffle = state.shuffleIndices ?? [];
  return shuffle.length > 0 && shuffle.length === total ? [...shuffle] : Array.from({ length: total }, (_, i) => i);
}

/**
 * The queue index `delta` steps away from the current one in playback order, or
 * `null` when that is outside the queue or the current index is not in the order.
 */
export function getNeighbourIndex(state: YnisonState, delta: number): number | null {
  const order = getPlaybackOrder(state);
  const position = order.indexOf(state.currentPlayableIndex);
  if (position === -1) return null;
  const next = position + delta;
  return next >= 0 && next < order.length ? (order[next] as number) : null;
}

/**
 * Playback position extrapolated to `nowMs` while playing, capped at the
 * duration when it is known.
 */
export function getCurrentProgressMs(state: YnisonState, nowMs: number = Date.now()): number {
  let progress = state.progressMs;
  if (!state.paused && state.timestampMs > 0) {
    const speed = state.playbackSpeed !== 0 ? state.playbackSpeed : 1;
    progress += Math.trunc(Math.max(0, nowMs - state.timestampMs) * speed);
  }
  if (state.durationMs > 0) progress = Math.min(progress, state.durationMs);
  return progress;
}

/**
 * The active (playing) device.
 *
 * @throws {YnisonNoActiveDeviceError} When the state names no active device or it is not in the device list.
 */
export function getActiveDevice(state: YnisonState): YnisonDevice {
  const id = state.activeDeviceId;
  const device = id ? state.devices?.find((d) => d.deviceId === id) : undefined;
  if (!device) throw new YnisonNoActiveDeviceError('no active Ynison device');
  return device;
}
