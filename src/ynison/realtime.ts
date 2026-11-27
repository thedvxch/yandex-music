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
import {
  YnisonConnectionClosedError,
  YnisonDeviceDisplacedError,
  YnisonError,
  YnisonRebalancedError,
  YnisonServerError,
  YnisonUnauthorizedError,
} from '../exceptions.js';
import { YnisonClient, resolveToken } from './client.js';
import type { TokenSource, YnisonClientOptions, YnisonState } from './client.js';
import { generateDeviceId } from './messages.js';
import type { DeviceInfoOverride } from './messages.js';
import type { Track } from '../models/track/track.js';

const DEFAULT_BACKOFF_MS = [0, 1000, 5000, 30_000];

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
  /** The client stopped and will not reconnect. The argument is the terminal error that ended the loop, if any (see {@link RealtimeClient.terminalError}). */
  close: [terminalError?: Error | null];
}

/** Options for {@link RealtimeClient}. */
export interface RealtimeOptions {
  /**
   * OAuth token, or a provider evaluated before every (re)connect so a rotated
   * token is picked up. `Client.realtime()` passes a provider reading `client.token`.
   */
  token: TokenSource;
  /**
   * Called once when Ynison rejects the token; return a fresh token to reconnect
   * with it instead of stopping. `Client.realtime()` wires this to
   * `ClientOptions.onUnauthorized`. When the token provider already returns a
   * different token, the client reconnects without calling this.
   */
  onUnauthorized?: () => string | undefined | Promise<string | undefined>;
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
  /**
   * Minimum reconnect delay in ms. Unset by default: the delay then follows the
   * schedule `[0, 1000, 5000, 30000]` (or the ladder the server sent) plus 0-250 ms
   * of jitter.
   */
  reconnectBaseMs?: number;
  /** Cap for the reconnect delay (schedule and server ladder) in ms. Defaults to `30000`. */
  reconnectMaxMs?: number;
  /**
   * Extra options passed to every {@link YnisonClient} (`redirectUrl`, `stateUrl`,
   * `connectTimeoutMs`). `token`, `deviceId` and `deviceInfo` are set by this client.
   */
  ynison?: Partial<YnisonClientOptions>;
  /**
   * Maximum delay (ms) to honour from a server "go-away" frame before retrying.
   * Defaults to `60000`. Ynison sometimes answers "temporary unavailable" with a
   * go-away of an hour or more; capping it lets a watcher recover within a minute
   * of the service returning instead of staying dead for the full hour, while a
   * single retry per cap interval is gentle enough not to hammer the server.
   */
  goAwayMaxMs?: number;
  /**
   * Force a reconnect when the WebSocket shows no activity — no frame, ping or
   * pong — for this many ms, which means a silently broken pipe with no TCP
   * reset. `0` (the default) disables the watchdog. A now-playing watcher
   * typically sets this to ~120000.
   *
   * @remarks
   * This watches transport liveness (kept fresh by the ~20s keep-alive
   * ping/pong), not state-frame arrival: Ynison only pushes a state frame on an
   * actual state change, so a paused or idle player is legitimately silent for
   * minutes while the connection is perfectly healthy. Tearing such a connection
   * down on state-frame silence triggers a reconnect storm that the server
   * answers with rate-limiting and host rebalancing.
   */
  staleTimeoutMs?: number;
  /**
   * A session counts as stable once it stayed open this many ms (default `5000`):
   * only then the reconnect attempt counter and a server backoff ladder are reset.
   * After a shorter session the next reconnect waits at least 1000 ms, so a server
   * that accepts and immediately drops the socket is not hammered.
   */
  stableSessionMs?: number;
  /** Optional resolver mapping a playable id to a {@link Track} for `trackChange`. */
  resolveTrack?: (playableId: string) => Promise<Track | null>;
}

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
  /** The terminal error that ended the loop, if any. */
  private terminal: Error | null = null;
  /** Last received state frame, for the synchronous {@link nowPlaying} snapshot. */
  private lastState: YnisonState | null = null;
  /** Last resolved track (when a resolver is configured). */
  private lastTrack: Track | null = null;
  /** Playable id `lastTrack` was resolved for — set together with `lastTrack`,
   * one tick after `lastPlayableId`, so `nowPlaying` never pairs a new id with a
   * stale track while a resolve is in flight (see {@link handleState}). */
  private lastResolvedPlayableId: string | null = null;
  /** `Date.now()` of the last state frame, for {@link lastStateAgeMs}. */
  private lastStateAt = 0;
  /** Monotone counter to detect out-of-order resolveTrack completions. */
  private resolveSeq = 0;
  /** Resolves the backoff sleep immediately when stop() is called. */
  private stopResolve: (() => void) | null = null;
  /** The pending reconnect timer, cleared by stop(). */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Reconnect delay ladder (ms) the server last asked for. */
  private serverBackoffMs: number[] | null = null;
  /** Loop generation: bumped by every start()/stop(), so a loop left suspended
   * by stop() exits instead of running alongside the next start()'s loop. */
  private generation = 0;

  constructor(opts: RealtimeOptions) {
    super();
    this.opts = opts;
    this.deviceId = opts.deviceId ?? generateDeviceId();
  }

  /** The stable device id used for every session of this client. */
  get deviceIdValue(): string {
    return this.deviceId;
  }

  /**
   * The terminal error (unauthorized, device displaced) that ended the loop, or `null`.
   * Set when the loop stops because of it, cleared by {@link start}. Lets callers that
   * do not listen to `error` tell why `start()` resolved.
   */
  get terminalError(): Error | null {
    return this.terminal;
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
      track: playableId === this.lastResolvedPlayableId ? this.lastTrack : null,
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
    this.terminal = null;
    this.serverBackoffMs = null;
    const gen = ++this.generation;
    const live = (): boolean => this.running && gen === this.generation;
    let tokenOverride: string | undefined;
    let unauthorizedRetried = false;
    /** Consecutive rebalance frames; only the first reconnects without delay. */
    let rebalances = 0;
    while (live()) {
      const token = tokenOverride ?? (await resolveToken(this.opts.token));
      if (!live()) {
        break;
      }
      const client = new YnisonClient({
        ...this.opts.ynison,
        token,
        deviceId: this.deviceId,
        deviceInfo: this.opts.deviceInfo ?? null,
      });
      client.onError((err) => {
        if (live()) this.safeEmitError(err);
      });
      this.current = client;
      this.lastStateAt = Date.now();
      let opened = false;
      let openedAt = 0;
      client.onState((state) => {
        if (!live()) {
          return;
        }
        if (!opened) {
          opened = true;
          openedAt = Date.now();
          this.safeEmit('open');
        }
        // A throwing user listener must never become an unhandled rejection.
        this.handleState(state).catch((error: unknown) =>
          this.safeEmitError(error instanceof Error ? error : new Error(String(error))),
        );
      });

      const staleTimer = this.startStaleWatchdog(client);
      let delayMs: number | null = null;
      let terminal = false;
      let shortSession = false;
      // Reset the attempt counter (and any server ladder) only after a session
      // that stayed open long enough; evaluated when the session ends.
      const settle = (): void => {
        if (!opened) {
          return;
        }
        if (Date.now() - openedAt >= (this.opts.stableSessionMs ?? 5000)) {
          this.attempt = 0;
          this.serverBackoffMs = null;
          unauthorizedRetried = false;
          rebalances = 0;
        } else {
          shortSession = true;
        }
      };
      try {
        await client.connect();
        settle();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        settle();
        if (live()) {
          this.safeEmitError(err);
        }
        if (err instanceof YnisonUnauthorizedError && live() && !unauthorizedRetried) {
          // A rotated token (provider) or one refresh (onUnauthorized) gets one
          // more attempt before the rejection becomes terminal.
          unauthorizedRetried = true;
          const fresh = await this.freshToken(token);
          if (fresh) {
            tokenOverride = typeof this.opts.token === 'function' ? undefined : fresh;
          } else {
            terminal = true;
            this.terminal = err;
          }
        } else if ((err instanceof YnisonUnauthorizedError || err instanceof YnisonDeviceDisplacedError) && live()) {
          terminal = true;
          this.terminal = err;
        }
        if (err instanceof YnisonServerError && err.backoffMs.length > 0) {
          this.serverBackoffMs = err.backoffMs;
        }
        // honour a server go-away, but cap it: Ynison's "temporary unavailable"
        // can carry an hour-long go-away, which would freeze the client until it
        // elapses. Capping lets us recover within `goAwayMaxMs` of the service
        // returning.
        const immediate = err instanceof YnisonRebalancedError && rebalances === 0;
        rebalances = err instanceof YnisonRebalancedError ? rebalances + 1 : 0;
        if (immediate) {
          // The session moved to another host: go straight back through the
          // redirector. A repeated rebalance falls back to the normal backoff.
          delayMs = 0;
          shortSession = false;
        } else {
          delayMs =
            error instanceof YnisonError && error.retryAfterMs
              ? Math.min(error.retryAfterMs, this.opts.goAwayMaxMs ?? 60_000)
              : this.backoff();
        }
      } finally {
        if (staleTimer !== null) {
          clearInterval(staleTimer);
        }
        client.disconnect();
        if (this.current === client) {
          this.current = null;
        }
      }

      if (terminal || !live() || this.opts.reconnect === false) {
        break;
      }
      let wait = delayMs ?? this.backoff();
      if (shortSession) {
        wait = Math.max(wait, Math.min(1000, this.opts.reconnectMaxMs ?? 30_000));
      }
      this.safeEmit('reconnect', wait);
      if (!live()) {
        break;
      }
      await new Promise<void>((resolve) => {
        this.stopResolve = resolve;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.stopResolve = null;
          resolve();
        }, wait);
      });
      this.stopResolve = null;
    }
    // A loop superseded by a newer start() must not flip the new loop's state.
    if (gen === this.generation) {
      this.running = false;
    }
    this.safeEmit('close', gen === this.generation ? this.terminal : null);
  }

  /**
   * Emit an event, isolating listener exceptions: `EventEmitter.emit` rethrows a
   * listener's error synchronously, which would otherwise abort the loop or
   * surface as an unhandled rejection. The error is routed to `'error'` instead.
   */
  private safeEmit<E extends keyof RealtimeEvents>(event: E, ...args: RealtimeEvents[E]): void {
    try {
      this.emit(event, ...args);
    } catch (error) {
      this.safeEmitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Emit `'error'` only when someone is listening. Node's `EventEmitter` throws
   * the error itself (crashing the process) when `'error'` has no listener, which
   * would defeat the whole point of an auto-reconnecting client on a transient
   * failure.
   */
  private safeEmitError(err: Error): void {
    if (this.listenerCount('error') > 0) {
      try {
        this.emit('error', err);
      } catch {
        /* a throwing error listener is isolated */
      }
    }
  }

  private requireClient(): YnisonClient {
    if (!this.current) throw new YnisonConnectionClosedError('realtime client is not connected');
    return this.current;
  }

  /** Send a raw request frame on the current session. @throws {YnisonConnectionClosedError} When not connected. */
  sendRaw(request: Record<string, unknown> | string): void {
    this.requireClient().sendRaw(request);
  }

  /** Pause playback. @throws {YnisonConnectionClosedError} When not connected. */
  pause(): void {
    this.requireClient().pause();
  }

  /** Resume playback. @throws {YnisonConnectionClosedError} When not connected. */
  resume(): void {
    this.requireClient().resume();
  }

  /** Next track in playback order. @throws {YnisonConnectionClosedError} When not connected. */
  nextTrack(): void {
    this.requireClient().nextTrack();
  }

  /** Previous track in playback order. @throws {YnisonConnectionClosedError} When not connected. */
  previousTrack(): void {
    this.requireClient().previousTrack();
  }

  /** Set a device volume (`0..1`, default target: the active device). @throws {YnisonConnectionClosedError} When not connected. */
  setVolume(volume: number, targetDeviceId?: string): void {
    this.requireClient().setVolume(volume, targetDeviceId);
  }

  /** Stop the realtime loop and close the connection. */
  stop(): void {
    this.running = false;
    this.generation += 1;
    this.current?.disconnect();
    this.current = null;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopResolve?.();
    this.stopResolve = null;
  }

  /** A token different from `rejected`: from the provider, else from `onUnauthorized`; `undefined` when none. */
  private async freshToken(rejected: string): Promise<string | undefined> {
    try {
      const current = await resolveToken(this.opts.token);
      if (current && current !== rejected) {
        return current;
      }
      const refreshed = await this.opts.onUnauthorized?.();
      return refreshed && refreshed !== rejected ? refreshed : undefined;
    } catch {
      return undefined;
    }
  }

  /** `schedule[min(attempt, last)] + random(0..250)` ms, floored by `reconnectBaseMs` and capped by `reconnectMaxMs`. */
  private backoff(): number {
    const schedule = this.serverBackoffMs ?? DEFAULT_BACKOFF_MS;
    const base = schedule[Math.min(this.attempt, schedule.length - 1)] ?? 0;
    this.attempt += 1;
    const max = this.opts.reconnectMaxMs ?? 30_000;
    const delay = Math.max(this.opts.reconnectBaseMs ?? 0, base + Math.random() * 250);
    return Math.round(Math.min(max, delay));
  }

  /**
   * Poll for a dead transport: if the socket has shown no activity (frame, ping
   * or pong) for `staleTimeoutMs`, tear it down so {@link start} reconnects.
   * Liveness comes from {@link YnisonClient.lastActivityAt} (kept fresh by the
   * keep-alive ping/pong), not from state-frame arrival — see
   * {@link RealtimeOptions.staleTimeoutMs}. Returns the timer handle (or `null`
   * when disabled) for the caller to clear.
   */
  private startStaleWatchdog(client: YnisonClient): ReturnType<typeof setInterval> | null {
    const staleMs = this.opts.staleTimeoutMs ?? 0;
    if (staleMs <= 0) {
      return null;
    }
    const tick = Math.max(1000, Math.floor(staleMs / 4));
    return setInterval(() => {
      // before the socket opens lastActivityAt is 0; fall back to the session
      // start so a never-opening connection still trips the watchdog.
      const since = client.lastActivityAt || this.lastStateAt;
      const idle = Date.now() - since;
      if (idle > staleMs) {
        this.safeEmit('stale', idle);
        // terminate: a dead pipe never acknowledges a close frame.
        client.disconnect({ force: true });
      }
    }, tick);
  }

  private async handleState(state: YnisonState): Promise<void> {
    this.lastState = state;
    this.lastStateAt = Date.now();
    this.safeEmit('state', state);

    if (this.lastPaused === null || state.paused !== this.lastPaused) {
      this.lastPaused = state.paused;
      this.safeEmit('playStateChange', state.paused);
    }

    const idx = state.currentPlayableIndex;
    const playableId =
      idx >= 0 && idx < state.playableList.length ? (state.playableList[idx]?.playableId ?? null) : null;
    if (playableId && playableId !== this.lastPlayableId) {
      this.lastPlayableId = playableId;
      const seq = ++this.resolveSeq;
      let track: Track | null = null;
      if (this.opts.resolveTrack) {
        try {
          track = await this.opts.resolveTrack(playableId);
        } catch (error) {
          this.safeEmitError(error instanceof Error ? error : new Error(String(error)));
        }
      }
      // A newer frame updated lastPlayableId while we were awaiting — discard stale result.
      if (seq !== this.resolveSeq) return;
      this.lastTrack = track;
      this.lastResolvedPlayableId = playableId;
      this.safeEmit('trackChange', { playableId, track });
    }
  }
}
