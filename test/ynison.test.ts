import { describe, test, expect } from 'vitest';
import { RealtimeClient, parseStateFrame, type YnisonState, type Track } from '../src/index.js';

function makeState(playableId: string): YnisonState {
  return {
    playableList: [{ playableId }],
    currentPlayableIndex: 0,
    entityId: null,
    entityType: null,
    paused: false,
    durationMs: 0,
    progressMs: 0,
    playbackSpeed: 1,
    timestampMs: Date.now(),
  };
}

describe('parseStateFrame', () => {
  test('playback_speed: 0 is preserved, not coerced to 1', () => {
    const frame = JSON.stringify({
      player_state: { status: { playback_speed: 0 } },
    });
    expect(parseStateFrame(frame).playbackSpeed).toBe(0);
  });

  test('playback_speed defaults to 1 when the field is absent', () => {
    const frame = JSON.stringify({ player_state: { status: {} } });
    expect(parseStateFrame(frame).playbackSpeed).toBe(1);
  });
});

describe('RealtimeClient.nowPlaying', () => {
  test('never pairs a new playableId with the previous track while resolveTrack is in flight', async () => {
    const trackA = { id: 'trackA' } as unknown as Track;
    let resolveNew!: (t: Track | null) => void;
    const pendingNew = new Promise<Track | null>((res) => {
      resolveNew = res;
    });
    const rt = new RealtimeClient({
      token: 'x',
      resolveTrack: async (id) => (id === 'old' ? trackA : pendingNew),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (rt as any).handleState(makeState('old'));
    expect(rt.nowPlaying?.playableId).toBe('old');
    expect(rt.nowPlaying?.track).toBe(trackA);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = (rt as any).handleState(makeState('new')) as Promise<void>;
    // resolveTrack('new') hasn't settled yet: the snapshot must not pair the new
    // id with the stale trackA object (the bug this test locks in place of).
    expect(rt.nowPlaying?.playableId).toBe('new');
    expect(rt.nowPlaying?.track).toBeNull();

    resolveNew(null);
    await pending;
    expect(rt.nowPlaying?.playableId).toBe('new');
    expect(rt.nowPlaying?.track).toBeNull();
  });
});
