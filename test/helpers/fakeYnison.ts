/**
 * A local fake Ynison server for offline tests, built on the `ws` dev dependency.
 *
 * Path `/redirect` replies with a redirect frame that points back at this server
 * and closes. Path `/state` runs a scriptable handler. Everything listens on
 * `127.0.0.1` with a random port.
 */
import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';

export const UNAUTHORIZED_FRAME = JSON.stringify({
  error: {
    grpc_code: 16,
    http_code: 401,
    message: 'UNAUTHENTICATED: fake',
    extra_headers: { 'ynison-error-code': '400160000', 'ynison-backoff-millis': '0:1000:5000:30000' },
  },
});

export const DISPLACED_FRAME = JSON.stringify({
  error: {
    details: {
      'ynison-error-code': '400090001',
      'ynison-go-away-for-seconds': '3600',
      'ynison-backoff-millis': '0:1000:5000:30000',
    },
    grpc_code: 9,
    http_code: 400,
    message: 'Current device has been dislocated by newly connected device with the same deviceId',
  },
});

/** A non-terminal error frame; `backoff` is the `a:b:c` ladder and `goAway` seconds are optional. */
export function errorFrame(backoff?: string, goAway?: number): string {
  const details: Record<string, string> = { 'ynison-error-code': '400030002' };
  if (backoff !== undefined) details['ynison-backoff-millis'] = backoff;
  if (goAway !== undefined) details['ynison-go-away-for-seconds'] = String(goAway);
  return JSON.stringify({
    error: { details, grpc_code: 3, http_code: 400, message: 'Bad Request' },
  });
}

/** A minimal state frame; `playableId` distinguishes frames. */
export function stateFrame(playableId = '1000', paused = true): string {
  return JSON.stringify({
    player_state: {
      status: { paused, duration_ms: '200000', progress_ms: '1000', playback_speed: 1, version: { timestamp_ms: '1' } },
      player_queue: {
        entity_id: 'fake-entity',
        entity_type: 'PLAYLIST',
        current_playable_index: 0,
        playable_list: [{ playable_id: playableId }],
      },
    },
  });
}

export interface RichStateOptions {
  ids?: string[];
  index?: number;
  paused?: boolean;
  progressMs?: number;
  durationMs?: number;
  timestampMs?: number;
  /** Shuffle order (shuffle_optional.playable_indices). */
  shuffle?: number[];
  devices?: Array<{ id: string; volume?: number }>;
  /** active_device_id_optional; omitted when undefined. */
  activeDeviceId?: string;
}

/** A state frame with a queue, devices and an active device (snake_case, as the server sends it). */
export function richStateFrame(o: RichStateOptions = {}): string {
  const ids = o.ids ?? ['a', 'b', 'c'];
  return JSON.stringify({
    player_state: {
      status: {
        paused: o.paused ?? false,
        duration_ms: String(o.durationMs ?? 200000),
        progress_ms: String(o.progressMs ?? 1000),
        playback_speed: 1,
        version: { device_id: 'other', version: '5', timestamp_ms: String(o.timestampMs ?? 1) },
      },
      player_queue: {
        entity_id: 'fake-entity',
        entity_type: 'PLAYLIST',
        current_playable_index: o.index ?? 0,
        playable_list: ids.map((playable_id) => ({ playable_id, playable_type: 'TRACK' })),
        ...(o.shuffle ? { shuffle_optional: { playable_indices: o.shuffle } } : {}),
        options: { repeat_mode: 'NONE' },
      },
    },
    devices: (o.devices ?? [{ id: 'dev-1', volume: 0.5 }]).map((d) => ({
      info: { device_id: d.id, title: d.id, type: 'ANDROID' },
      volume_info: { volume: d.volume ?? 0 },
    })),
    ...(o.activeDeviceId !== undefined ? { active_device_id_optional: o.activeDeviceId } : {}),
  });
}

export type StateScript = (ws: WebSocket, server: FakeYnisonServer) => void;

export interface FakeYnisonOptions {
  /** `keep_alive_params` of the redirect frame. Defaults to 60 s / 30 s. */
  keepAlive?: { time: number; timeout: number };
  /** Whether the server answers pings. Defaults to `true`. */
  autoPong?: boolean;
}

export class FakeYnisonServer {
  /** Scripts for upcoming state connections; the default script is used when empty. */
  readonly stateScripts: StateScript[] = [];
  defaultStateScript: StateScript = serveStateForever(stateFrame());
  redirectCount = 0;
  stateCount = 0;
  /** Parsed frames received on state connections. */
  readonly received: Array<Record<string, unknown>> = [];
  /** Raw `Sec-WebSocket-Protocol` header of every connection, tagged with its path. */
  readonly subprotocols: Array<{ path: string; header: string }> = [];
  readonly port: number;

  private readonly wss: WebSocketServer;
  private readonly keepAlive: { time: number; timeout: number };

  private constructor(wss: WebSocketServer, options: FakeYnisonOptions) {
    this.wss = wss;
    this.port = (wss.address() as AddressInfo).port;
    this.keepAlive = options.keepAlive ?? { time: 60, timeout: 30 };
    wss.on('connection', (ws, req) => {
      const path = (req.url ?? '').split('?')[0] ?? '';
      this.subprotocols.push({ path, header: String(req.headers['sec-websocket-protocol'] ?? '') });
      this.handle(ws, path);
    });
  }

  static async start(options: FakeYnisonOptions = {}): Promise<FakeYnisonServer> {
    const wss = new WebSocketServer({
      host: '127.0.0.1',
      port: 0,
      autoPong: options.autoPong ?? true,
      // the client requests ['Bearer', 'v2', <info>]; a protocol must be selected
      handleProtocols: (protocols) => (protocols.has('Bearer') ? 'Bearer' : false),
    });
    await new Promise<void>((resolve) => wss.once('listening', resolve));
    return new FakeYnisonServer(wss, options);
  }

  get redirectUrl(): string {
    return `ws://127.0.0.1:${this.port}/redirect`;
  }

  /** Options to pass as `RealtimeOptions.ynison` / `YnisonClientOptions`. */
  get ynisonOptions(): { redirectUrl: string; stateUrl: (host: string) => string } {
    return { redirectUrl: this.redirectUrl, stateUrl: (host) => `ws://${host}/state` };
  }

  redirectFrame(): string {
    return JSON.stringify({
      host: `127.0.0.1:${this.port}`,
      redirect_ticket: 'fake-ticket',
      session_id: 123,
      keep_alive_params: {
        keep_alive_time_seconds: this.keepAlive.time,
        keep_alive_timeout_seconds: this.keepAlive.timeout,
      },
    });
  }

  /** Record a frame received on a state connection. */
  record(data: unknown): void {
    this.received.push(JSON.parse(String(data)) as Record<string, unknown>);
    for (const w of [...this.waiters]) w();
  }

  private readonly waiters: Array<() => void> = [];

  /** Resolve once at least `count` frames were received (no sleeping). */
  waitForFrames(count: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = (): void => {
        if (this.received.length >= count) {
          this.waiters.splice(this.waiters.indexOf(check), 1);
          resolve();
        }
      };
      this.waiters.push(check);
      check();
    });
  }

  async close(): Promise<void> {
    for (const ws of this.wss.clients) ws.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  private handle(ws: WebSocket, path: string): void {
    // an unhandled socket error would throw inside the test process
    ws.on('error', () => undefined);
    if (path === '/redirect') {
      this.redirectCount += 1;
      ws.send(this.redirectFrame());
      ws.close();
    } else if (path === '/state') {
      this.stateCount += 1;
      (this.stateScripts.shift() ?? this.defaultStateScript)(ws, this);
    } else {
      ws.close();
    }
  }
}

/** Wait for the first (full-state) frame, then run `fn`. */
function onFirstFrame(ws: WebSocket, server: FakeYnisonServer, fn: () => void): void {
  ws.once('message', (data) => {
    server.record(data);
    fn();
  });
}

/** Reply to the full-state frame with `frame` and keep the connection open. */
export function serveStateForever(frame: string): StateScript {
  return (ws, server) => {
    onFirstFrame(ws, server, () => {
      ws.send(frame);
      ws.on('message', (data) => server.record(data));
    });
  };
}

/** Reply to the full-state frame with `frames`, then close cleanly. */
export function sendFramesThenClose(...frames: string[]): StateScript {
  return (ws, server) => {
    onFirstFrame(ws, server, () => {
      for (const f of frames) ws.send(f);
      ws.close();
    });
  };
}

/** Reply to the full-state frame with `frames`, then keep the connection open. */
export function sendFramesThenWait(...frames: string[]): StateScript {
  return serveFramesKeepOpen(frames);
}

function serveFramesKeepOpen(frames: string[]): StateScript {
  return (ws, server) => {
    onFirstFrame(ws, server, () => {
      for (const f of frames) ws.send(f);
      ws.on('message', (data) => server.record(data));
    });
  };
}

/** Accept the connection and the full-state frame but never answer. */
export const stayInSilence: StateScript = (ws, server) => {
  onFirstFrame(ws, server, () => undefined);
};
