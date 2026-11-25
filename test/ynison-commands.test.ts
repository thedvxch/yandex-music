import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  RealtimeClient,
  YnisonClient,
  YnisonConnectionClosedError,
  YnisonNoActiveDeviceError,
  YnisonQueueBoundaryError,
  buildChangeTrackRequest,
  buildSetPausedRequest,
  buildSetVolumeRequest,
  getActiveDevice,
  getCurrentProgressMs,
  getNeighbourIndex,
  getPlaybackOrder,
  parseStateFrame,
} from '../src/index.js';
import { FakeYnisonServer, richStateFrame, sendFramesThenWait, type RichStateOptions } from './helpers/fakeYnison.js';

let server: FakeYnisonServer;
const clients: YnisonClient[] = [];

beforeEach(async () => {
  server = await FakeYnisonServer.start();
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server.close();
});

/** Connect a client against the fake server and wait for the first state frame. */
async function connected(state: RichStateOptions = {}): Promise<YnisonClient> {
  server.stateScripts.push(sendFramesThenWait(richStateFrame(state)));
  const client = new YnisonClient({
    token: 'secret-token',
    deviceId: 'me',
    connectTimeoutMs: 2000,
    ...server.ynisonOptions,
  });
  clients.push(client);
  const first = client.waitFirstState(2000);
  client.connect().catch(() => undefined);
  await first;
  return client;
}

/** The frame sent after the initial full-state frame. */
async function sentCommand(): Promise<Record<string, unknown>> {
  await server.waitForFrames(2);
  return server.received[1] as Record<string, unknown>;
}

const VERSION = { deviceId: 'me', version: expect.stringMatching(/^\d+$/), timestampMs: expect.stringMatching(/^\d+$/) };
const ENVELOPE = {
  rid: expect.stringMatching(/^[0-9a-f-]{36}$/),
  playerActionTimestampMs: expect.stringMatching(/^\d+$/),
  activityInterceptionType: 'DO_NOT_INTERCEPT_BY_DEFAULT',
};

describe('state parsing', () => {
  test('exposes raw, devices, active device and shuffle', () => {
    const state = parseStateFrame(
      richStateFrame({ shuffle: [2, 0, 1], activeDeviceId: 'dev-1', devices: [{ id: 'dev-1', volume: 0.25 }] }),
    );
    expect(state.devices).toEqual([{ deviceId: 'dev-1', title: 'dev-1', type: 'ANDROID', volume: 0.25 }]);
    expect(state.activeDeviceId).toBe('dev-1');
    expect(state.shuffleIndices).toEqual([2, 0, 1]);
    expect(state.raw).toHaveProperty('player_state');
  });

  test('camelCase frames and a missing active device', () => {
    const state = parseStateFrame(
      JSON.stringify({
        playerState: { playerQueue: { shuffleOptional: { playableIndices: [1, 0] } } },
        devices: [{ info: { deviceId: 'x' }, volumeInfo: { volume: 1 } }],
      }),
    );
    expect(state.shuffleIndices).toEqual([1, 0]);
    expect(state.devices).toEqual([{ deviceId: 'x', volume: 1 }]);
    expect(state.activeDeviceId).toBeNull();
  });
});

describe('helpers', () => {
  test('playback order and neighbour follow shuffle', () => {
    const state = parseStateFrame(richStateFrame({ shuffle: [2, 0, 1], index: 0 }));
    expect(getPlaybackOrder(state)).toEqual([2, 0, 1]);
    expect(getNeighbourIndex(state, 1)).toBe(1);
    expect(getNeighbourIndex(state, -1)).toBe(2);
    expect(getNeighbourIndex(state, -2)).toBeNull();
  });

  test('a shuffle of the wrong length is ignored', () => {
    const state = parseStateFrame(richStateFrame({ shuffle: [1, 0], index: 0 }));
    expect(getPlaybackOrder(state)).toEqual([0, 1, 2]);
  });

  test('progress extrapolates while playing and is capped by the duration', () => {
    const playing = parseStateFrame(richStateFrame({ paused: false, progressMs: 1000, durationMs: 5000, timestampMs: 10_000 }));
    expect(getCurrentProgressMs(playing, 12_000)).toBe(3000);
    expect(getCurrentProgressMs(playing, 99_000)).toBe(5000);
    const paused = parseStateFrame(richStateFrame({ paused: true, progressMs: 1000, timestampMs: 10_000 }));
    expect(getCurrentProgressMs(paused, 12_000)).toBe(1000);
  });

  test('getActiveDevice throws without an active device', () => {
    expect(() => getActiveDevice(parseStateFrame(richStateFrame()))).toThrow(YnisonNoActiveDeviceError);
    expect(() => getActiveDevice(parseStateFrame(richStateFrame({ activeDeviceId: 'ghost' })))).toThrow(
      YnisonNoActiveDeviceError,
    );
    expect(getActiveDevice(parseStateFrame(richStateFrame({ activeDeviceId: 'dev-1' }))).deviceId).toBe('dev-1');
  });
});

describe('builders (deterministic)', () => {
  const fixed = { nowMs: 12_000, rid: 'rid-1', version: '777' };

  test('pause recomputes progress and keeps duration', () => {
    const state = parseStateFrame(richStateFrame({ paused: false, progressMs: 1000, durationMs: 200000, timestampMs: 10_000 }));
    expect(buildSetPausedRequest('me', state, true, fixed)).toEqual({
      updatePlayingStatus: {
        playingStatus: {
          progressMs: '3000',
          durationMs: '200000',
          paused: true,
          playbackSpeed: 1,
          version: { deviceId: 'me', version: '777', timestampMs: '12000' },
        },
      },
      rid: 'rid-1',
      playerActionTimestampMs: '12000',
      activityInterceptionType: 'DO_NOT_INTERCEPT_BY_DEFAULT',
    });
  });

  test('next clones the queue in camelCase with the new index', () => {
    const state = parseStateFrame(richStateFrame({ index: 1, paused: true }));
    const req = buildChangeTrackRequest('me', state, 1, fixed);
    const version = { deviceId: 'me', version: '777', timestampMs: '12000' };
    expect(req).toEqual({
      updatePlayerState: {
        playerState: {
          playerQueue: {
            entityId: 'fake-entity',
            entityType: 'PLAYLIST',
            currentPlayableIndex: 2,
            playableList: [
              { playableId: 'a', playableType: 'TRACK' },
              { playableId: 'b', playableType: 'TRACK' },
              { playableId: 'c', playableType: 'TRACK' },
            ],
            options: { repeatMode: 'NONE' },
            version,
          },
          status: { progressMs: '0', durationMs: '0', paused: true, playbackSpeed: 1, version },
        },
      },
      rid: 'rid-1',
      playerActionTimestampMs: '12000',
      activityInterceptionType: 'DO_NOT_INTERCEPT_BY_DEFAULT',
    });
  });

  test('volume is clamped to 0..1', () => {
    const body = (v: number): unknown =>
      (buildSetVolumeRequest('me', 'dev-1', v, fixed) as unknown as { updateVolumeInfo: { volumeInfo: { volume: number } } })
        .updateVolumeInfo.volumeInfo.volume;
    expect(body(1.7)).toBe(1);
    expect(body(-3)).toBe(0);
    expect(body(0.4)).toBe(0.4);
  });
});

describe('YnisonClient commands over the fake server', () => {
  test('pause keeps the progress and duration', async () => {
    const client = await connected({ paused: false, progressMs: 42_000, durationMs: 42_000, timestampMs: 5 });
    client.pause();
    expect(await sentCommand()).toEqual({
      updatePlayingStatus: {
        playingStatus: { progressMs: '42000', durationMs: '42000', paused: true, playbackSpeed: 1, version: VERSION },
      },
      ...ENVELOPE,
    });
  });

  test('resume sends paused=false', async () => {
    const client = await connected({ paused: true, progressMs: 7000 });
    client.resume();
    expect(await sentCommand()).toEqual({
      updatePlayingStatus: {
        playingStatus: { progressMs: '7000', durationMs: '200000', paused: false, playbackSpeed: 1, version: VERSION },
      },
      ...ENVELOPE,
    });
  });

  test('nextTrack and previousTrack send the new index', async () => {
    const client = await connected({ index: 1 });
    client.nextTrack();
    client.previousTrack();
    await server.waitForFrames(3);
    const index = (frame: unknown): unknown =>
      (frame as { updatePlayerState: { playerState: { playerQueue: { currentPlayableIndex: number } } } }).updatePlayerState
        .playerState.playerQueue.currentPlayableIndex;
    expect(index(server.received[1])).toBe(2);
    expect(index(server.received[2])).toBe(0);
    expect(server.received[1]).toMatchObject(ENVELOPE);
  });

  test('shuffle order is respected', async () => {
    const client = await connected({ index: 0, shuffle: [2, 0, 1] });
    client.nextTrack();
    const frame = (await sentCommand()) as { updatePlayerState: { playerState: { playerQueue: Record<string, unknown> } } };
    const queue = frame.updatePlayerState.playerState.playerQueue;
    expect(queue['currentPlayableIndex']).toBe(1);
    expect(queue['shuffleOptional']).toEqual({ playableIndices: [2, 0, 1] });
  });

  test('boundaries throw YnisonQueueBoundaryError and send nothing', async () => {
    const client = await connected({ index: 2 });
    expect(() => client.nextTrack()).toThrow(YnisonQueueBoundaryError);
    expect(server.received).toHaveLength(1);
  });

  test('previous at the first track throws YnisonQueueBoundaryError', async () => {
    const client = await connected({ index: 0 });
    expect(() => client.previousTrack()).toThrow(YnisonQueueBoundaryError);
    expect(server.received).toHaveLength(1);
  });

  test('setVolume targets the active device and clamps', async () => {
    const client = await connected({ activeDeviceId: 'dev-2', devices: [{ id: 'dev-1' }, { id: 'dev-2' }] });
    client.setVolume(3);
    expect(await sentCommand()).toEqual({
      updateVolumeInfo: { deviceId: 'dev-2', volumeInfo: { volume: 1, version: VERSION } },
      ...ENVELOPE,
    });
  });

  test('setVolume with an explicit target needs no active device', async () => {
    const client = await connected();
    client.setVolume(0.3, 'dev-1');
    expect(await sentCommand()).toEqual({
      updateVolumeInfo: { deviceId: 'dev-1', volumeInfo: { volume: 0.3, version: VERSION } },
      ...ENVELOPE,
    });
  });

  test('setVolume without an active device throws YnisonNoActiveDeviceError', async () => {
    const client = await connected();
    expect(() => client.setVolume(0.5)).toThrow(YnisonNoActiveDeviceError);
    expect(server.received).toHaveLength(1);
  });

  test('sendRaw sends the object as JSON', async () => {
    const client = await connected();
    client.sendRaw({ hello: 'world' });
    expect(await sentCommand()).toEqual({ hello: 'world' });
  });

  test('latestState tracks the last frame', async () => {
    const client = await connected({ index: 1 });
    expect(client.latestState?.currentPlayableIndex).toBe(1);
  });

  test('commands before connect throw YnisonConnectionClosedError', () => {
    const client = new YnisonClient({ token: 't' });
    expect(client.latestState).toBeNull();
    expect(() => client.pause()).toThrow(YnisonConnectionClosedError);
    expect(() => client.sendRaw('{}')).toThrow(YnisonConnectionClosedError);
  });
});

describe('RealtimeClient commands', () => {
  test('throw when not connected', () => {
    const rt = new RealtimeClient({ token: 't' });
    expect(() => rt.pause()).toThrow(YnisonConnectionClosedError);
    expect(() => rt.resume()).toThrow(YnisonConnectionClosedError);
    expect(() => rt.nextTrack()).toThrow(YnisonConnectionClosedError);
    expect(() => rt.previousTrack()).toThrow(YnisonConnectionClosedError);
    expect(() => rt.setVolume(0.5)).toThrow(YnisonConnectionClosedError);
    expect(() => rt.sendRaw({})).toThrow(YnisonConnectionClosedError);
  });

  test('delegate to the live session', async () => {
    server.stateScripts.push(sendFramesThenWait(richStateFrame({ index: 0 })));
    const rt = new RealtimeClient({
      token: 'secret-token',
      deviceId: 'me',
      reconnect: false,
      ynison: { ...server.ynisonOptions, connectTimeoutMs: 2000 },
    });
    const open = new Promise<void>((resolve) => rt.once('open', () => resolve()));
    const run = rt.start();
    await open;
    rt.nextTrack();
    await server.waitForFrames(2);
    rt.stop();
    await run;
    expect(server.received[1]).toMatchObject({
      updatePlayerState: { playerState: { playerQueue: { currentPlayableIndex: 1 } } },
    });
  });
});
