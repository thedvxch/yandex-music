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
import { YnisonError } from '../exceptions.js';
import { buildUpdateFullStateRequest, generateDeviceId, type DeviceInfoOverride } from './messages.js';
import type { WebSocket as WsSocket, RawData } from 'ws';

const BASE_URL = 'wss://ynison.music.yandex.ru';
const REDIRECT_SERVICE = 'redirector.YnisonRedirectService/GetRedirectToYnison';
const STATE_SERVICE = 'ynison_state.YnisonStateService/PutYnisonState';
const KEEPALIVE_PING_INTERVAL_MS = 20_000;

/** The redirector response pointing at the state-service host. */
export interface RedirectResponse {
  /** State-service host to connect to. */
  host: string;
  /** Ticket authorizing the state connection. */
  redirectTicket: string;
  /** Session id (int64 as a string). */
  sessionId: string;
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
  return {
    playableList: rawList.map((p) => ({
      playableId: (field(asObj(p), 'playable_id', 'playableId') as string | null) ?? null,
    })),
    currentPlayableIndex: toNum(field(queue, 'current_playable_index', 'currentPlayableIndex'), 0),
    entityId: (field(queue, 'entity_id', 'entityId') as string | null) ?? null,
    entityType: (field(queue, 'entity_type', 'entityType') as string | null) ?? null,
    paused: Boolean(field(status, 'paused')),
    durationMs: toNum(field(status, 'duration_ms', 'durationMs'), 0),
    progressMs: toNum(field(status, 'progress_ms', 'progressMs'), 0),
    playbackSpeed: toNum(field(status, 'playback_speed', 'playbackSpeed'), 1) || 1,
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
  const host = (field(data, 'host') as string) ?? '';
  const redirectTicket = (field(data, 'redirect_ticket', 'redirectTicket') as string) ?? '';
  const sessionRaw = field(data, 'session_id', 'sessionId');
  const sessionId = sessionRaw == null ? '' : String(sessionRaw);
  if (!host || !redirectTicket || !sessionId) {
    throw new YnisonError(`invalid redirect frame: ${message.slice(0, 200)}`);
  }
  return { host, redirectTicket, sessionId };
}

function parseErrorFrame(message: string): { message: string; goAwayMs?: number } | null {
  let data: { error?: { message?: string; details?: Record<string, string> } };
  try {
    data = JSON.parse(message) as typeof data;
  } catch {
    return null;
  }
  if (!data.error) return null;
  const goAwaySec = Number(data.error.details?.['ynison-go-away-for-seconds'] ?? '');
  return {
    message: data.error.message ?? 'ynison error',
    goAwayMs: Number.isFinite(goAwaySec) && goAwaySec > 0 ? goAwaySec * 1000 : undefined,
  };
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

  constructor(opts: YnisonClientOptions) {
    this.token = opts.token;
    this.deviceId = opts.deviceId ?? generateDeviceId();
    this.deviceInfo = opts.deviceInfo ?? null;
  }

  /** The device id used by this session. */
  get deviceIdValue(): string {
    return this.deviceId;
  }

  /** Register a listener invoked for each state frame. */
  onState(listener: StateListener): void {
    this.listeners.push(listener);
  }

  private headers(): Record<string, string> {
    return { Origin: 'https://music.yandex.ru', Authorization: `OAuth ${this.token}` };
  }

  private deviceInfoHeader(): string {
    const inner: Record<string, string> = {
      'Ynison-Device-Id': this.deviceId,
      'Ynison-Device-Info': JSON.stringify(
        this.deviceInfo
          ? { app_name: this.deviceInfo.appName, type: this.deviceInfo.headerType }
          : { app_name: 'Python SDK', type: '1' },
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
    const uri = `${BASE_URL}/${REDIRECT_SERVICE}`;
    return new Promise<RedirectResponse>((resolve, reject) => {
      const ws = new WS(uri, this.subprotocols(), { headers: this.headers() });
      this.redirectWs = ws;
      const timer = setTimeout(() => {
        reject(new YnisonError(`redirect frame did not arrive within ${timeoutMs}ms`));
        ws.close();
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
    const uri = `wss://${this.redirect!.host}/${STATE_SERVICE}`;
    return new Promise<void>((resolve, reject) => {
      const ws = new WS(uri, this.subprotocols(), { headers: this.headers() });
      this.stateWs = ws;
      let opened = false;
      ws.on('open', () => {
        opened = true;
        ws.send(JSON.stringify(buildUpdateFullStateRequest(this.deviceId, this.deviceInfo)));
        this.pingTimer = setInterval(() => {
          if (ws.readyState === ws.OPEN) ws.ping();
        }, KEEPALIVE_PING_INTERVAL_MS);
      });
      ws.on('message', (data: RawData, isBinary: boolean) => {
        if (isBinary) return;
        const text = data.toString();
        const err = parseErrorFrame(text);
        if (err) {
          this.clearPing();
          reject(new YnisonError(`server returned an error: ${err.message}`, err.goAwayMs));
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
        } catch {
          return;
        }
        for (const l of this.listeners) {
          try {
            void l(state);
          } catch {
            /* listener errors are isolated */
          }
        }
      });
      ws.on('error', (e: Error) => {
        this.clearPing();
        reject(new YnisonError(opened ? `state ws dropped: ${e.message}` : `state ws error: ${e.message}`));
      });
      ws.on('close', (code: number, reason: Buffer) => {
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
  }

  /**
   * Run the full handshake (redirect → state). The returned promise resolves when
   * the session closes normally and rejects on a handshake/transport failure.
   *
   * @param redirectTimeoutMs - Timeout for the redirect frame. Defaults to `10000`.
   * @throws {YnisonError} On a handshake or transport failure.
   */
  async connect(redirectTimeoutMs = 10_000): Promise<void> {
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
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new YnisonError(`first state frame did not arrive within ${timeoutMs}ms`));
      }, timeoutMs);
      this.onState((state) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(state);
      });
    });
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
