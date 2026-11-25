/**
 * Low-level Ynison WebSocket client: JSON-over-WebSocket implementing the
 * redirect → state handshake and streaming player-state frames.
 *
 * @remarks
 * Ynison requires custom request headers (`Authorization`, `Origin`,
 * `Ynison-Device-Info`), which the WHATWG `WebSocket` cannot set, so this module
 * uses the optional [`ws`](https://www.npmjs.com/package/ws) package, imported
 * dynamically. Install it (`npm install ws`) to use the realtime API; the rest of
 * the library has no runtime dependencies.
 *
 * @packageDocumentation
 */
import {
  YnisonConnectionClosedError,
  YnisonDeviceDisplacedError,
  YnisonError,
  YnisonServerError,
  YnisonTimeoutError,
  YnisonUnauthorizedError,
} from '../exceptions.js';
import {
  buildChangeTrackRequest,
  buildSetPausedRequest,
  buildSetVolumeRequest,
  buildUpdateFullStateRequest,
  generateDeviceId,
  type DeviceInfoOverride,
} from './messages.js';
import { getActiveDevice } from './utils.js';
import type { WebSocket as WsSocket, RawData } from 'ws';

const DEFAULT_REDIRECT_URL = 'wss://ynison.music.yandex.ru/redirector.YnisonRedirectService/GetRedirectToYnison';
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_KEEPALIVE_SECONDS = 20;
const GRPC_UNAUTHENTICATED = 16;
const GRPC_PERMISSION_DENIED = 7;
const ERROR_CODE_DEVICE_DISPLACED = '400090001';

function defaultStateUrl(host: string): string {
  return `wss://${host}/ynison_state.YnisonStateService/PutYnisonState`;
}

/** The redirector response pointing at the state-service host. */
export interface RedirectResponse {
  /** State-service host to connect to. */
  host: string;
  /** Ticket authorizing the state connection. */
  redirectTicket: string;
  /** Session id (int64 as a string). */
  sessionId: string;
  /** Server-requested keep-alive ping interval in seconds, when sent. */
  keepAliveTimeSeconds?: number;
  /** Server-requested keep-alive pong timeout in seconds, when sent. */
  keepAliveTimeoutSeconds?: number;
}

/** A snapshot of player state parsed from a `PutYnisonStateResponse` frame. */
export interface YnisonState {
  /** The playable queue (track references). */
  playableList: Array<{ playableId: string | null }>;
  /** Index of the currently playing item. */
  currentPlayableIndex: number;
  /** Id of the playing context (album/playlist/…). */
  entityId: string | null;
  /** Type of the playing context. */
  entityType: string | null;
  /** Whether playback is paused. */
  paused: boolean;
  /** Track duration in milliseconds. */
  durationMs: number;
  /** Playback position in milliseconds at {@link YnisonState.timestampMs}. */
  progressMs: number;
  /** Playback speed multiplier. */
  playbackSpeed: number;
  /** Server timestamp of the snapshot (ms since the epoch). */
  timestampMs: number;
  /** The full parsed frame, as received. */
  raw?: Record<string, unknown>;
  /** Connected devices. */
  devices?: YnisonDevice[];
  /** Id of the active (playing) device, or `null` when none. */
  activeDeviceId?: string | null;
  /** Shuffle order of queue indices; empty or absent when shuffle is off. */
  shuffleIndices?: number[];
}

/** A device listed in a state frame. */
export interface YnisonDevice {
  deviceId: string;
  title?: string;
  type?: string;
  /** Volume in `0..1`, when reported. */
  volume?: number;
}

/** A listener invoked for each player-state frame. */
export type StateListener = (state: YnisonState) => void | Promise<void>;

function toNum(v: unknown, def = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return def;
}

function field(obj: Record<string, unknown> | null | undefined, ...names: string[]): unknown {
  if (!obj) return undefined;
  for (const n of names) {
    if (obj[n] !== undefined && obj[n] !== null) return obj[n];
  }
  return undefined;
}

function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

/**
 * Parse a state frame into a {@link YnisonState}.
 *
 * @remarks
 * betterproto omits default values, so absent fields fall back to sane defaults.
 * Both snake_case (as sent) and camelCase keys are accepted.
 *
 * @param message - The raw frame text.
 * @returns The parsed state.
 */
export function parseStateFrame(message: string): YnisonState {
  const data = JSON.parse(message) as Record<string, unknown>;
  const playerState = asObj(field(data, 'player_state', 'playerState'));
  const queue = asObj(field(playerState, 'player_queue', 'playerQueue'));
  const status = asObj(field(playerState, 'status'));
  const version = asObj(field(status, 'version'));

  const rawList = (field(queue, 'playable_list', 'playableList') as unknown[]) ?? [];
  const devicesField = field(data, 'devices');
  const rawDevices: unknown[] = Array.isArray(devicesField) ? devicesField : [];
  const devices: YnisonDevice[] = [];
  for (const d of rawDevices) {
    const info = asObj(field(asObj(d), 'info'));
    const deviceId = field(info, 'device_id', 'deviceId');
    if (typeof deviceId !== 'string') continue;
    const volumeRaw = field(asObj(field(asObj(d), 'volume_info', 'volumeInfo')), 'volume') ?? field(asObj(d), 'volume');
    const title = field(info, 'title');
    const type = field(info, 'type');
    devices.push({
      deviceId,
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof type === 'string' ? { type } : {}),
      ...(volumeRaw !== undefined ? { volume: toNum(volumeRaw) } : {}),
    });
  }
  const activeRaw = field(data, 'active_device_id_optional', 'activeDeviceIdOptional');
  const shuffle = asObj(field(queue, 'shuffle_optional', 'shuffleOptional'));
  const shuffleRaw = field(shuffle, 'playable_indices', 'playableIndices');
  return {
    raw: data,
    devices,
    activeDeviceId: typeof activeRaw === 'string' && activeRaw !== '' ? activeRaw : null,
    shuffleIndices: Array.isArray(shuffleRaw) ? shuffleRaw.map((n) => toNum(n)) : [],
    playableList: rawList.map((p) => ({
      playableId: (field(asObj(p), 'playable_id', 'playableId') as string | null) ?? null,
    })),
    currentPlayableIndex: toNum(field(queue, 'current_playable_index', 'currentPlayableIndex'), 0),
    entityId: (field(queue, 'entity_id', 'entityId') as string | null) ?? null,
    entityType: (field(queue, 'entity_type', 'entityType') as string | null) ?? null,
    paused: Boolean(field(status, 'paused')),
    durationMs: toNum(field(status, 'duration_ms', 'durationMs'), 0),
    progressMs: toNum(field(status, 'progress_ms', 'progressMs'), 0),
    playbackSpeed: toNum(field(status, 'playback_speed', 'playbackSpeed'), 1),
    timestampMs: toNum(field(version, 'timestamp_ms', 'timestampMs'), 0),
  };
}

/**
 * Parse a redirect frame into a {@link RedirectResponse}.
 *
 * @param message - The raw frame text.
 * @returns The parsed redirect.
 * @throws {YnisonError} When the frame is missing required fields.
 */
export function parseRedirectFrame(message: string): RedirectResponse {
  const data = JSON.parse(message) as Record<string, unknown>;
  const errorPayload = asObj(data.error);
  if (errorPayload) {
    throw parseServerError(errorPayload);
  }
  const host = (field(data, 'host') as string) ?? '';
  const redirectTicket = (field(data, 'redirect_ticket', 'redirectTicket') as string) ?? '';
  const sessionRaw = field(data, 'session_id', 'sessionId');
  const sessionId = sessionRaw == null ? '' : String(sessionRaw);
  if (!host || !redirectTicket || !sessionId) {
    throw new YnisonError(`invalid redirect frame: ${message.slice(0, 200)}`);
  }
  const keepAlive = asObj(field(data, 'keep_alive_params', 'keepAliveParams'));
  const time = toNum(field(keepAlive, 'keep_alive_time_seconds', 'keepAliveTimeSeconds'), 0);
  const timeout = toNum(field(keepAlive, 'keep_alive_timeout_seconds', 'keepAliveTimeoutSeconds'), 0);
  return {
    host,
    redirectTicket,
    sessionId,
    ...(time > 0 ? { keepAliveTimeSeconds: time } : {}),
    ...(timeout > 0 ? { keepAliveTimeoutSeconds: timeout } : {}),
  };
}

function parseIntOrUndefined(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }
  return undefined;
}

/**
 * Turn the `error` object of a Ynison error frame into a typed (not thrown) error.
 *
 * @remarks
 * Reads `details` (or `extra_headers` when `details` is empty). gRPC 16/7 or HTTP
 * 401/403 gives {@link YnisonUnauthorizedError}; code `400090001` gives
 * {@link YnisonDeviceDisplacedError}; anything else {@link YnisonServerError}.
 * `ynison-backoff-millis` (`a:b:c`) becomes `backoffMs`; `ynison-go-away-for-seconds`
 * becomes `goAwaySeconds` and `retryAfterMs`.
 *
 * @param payload - The value of the frame's `error` key.
 * @returns The classified error.
 */
export function parseServerError(payload: Record<string, unknown>): YnisonServerError {
  const rawDetails = asObj(payload.details);
  const details =
    rawDetails && Object.keys(rawDetails).length > 0 ? rawDetails : (asObj(payload.extra_headers) ?? {});
  const message = typeof payload.message === 'string' && payload.message ? payload.message : 'ynison error';
  const grpcCode = parseIntOrUndefined(payload.grpc_code);
  const httpCode = parseIntOrUndefined(payload.http_code);
  const rawCode = details['ynison-error-code'];
  const errorCode = typeof rawCode === 'string' ? rawCode : undefined;
  const rawBackoff = details['ynison-backoff-millis'];
  const backoffMs =
    typeof rawBackoff === 'string'
      ? rawBackoff
          .split(':')
          .map(parseIntOrUndefined)
          .filter((n): n is number => n !== undefined && n >= 0)
      : [];
  const goAway = parseIntOrUndefined(details['ynison-go-away-for-seconds']);
  const opts = {
    grpcCode,
    httpCode,
    errorCode,
    backoffMs,
    goAwaySeconds: goAway !== undefined && goAway > 0 ? goAway : undefined,
  };
  const text = `server returned an error: ${message}`;
  if (
    grpcCode === GRPC_UNAUTHENTICATED ||
    grpcCode === GRPC_PERMISSION_DENIED ||
    httpCode === 401 ||
    httpCode === 403
  ) {
    return new YnisonUnauthorizedError(text, opts);
  }
  if (errorCode === ERROR_CODE_DEVICE_DISPLACED) {
    return new YnisonDeviceDisplacedError(text, opts);
  }
  return new YnisonServerError(text, opts);
}

function parseErrorFrame(message: string): YnisonServerError | null {
  let data: unknown;
  try {
    data = JSON.parse(message);
  } catch {
    return null;
  }
  const payload = asObj(asObj(data)?.error);
  return payload ? parseServerError(payload) : null;
}

let cachedWebSocket: typeof WsSocket | undefined;

async function loadWebSocket(): Promise<typeof WsSocket> {
  if (cachedWebSocket) {
    return cachedWebSocket;
  }
  try {
    const mod = (await import('ws')) as unknown as { WebSocket?: typeof WsSocket; default?: typeof WsSocket };
    const WS = mod.WebSocket ?? mod.default;
    if (!WS) {
      throw new Error('module "ws" did not export a WebSocket');
    }
    cachedWebSocket = WS;
    return WS;
  } catch (error) {
    throw new YnisonError(
      `the realtime API requires the optional "ws" package — run \`npm install ws\` (${
        error instanceof Error ? error.message : String(error)
      })`,
    );
  }
}

/** Options for {@link YnisonClient}. */
export interface YnisonClientOptions {
  /** OAuth token. */
  token: string;
  /** Device id. Defaults to a random id. */
  deviceId?: string;
  /** Device identity override for the full-state request. */
  deviceInfo?: DeviceInfoOverride | null;
  /** Redirector WebSocket URL. Defaults to the production Ynison redirector. */
  redirectUrl?: string;
  /** Builds the state-service URL from the redirect `host`. Defaults to `wss://${host}/ynison_state.YnisonStateService/PutYnisonState`. */
  stateUrl?: (host: string) => string;
  /**
   * Timeout (ms) for the redirect frame, and for the state socket to open and
   * deliver its first frame. Defaults to `10000`.
   */
  connectTimeoutMs?: number;
}

/**
 * A single Ynison session: performs the redirect → state handshake, dispatches
 * state frames to listeners and keeps the connection alive.
 *
 * @remarks
 * Reconnection is not built in; callers drive it (see the realtime client).
 */
export class YnisonClient {
  private readonly token: string;
  private readonly deviceId: string;
  private readonly deviceInfo: DeviceInfoOverride | null;
  private redirect: RedirectResponse | null = null;
  private redirectWs: WsSocket | null = null;
  private stateWs: WsSocket | null = null;
  private readonly listeners: StateListener[] = [];
  private closed = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly errorListeners: Array<(error: YnisonError) => void> = [];
  private readonly redirectUrl: string;
  private readonly stateUrl: (host: string) => string;
  private readonly connectTimeoutMs: number;
  /** `Date.now()` of the last WS activity (any frame, ping or pong) on the state
   * socket. Tracks transport liveness independently of state-frame arrival:
   * Ynison only pushes a state frame on a state change, so a paused/idle player
   * is silent for minutes while the pipe is perfectly healthy. */
  private lastActivity = 0;
  private latest: YnisonState | null = null;

  constructor(opts: YnisonClientOptions) {
    this.token = opts.token;
    this.deviceId = opts.deviceId ?? generateDeviceId();
    this.deviceInfo = opts.deviceInfo ?? null;
    this.redirectUrl = opts.redirectUrl ?? DEFAULT_REDIRECT_URL;
    this.stateUrl = opts.stateUrl ?? defaultStateUrl;
    this.connectTimeoutMs = opts.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  }

  /** The device id used by this session. */
  get deviceIdValue(): string {
    return this.deviceId;
  }

  /** `Date.now()` of the last WS activity on the state socket (any frame, ping or
   * pong), or `0` before the socket opens. Use this — not state-frame arrival —
   * to judge transport liveness: Ynison is legitimately silent while the player
   * is paused/idle, but the keep-alive ping/pong keeps this fresh. */
  get lastActivityAt(): number {
    return this.lastActivity;
  }

  /** Register a listener invoked for each state frame. Returns an unsubscribe function. */
  onState(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Register a listener for non-fatal problems, such as a state frame that could
   * not be parsed. Returns an unsubscribe function.
   */
  onError(listener: (error: YnisonError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const idx = this.errorListeners.indexOf(listener);
      if (idx !== -1) this.errorListeners.splice(idx, 1);
    };
  }

  private emitError(error: YnisonError): void {
    for (const l of [...this.errorListeners]) {
      try {
        l(error);
      } catch {
        /* listener errors are isolated */
      }
    }
  }

  private headers():Record<string, string> {
    return { Origin: 'https://music.yandex.ru', Authorization: `OAuth ${this.token}` };
  }

  private deviceInfoHeader(): string {
    const inner: Record<string, string> = {
      'Ynison-Device-Id': this.deviceId,
      'Ynison-Device-Info': JSON.stringify(
        this.deviceInfo
          ? { app_name: this.deviceInfo.appName, type: this.deviceInfo.headerType }
          : { app_name: 'Node.js SDK', type: '1' },
      ),
    };
    if (this.redirect) {
      inner['Ynison-Redirect-Ticket'] = this.redirect.redirectTicket;
      inner['Ynison-Session-Id'] = this.redirect.sessionId;
    }
    return JSON.stringify(inner);
  }

  private subprotocols(): string[] {
    return ['Bearer', 'v2', encodeURIComponent(this.deviceInfoHeader())];
  }

  private async connectRedirect(timeoutMs: number): Promise<RedirectResponse> {
    const WS = await loadWebSocket();
    return new Promise<RedirectResponse>((resolve, reject) => {
      const ws = new WS(this.redirectUrl, this.subprotocols(), { headers: this.headers() });
      this.redirectWs = ws;
      const timer = setTimeout(() => {
        reject(new YnisonTimeoutError(`redirect frame did not arrive within ${timeoutMs}ms`));
        ws.terminate();
      }, timeoutMs);
      let resolved = false;
      ws.on('message', (data: RawData, isBinary: boolean) => {
        if (isBinary || resolved) return;
        resolved = true;
        clearTimeout(timer);
        try {
          const resp = parseRedirectFrame(data.toString());
          this.redirect = resp;
          resolve(resp);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
        ws.close();
      });
      ws.on('error', (e: Error) => {
        if (resolved) return;
        clearTimeout(timer);
        reject(new YnisonError(`redirect ws error: ${e.message}`));
      });
      ws.on('close', () => {
        if (resolved) return;
        clearTimeout(timer);
        reject(new YnisonError('redirect ws closed before a frame'));
      });
    });
  }

  private async connectState(): Promise<void> {
    const WS = await loadWebSocket();
    // disconnect() may have run while the module loaded: do not open a socket then.
    if (this.closed) return;
    const redirect = this.redirect!;
    const uri = this.stateUrl(redirect.host);
    const pingMs = (redirect.keepAliveTimeSeconds ?? DEFAULT_KEEPALIVE_SECONDS) * 1000;
    const pongTimeoutMs = (redirect.keepAliveTimeoutSeconds ?? DEFAULT_KEEPALIVE_SECONDS) * 1000;
    return new Promise<void>((resolve, reject) => {
      const ws = new WS(uri, this.subprotocols(), { headers: this.headers() });
      this.stateWs = ws;
      let opened = false;
      // covers the socket opening and the first frame arriving
      let firstFrameTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        firstFrameTimer = null;
        reject(
          new YnisonTimeoutError(
            `${opened ? 'first state frame' : 'state ws open'} did not arrive within ${this.connectTimeoutMs}ms`,
          ),
        );
        ws.terminate();
      }, this.connectTimeoutMs);
      const clearFirstFrameTimer = (): void => {
        if (firstFrameTimer !== null) {
          clearTimeout(firstFrameTimer);
          firstFrameTimer = null;
        }
      };
      ws.on('open', () => {
        opened = true;
        this.lastActivity = Date.now();
        ws.send(JSON.stringify(buildUpdateFullStateRequest(this.deviceId, this.deviceInfo)));
        this.pingTimer = setInterval(() => {
          if (ws.readyState !== ws.OPEN) return;
          ws.ping();
          if (this.pongTimer === null) {
            this.pongTimer = setTimeout(() => {
              this.pongTimer = null;
              this.clearPing();
              reject(new YnisonConnectionClosedError(`no pong within ${pongTimeoutMs}ms`));
              ws.terminate();
            }, pongTimeoutMs);
          }
        }, pingMs);
      });
      // any inbound frame, ping or pong proves the pipe is alive — track it so the
      // realtime watchdog distinguishes "paused player, silent but healthy" from
      // a dead socket.
      ws.on('ping', () => {
        this.lastActivity = Date.now();
      });
      ws.on('pong', () => {
        this.lastActivity = Date.now();
        this.clearPong();
      });
      ws.on('message', (data: RawData, isBinary: boolean) => {
        this.lastActivity = Date.now();
        clearFirstFrameTimer();
        if (isBinary) return;
        const text = data.toString();
        const err = parseErrorFrame(text);
        if (err) {
          this.clearPing();
          reject(err);
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          return;
        }
        let state: YnisonState;
        try {
          state = parseStateFrame(text);
        } catch (e) {
          this.emitError(new YnisonError(`invalid state frame: ${e instanceof Error ? e.message : String(e)}`));
          return;
        }
        this.latest = state;
        for (const l of this.listeners) {
          try {
            // Promise.resolve() passes a rejecting async listener's promise
            // through unchanged, so .catch() below traps it too — not just a
            // synchronous throw.
            void Promise.resolve(l(state)).catch(() => {
              /* listener errors are isolated */
            });
          } catch {
            /* listener errors are isolated */
          }
        }
      });
      ws.on('error', (e: Error) => {
        clearFirstFrameTimer();
        this.clearPing();
        reject(new YnisonError(opened ? `state ws dropped: ${e.message}` : `state ws error: ${e.message}`));
      });
      ws.on('close', (code: number, reason: Buffer) => {
        clearFirstFrameTimer();
        this.clearPing();
        if (!opened) {
          reject(new YnisonError(`state ws closed before open (code=${code} reason=${reason.toString()})`));
          return;
        }
        resolve();
      });
    });
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPong();
  }

  private clearPong(): void {
    if (this.pongTimer !== null) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Run the full handshake (redirect → state). The returned promise resolves when
   * the session closes normally and rejects on a handshake/transport failure.
   *
   * @param redirectTimeoutMs - Timeout for the redirect frame. Defaults to the
   *   client's `connectTimeoutMs` (`10000`).
   * @throws {YnisonError} On a handshake or transport failure.
   */
  async connect(redirectTimeoutMs: number = this.connectTimeoutMs): Promise<void> {
    if (this.closed) throw new YnisonError('client already closed');
    await this.connectRedirect(redirectTimeoutMs);
    if (this.closed) return;
    await this.connectState();
  }

  /**
   * Wait for the first state frame.
   *
   * @param timeoutMs - How long to wait.
   * @returns The first {@link YnisonState}.
   * @throws {YnisonError} When no frame arrives in time.
   */
  waitFirstState(timeoutMs: number): Promise<YnisonState> {
    return new Promise<YnisonState>((resolve, reject) => {
      let done = false;
      let unsubscribe!: () => void;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        unsubscribe();
        reject(new YnisonTimeoutError(`first state frame did not arrive within ${timeoutMs}ms`));
      }, timeoutMs);
      unsubscribe = this.onState((state) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(state);
      });
    });
  }

  /** The most recent state frame, or `null` before the first one. */
  get latestState(): YnisonState | null {
    return this.latest;
  }

  /**
   * Send a raw `PutYnisonStateRequest` frame on the state socket as JSON.
   *
   * @param request - An object (serialised with `JSON.stringify`) or a ready JSON string.
   * @throws {YnisonConnectionClosedError} When the state socket is not open.
   */
  sendRaw(request: Record<string, unknown> | string): void {
    const ws = this.stateWs;
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new YnisonConnectionClosedError('ynison state socket is not open');
    }
    ws.send(typeof request === 'string' ? request : JSON.stringify(request));
  }

  private requireState(): YnisonState {
    if (!this.latest) throw new YnisonConnectionClosedError('no ynison state received yet');
    return this.latest;
  }

  /** Pause playback, keeping the interpolated position. */
  pause(): void {
    this.sendRaw(buildSetPausedRequest(this.deviceId, this.requireState(), true));
  }

  /** Resume playback from the interpolated position. */
  resume(): void {
    this.sendRaw(buildSetPausedRequest(this.deviceId, this.requireState(), false));
  }

  /**
   * Move to the next track in playback order (shuffle aware).
   *
   * @throws {YnisonQueueBoundaryError} At the last track.
   */
  nextTrack(): void {
    this.sendRaw(buildChangeTrackRequest(this.deviceId, this.requireState(), 1));
  }

  /**
   * Move to the previous track in playback order (shuffle aware).
   *
   * @throws {YnisonQueueBoundaryError} At the first track.
   */
  previousTrack(): void {
    this.sendRaw(buildChangeTrackRequest(this.deviceId, this.requireState(), -1));
  }

  /**
   * Set the volume of a device.
   *
   * @param volume - `0..1`; values outside are clamped.
   * @param targetDeviceId - Device to change. Defaults to the active device.
   * @throws {YnisonNoActiveDeviceError} When no target is given and no device is active.
   */
  setVolume(volume: number, targetDeviceId?: string): void {
    const state = this.requireState();
    const target = targetDeviceId ?? getActiveDevice(state).deviceId;
    this.sendRaw(buildSetVolumeRequest(this.deviceId, target, volume));
  }

  /** Close both sockets (best-effort, idempotent). */
  disconnect(): void {
    this.closed = true;
    this.clearPing();
    try {
      this.redirectWs?.close();
    } catch {
      /* ignore */
    }
    try {
      this.stateWs?.close();
    } catch {
      /* ignore */
    }
  }
}
