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
import { generateDeviceId } from './messages.js';
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

/**
 * A synchronous snapshot of what is playing right now, pulled from the last
 * received state frame. Unlike the push events, this is available at any time
 * (for example to answer an HTTP request) without waiting for the next frame.
 */
export interface NowPlaying {
  /** The current playable id, or `null` when nothing is playing. */
  playableId: string | null;
  /** The resolved track, when a resolver is configured and resolution succeeded. */
  track: Track | null;
  /** Whether playback is paused. */
  paused: boolean;
  /** Track length in milliseconds. */
  durationMs: number;
  /** Live-extrapolated playback position in milliseconds (see {@link liveProgressMs}). */
  progressMs: number;
  /** The current entity id (album/playlist/…), or `null`. */
  entityId: string | null;
  /** The current entity type, or `null`. */
  entityType: string | null;
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
  /** The session went silent past `staleTimeoutMs` and is being torn down; the
   * argument is how long (ms) no frame had arrived. */
  stale: [number];
  /** The client stopped and will not reconnect. */
  close: [];
}

/** Options for {@link RealtimeClient}. */
export interface RealtimeOptions {
  /** OAuth token. */
  token: string;
  /**
   * Device id. Defaults to a random id generated once and reused across every
   * reconnect. Keeping it stable matters: Ynison deduplicates broadcast by
   * device, so a fresh id per reconnect makes the server drop this observer from
   * the fan-out and the state goes stale.
   */
  deviceId?: string;
  /** Device identity override (defaults to a web SDK identity). */
  deviceInfo?: DeviceInfoOverride | null;
  /** Whether to reconnect automatically. Defaults to `true`. */
  reconnect?: boolean;
  /** Initial reconnect backoff in ms. Defaults to `1000`. */
  reconnectBaseMs?: number;
  /** Maximum reconnect backoff in ms. Defaults to `30000`. */
  reconnectMaxMs?: number;
  /**
   * Force a reconnect when no state frame has arrived for this many ms, even
   * while the socket looks open (a silent broken pipe with no TCP reset). `0`
   * (the default) disables the watchdog. A now-playing watcher typically sets
   * this to ~120000.
   */
  staleTimeoutMs?: number;
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
  /** Stable device id, generated once and reused across reconnects. */
  private readonly deviceId: string;
  private running = false;
  private current: YnisonClient | null = null;
  private lastPlayableId: string | null = null;
  private lastPaused: boolean | null = null;
  private attempt = 0;
  /** Last received state frame, for the synchronous {@link nowPlaying} snapshot. */
  private lastState: YnisonState | null = null;
  /** Last resolved track (when a resolver is configured). */
  private lastTrack: Track | null = null;
  /** `Date.now()` of the last state frame, for {@link lastStateAgeMs}. */
  private lastStateAt = 0;

  constructor(opts: RealtimeOptions) {
    super();
    this.opts = opts;
    this.deviceId = opts.deviceId ?? generateDeviceId();
  }

  /** The stable device id used for every session of this client. */
  get deviceIdValue(): string {
    return this.deviceId;
  }

  /** The last received state frame, or `null` before the first frame. */
  get state(): YnisonState | null {
    return this.lastState;
  }

  /** Milliseconds since the last state frame, or `null` if none arrived yet. */
  get lastStateAgeMs(): number | null {
    return this.lastStateAt > 0 ? Date.now() - this.lastStateAt : null;
  }

  /** Live-extrapolated playback position of the last frame (0 before any frame). */
  liveProgressMs(): number {
    return this.lastState ? liveProgressMs(this.lastState) : 0;
  }

  /**
   * A synchronous snapshot of what is playing right now, or `null` before the
   * first frame. The `progressMs` is live-extrapolated to the moment of the call.
   */
  get nowPlaying(): NowPlaying | null {
    const s = this.lastState;
    if (s === null) {
      return null;
    }
    const idx = s.currentPlayableIndex;
    const playableId =
      idx >= 0 && idx < s.playableList.length ? (s.playableList[idx]?.playableId ?? null) : null;
    return {
      playableId,
      track: playableId === this.lastPlayableId ? this.lastTrack : null,
      paused: s.paused,
      durationMs: s.durationMs,
      progressMs: liveProgressMs(s),
      entityId: s.entityId,
      entityType: s.entityType,
    };
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
        deviceId: this.deviceId,
        deviceInfo: this.opts.deviceInfo ?? null,
      });
      this.current = client;
      this.lastStateAt = Date.now();
      let opened = false;
      client.onState((state) => {
        if (!opened) {
          opened = true;
          this.attempt = 0;
          this.emit('open');
        }
        void this.handleState(state);
      });

      const staleTimer = this.startStaleWatchdog(client);
      let delayMs: number | null = null;
      try {
        await client.connect();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', err);
        delayMs = error instanceof YnisonError && error.retryAfterMs ? error.retryAfterMs : this.backoff();
      } finally {
        if (staleTimer !== null) {
          clearInterval(staleTimer);
        }
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

  /**
   * Poll for silent sessions: if no frame has arrived for `staleTimeoutMs`, tear
   * the socket down so {@link start} reconnects. Returns the timer handle (or
   * `null` when disabled) for the caller to clear.
   */
  private startStaleWatchdog(client: YnisonClient): ReturnType<typeof setInterval> | null {
    const staleMs = this.opts.staleTimeoutMs ?? 0;
    if (staleMs <= 0) {
      return null;
    }
    const tick = Math.max(1000, Math.floor(staleMs / 4));
    return setInterval(() => {
      const idle = Date.now() - this.lastStateAt;
      if (idle > staleMs) {
        this.emit('stale', idle);
        client.disconnect();
      }
    }, tick);
  }

  private async handleState(state: YnisonState): Promise<void> {
    this.lastState = state;
    this.lastStateAt = Date.now();
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
      this.lastTrack = track;
      this.emit('trackChange', { playableId, track });
    }
  }
}
