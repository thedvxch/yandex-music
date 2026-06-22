/**
 * High-level realtime ("now playing") API over Ynison.
 *
 * @remarks
 * {@link RealtimeClient} wraps {@link YnisonClient} in a typed `EventEmitter` that
 * handles the handshake, keep-alive and reconnection for you, emitting friendly
 * events (`trackChange`, `playStateChange`, `state`). It is the recommended way to
 * receive realtime player updates — Yandex Music has no HTTP webhooks, so this
 * WebSocket stream is the only server-push channel.
 *
 * @packageDocumentation
 */
import { EventEmitter } from 'node:events';
import { YnisonError } from '../exceptions.js';
import { YnisonClient } from './client.js';
import type { YnisonState } from './client.js';
import type { DeviceInfoOverride } from './messages.js';
import type { Track } from '../models/track/track.js';

/** Compute the live playback position, extrapolating from the last server timestamp. */
export function liveProgressMs(state: YnisonState): number {
  if (state.paused || !state.timestampMs) {
    return Math.max(0, state.progressMs);
  }
  const elapsed = (Date.now() - state.timestampMs) * state.playbackSpeed;
  const progress = state.progressMs + elapsed;
  return Math.max(0, Math.min(progress, state.durationMs || progress));
}

/** A track-change event. */
export interface TrackChangeEvent {
  /** The new current playable id. */
  playableId: string;
  /** The resolved track, when a resolver is configured. */
  track: Track | null;
}

/** The events emitted by {@link RealtimeClient}. */
export interface RealtimeEvents {
  /** A session was established (handshake completed). */
  open: [];
  /** A raw player-state frame arrived. */
  state: [YnisonState];
  /** The current track changed. */
  trackChange: [TrackChangeEvent];
  /** Playback was paused or resumed. */
  playStateChange: [boolean];
  /** A recoverable error occurred; the client will reconnect if running. */
  error: [Error];
  /** A reconnection is scheduled after the given delay (ms). */
  reconnect: [number];
  /** The client stopped and will not reconnect. */
  close: [];
}

/** Options for {@link RealtimeClient}. */
export interface RealtimeOptions {
  /** OAuth token. */
  token: string;
  /** Device id. Defaults to a random id. */
  deviceId?: string;
  /** Device identity override (defaults to a web SDK identity). */
  deviceInfo?: DeviceInfoOverride | null;
  /** Whether to reconnect automatically. Defaults to `true`. */
  reconnect?: boolean;
  /** Initial reconnect backoff in ms. Defaults to `1000`. */
  reconnectBaseMs?: number;
  /** Maximum reconnect backoff in ms. Defaults to `30000`. */
  reconnectMaxMs?: number;
  /** Optional resolver mapping a playable id to a {@link Track} for `trackChange`. */
  resolveTrack?: (playableId: string) => Promise<Track | null>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A reconnecting, event-emitting realtime client for Ynison player state.
 *
 * @example
 * ```ts
 * const rt = client.realtime();
 * rt.on('trackChange', ({ track }) => console.log('now playing:', track?.title));
 * rt.on('playStateChange', (paused) => console.log(paused ? 'paused' : 'playing'));
 * await rt.start();
 * // ... later
 * rt.stop();
 * ```
 */
export class RealtimeClient extends EventEmitter {
  private readonly opts: RealtimeOptions;
  private running = false;
  private current: YnisonClient | null = null;
  private lastPlayableId: string | null = null;
  private lastPaused: boolean | null = null;
  private attempt = 0;

  constructor(opts: RealtimeOptions) {
    super();
    this.opts = opts;
  }

  override on<E extends keyof RealtimeEvents>(event: E, listener: (...args: RealtimeEvents[E]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override once<E extends keyof RealtimeEvents>(event: E, listener: (...args: RealtimeEvents[E]) => void): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  override off<E extends keyof RealtimeEvents>(event: E, listener: (...args: RealtimeEvents[E]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  override emit<E extends keyof RealtimeEvents>(event: E, ...args: RealtimeEvents[E]): boolean {
    return super.emit(event, ...args);
  }

  /** Whether the client is currently running. */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Start the realtime loop. Resolves once stopped (so it can be awaited as a
   * long-running task, or fired and forgotten).
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    while (this.running) {
      const client = new YnisonClient({
        token: this.opts.token,
        ...(this.opts.deviceId !== undefined ? { deviceId: this.opts.deviceId } : {}),
        deviceInfo: this.opts.deviceInfo ?? null,
      });
      this.current = client;
      let opened = false;
      client.onState((state) => {
        if (!opened) {
          opened = true;
          this.attempt = 0;
          this.emit('open');
        }
        void this.handleState(state);
      });

      let delayMs: number | null = null;
      try {
        await client.connect();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        delayMs = error instanceof YnisonError && error.retryAfterMs ? error.retryAfterMs : this.backoff();
      } finally {
        client.disconnect();
        this.current = null;
      }

      if (!this.running || this.opts.reconnect === false) {
        break;
      }
      const wait = delayMs ?? this.backoff();
      this.emit('reconnect', wait);
      await sleep(wait);
    }
    this.running = false;
    this.emit('close');
  }

  /** Stop the realtime loop and close the connection. */
  stop(): void {
    this.running = false;
    this.current?.disconnect();
    this.current = null;
  }

  private backoff(): number {
    const base = this.opts.reconnectBaseMs ?? 1000;
    const max = this.opts.reconnectMaxMs ?? 30_000;
    const delay = Math.min(max, base * 2 ** this.attempt);
    this.attempt += 1;
    return delay;
  }

  private async handleState(state: YnisonState): Promise<void> {
    this.emit('state', state);

    if (this.lastPaused === null || state.paused !== this.lastPaused) {
      this.lastPaused = state.paused;
      this.emit('playStateChange', state.paused);
    }

    const idx = state.currentPlayableIndex;
    const playableId =
      idx >= 0 && idx < state.playableList.length ? (state.playableList[idx]?.playableId ?? null) : null;
    if (playableId && playableId !== this.lastPlayableId) {
      this.lastPlayableId = playableId;
      let track: Track | null = null;
      if (this.opts.resolveTrack) {
        try {
          track = await this.opts.resolveTrack(playableId);
        } catch (error) {
          this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
      }
      this.emit('trackChange', { playableId, track });
    }
  }
}
