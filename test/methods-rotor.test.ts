import { describe, expect, test } from 'vitest';
import { clientWith } from './helpers/http.js';
import { RotorSessionTracks } from '../src/models/rotor/rotor.js';
import { CombinedSessionLanding } from '../src/models/rotor/session.js';
import { GenerativeStream, GenerativeStreamFeedback } from '../src/models/rotor/stream.js';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ok = (body: unknown = 'ok') => ({ result: body });
const json = (call: { body?: string }) => JSON.parse(call.body ?? 'null');
const base = 'https://api.music.yandex.net';

describe('station feedback', () => {
  test('posts JSON with batch-id and streamId in the query', async () => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok() }]);
    const res = await client.rotorStationFeedback('user:onyourwave', 'trackStarted', {
      trackId: '1:2',
      batchId: 'b1',
      streamId: 's1',
      from: 'web',
      totalPlayedSeconds: 3.5,
      timestamp: 1700000000000,
    });
    expect(res).toBe(true);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${base}/rotor/station/user:onyourwave/feedback?batch-id=b1&streamId=s1`);
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    expect(json(calls[0]!)).toEqual({
      type: 'trackStarted',
      timestamp: '2023-11-14T22:13:20.000Z',
      trackId: '1:2',
      from: 'web',
      totalPlayedSeconds: 3.5,
    });
  });

  test('drops 0 trackId and 0 totalPlayedSeconds, defaults timestamp to ISO', async () => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok() }]);
    await client.rotorStationFeedback('s:1', 'skip', { trackId: 0, totalPlayedSeconds: 0 });
    const body = json(calls[0]!);
    expect(Object.keys(body).sort()).toEqual(['timestamp', 'type']);
    expect(body.timestamp).toMatch(ISO);
    expect(calls[0]!.url).toBe(`${base}/rotor/station/s:1/feedback`);
  });

  test('shortcuts accept an ISO timestamp', async () => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok() }]);
    await client.rotorStationFeedbackSkip('s:1', 5, 10, 'b', '2024-01-01T00:00:00.000Z');
    expect(json(calls[0]!)).toEqual({
      type: 'skip',
      timestamp: '2024-01-01T00:00:00.000Z',
      trackId: 5,
      totalPlayedSeconds: 10,
    });
  });
});

describe('station settings, tracks, stream', () => {
  test('settings2 posts JSON', async () => {
    const { client, calls } = clientWith([{ match: '/settings3', body: ok() }]);
    expect(await client.rotorStationSettings2('user:onyourwave', 'calm', 'popular')).toBe(true);
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    expect(json(calls[0]!)).toEqual({
      moodEnergy: 'calm',
      diversity: 'popular',
      type: 'rotor',
      language: 'not-russian',
    });
  });

  test('tracks ignores empty and zero queue', async () => {
    const { client, calls } = clientWith([{ match: '/tracks', body: ok({ sequence: [] }) }]);
    await client.rotorStationTracks('s:1', true, 0);
    await client.rotorStationTracks('s:1', true, '');
    await client.rotorStationTracks('s:1', true, 7);
    expect(calls[0]!.url).toBe(`${base}/rotor/station/s:1/tracks?settings2=true`);
    expect(calls[1]!.url).toBe(`${base}/rotor/station/s:1/tracks?settings2=true`);
    expect(calls[2]!.url).toBe(`${base}/rotor/station/s:1/tracks?queue=7`);
  });

  test('stream GET and stream feedback POST', async () => {
    const { client, calls } = clientWith([
      { method: 'GET', match: '/stream', body: ok({ streamInfo: { id: 'x' } }) },
      { method: 'POST', match: '/feedback', body: ok({}) },
    ]);
    expect(await client.rotorStationStream('generative:focus')).toBeInstanceOf(GenerativeStream);
    expect(calls[0]!.url).toBe(`${base}/rotor/station/generative:focus/stream`);
    const fb = await client.rotorStationStreamFeedback('generative:focus', 'streamPlay', 'sid');
    expect(fb).toBeInstanceOf(GenerativeStreamFeedback);
    expect(calls[1]!.url).toBe(`${base}/rotor/station/generative:focus/feedback?streamId=sid`);
    const body = json(calls[1]!);
    expect(body.type).toBe('streamPlay');
    expect(body.timestamp).toMatch(ISO);
  });
});

describe('wave', () => {
  test('settings seeds are comma-joined', async () => {
    const { client, calls } = clientWith([{ match: '/wave/settings', body: ok({}) }]);
    await client.rotorWaveSettings(['user:onyourwave', 'genre:rock']);
    await client.rotorWaveSettings('user:onyourwave');
    await client.rotorWaveSettings();
    expect(calls[0]!.url).toBe(`${base}/rotor/wave/settings?seeds=user%3Aonyourwave%2Cgenre%3Arock`);
    expect(calls[1]!.url).toBe(`${base}/rotor/wave/settings?seeds=user%3Aonyourwave`);
    expect(calls[2]!.url).toBe(`${base}/rotor/wave/settings`);
  });

  test('last reset is true for ok and { result: ok }', async () => {
    const a = clientWith([{ match: '/reset', body: ok() }]);
    expect(await a.client.rotorWaveLastReset()).toBe(true);
    const b = clientWith([{ match: '/reset', body: ok({ result: 'ok' }) }]);
    expect(await b.client.rotorWaveLastReset()).toBe(true);
    const c = clientWith([{ match: '/reset', body: ok({ result: 'no' }) }]);
    expect(await c.client.rotorWaveLastReset()).toBe(false);
  });
});

describe('sessions', () => {
  test('rotorSessionNew posts seeds and only defined options', async () => {
    const { client, calls } = clientWith([{ match: '/session/new', body: ok({ radioSessionId: 'r1' }) }]);
    const session = await client.rotorSessionNew('user:onyourwave', { includeWaveModel: true, child: false });
    expect(session?.radioSessionId).toBe('r1');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${base}/rotor/session/new`);
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    expect(json(calls[0]!)).toEqual({ seeds: ['user:onyourwave'], includeWaveModel: true, child: false });
    await client.rotorSessionNew(['a:1', 'b:2'], { queue: ['1', '2:3'], trackToStartFrom: '9' });
    expect(json(calls[1]!)).toEqual({ seeds: ['a:1', 'b:2'], queue: ['1', '2:3'], trackToStartFrom: '9' });
  });

  test('legacy boolean rotorSessionNew posts the onyourwave seed', async () => {
    const { client, calls } = clientWith([{ match: '/session/new', body: ok({}) }]);
    await client.rotorSessionNew(true);
    await client.rotorSessionNew(false);
    await client.rotorSessionNew();
    expect(calls[0]!.method).toBe('POST');
    expect(json(calls[0]!)).toEqual({ seeds: ['user:onyourwave'], includeWaveModel: true });
    expect(json(calls[1]!)).toEqual({ seeds: ['user:onyourwave'], includeWaveModel: false });
    expect(json(calls[2]!)).toEqual({ seeds: ['user:onyourwave'], includeWaveModel: true });
  });

  test('clone posts the JSON body', async () => {
    const { client, calls } = clientWith([{ match: '/clone', body: ok({}) }]);
    await client.rotorSessionClone('r1', { interactive: true, allowExplicit: false });
    expect(calls[0]!.url).toBe(`${base}/rotor/session/r1/clone`);
    expect(json(calls[0]!)).toEqual({ interactive: true, allowExplicit: false });
    await client.rotorSessionClone('r1');
    expect(json(calls[1]!)).toEqual({});
  });

  test('tracks posts queue and feedbacks, returns RotorSessionTracks', async () => {
    const { client, calls } = clientWith([
      { match: '/tracks', body: ok({ radioSessionId: 'r1', unknownSession: true, terminated: false }) },
    ]);
    const res = await client.rotorSessionTracks('r1');
    expect(res).toBeInstanceOf(RotorSessionTracks);
    expect(res?.unknownSession).toBe(true);
    expect(calls[0]!.url).toBe(`${base}/rotor/session/r1/tracks`);
    expect(json(calls[0]!)).toEqual({ queue: [] });
    await client.rotorSessionTracks('r1', {
      queue: ['5'],
      feedbacks: [
        { event: { type: 'skip', timestamp: 't', trackId: 5, totalPlayedSeconds: 2 }, batchId: 'b', from: 'f' },
      ],
    });
    expect(json(calls[1]!)).toEqual({
      queue: ['5'],
      feedbacks: [
        { event: { type: 'skip', timestamp: 't', trackId: '5', totalPlayedSeconds: 2 }, batchId: 'b', from: 'f' },
      ],
    });
    await client.rotorSessionTracks('r1', { feedbacks: [] });
    expect(json(calls[2]!)).toEqual({ queue: [] });
  });

  test('feedback posts {event, batchId, from}', async () => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok({}) }]);
    const res = await client.rotorSessionFeedback(
      'r1',
      { type: 'trackStarted', timestamp: 'T', trackId: 12, playable: { type: 'track', trackId: '12' } },
      'b1',
      'web',
    );
    expect(res).toBe(true);
    expect(calls[0]!.url).toBe(`${base}/rotor/session/r1/feedback`);
    expect(json(calls[0]!)).toEqual({
      event: { type: 'trackStarted', timestamp: 'T', trackId: '12', playable: { type: 'track', trackId: '12' } },
      batchId: 'b1',
      from: 'web',
    });
  });

  test('feedback shortcuts build the expected events', async () => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok({}) }]);
    await client.rotorSessionFeedbackRadioStarted('r1', 'web', 'b');
    await client.rotorSessionFeedbackTrackStarted('r1', 7, 'b');
    await client.rotorSessionFeedbackTrackFinished('r1', 7, 12.5, 'b', '2024-01-01T00:00:00.000Z');
    await client.rotorSessionFeedbackSkip('r1', '7', 1, 'b');
    const bodies = calls.map(json);
    expect(bodies[0].event.type).toBe('radioStarted');
    expect(bodies[0].event.timestamp).toMatch(ISO);
    expect(bodies[0]).toMatchObject({ batchId: 'b', from: 'web' });
    expect(bodies[1].event).toMatchObject({ type: 'trackStarted', trackId: '7' });
    expect(bodies[2].event).toEqual({
      type: 'trackFinished',
      timestamp: '2024-01-01T00:00:00.000Z',
      trackId: '7',
      totalPlayedSeconds: 12.5,
    });
    expect(bodies[3].event).toMatchObject({ type: 'skip', trackId: '7', totalPlayedSeconds: 1 });
  });

  test('feedbacks posts {feedbacks}', async () => {
    const { client, calls } = clientWith([{ match: '/feedbacks', body: ok({}) }]);
    expect(
      await client.rotorSessionFeedbacks('r1', [{ event: { type: 'radioStarted', timestamp: 'T' }, from: 'x' }]),
    ).toBe(true);
    expect(calls[0]!.url).toBe(`${base}/rotor/session/r1/feedbacks`);
    expect(json(calls[0]!)).toEqual({ feedbacks: [{ event: { type: 'radioStarted', timestamp: 'T' }, from: 'x' }] });
  });

  test('sessions feedbacks: JSON for arrays, legacy form for objects', async () => {
    const { client, calls } = clientWith([{ match: '/sessions/feedbacks', body: ok('ok') }]);
    expect(
      await client.rotorSessionsFeedbacks([
        { sessionId: 's1', feedbacks: [{ event: { type: 'skip', timestamp: 'T', trackId: 1 } }] },
      ]),
    ).toBe(true);
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    expect(json(calls[0]!)).toEqual({
      sessions: [{ sessionId: 's1', feedbacks: [{ event: { type: 'skip', timestamp: 'T', trackId: '1' } }] }],
    });
    expect(await client.rotorSessionsFeedbacks({})).toBe(true);
    expect(calls[1]!.headers['Content-Type']).not.toBe('application/json');
  });
});

describe('combined sessions', () => {
  test('new posts defined options only', async () => {
    const { client, calls } = clientWith([{ match: '/combined/session/new', body: ok({ radioSessionId: 'c1' }) }]);
    await client.rotorCombinedSessionNew({ supportedTypes: ['TRACK', 'CLIP'], queue: [{ type: 'TRACK', id: '1' }] });
    expect(calls[0]!.method).toBe('POST');
    expect(json(calls[0]!)).toEqual({ supportedTypes: ['TRACK', 'CLIP'], queue: [{ type: 'TRACK', id: '1' }] });
    await client.rotorCombinedSessionNew();
    expect(json(calls[1]!)).toEqual({});
  });

  test('next posts queue', async () => {
    const { client, calls } = clientWith([{ match: '/next', body: ok({}) }]);
    await client.rotorCombinedSessionNext('c1', [{ type: 'CLIP', id: '9' }]);
    expect(calls[0]!.url).toBe(`${base}/rotor/combined/session/c1/next`);
    expect(json(calls[0]!)).toEqual({ queue: [{ type: 'CLIP', id: '9' }] });
    await client.rotorCombinedSessionNext('c1');
    expect(json(calls[1]!)).toEqual({ queue: [] });
  });

  test('landing posts and returns CombinedSessionLanding', async () => {
    const { client, calls } = clientWith([{ match: '/landing', body: ok({ title: 'Clips', list: [] }) }]);
    const res = await client.rotorCombinedSessionLanding({ supportedTypes: ['CLIP'], child: true });
    expect(res).toBeInstanceOf(CombinedSessionLanding);
    expect(res?.title).toBe('Clips');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${base}/rotor/combined/session/landing`);
    expect(json(calls[0]!)).toEqual({ supportedTypes: ['CLIP'], child: true });
  });
});

describe('feedback timestamp units', () => {
  const sent = async (timestamp: string | number | Date): Promise<unknown> => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok() }]);
    await client.rotorStationFeedback('s:1', 'skip', { timestamp });
    return json(calls[0]!).timestamp;
  };

  test('a number below 1e11 is Unix seconds', async () => {
    expect(await sent(1780000000)).toBe('2026-05-28T20:26:40.000Z');
  });

  test('a larger number is milliseconds and names the same instant', async () => {
    expect(await sent(1780000000000)).toBe('2026-05-28T20:26:40.000Z');
  });

  test('strings and Dates pass through', async () => {
    expect(await sent('2026-01-02T03:04:05.000Z')).toBe('2026-01-02T03:04:05.000Z');
    expect(await sent(new Date(1780000000000))).toBe('2026-05-28T20:26:40.000Z');
  });

  test('helpers apply the same rule', async () => {
    const { client, calls } = clientWith([{ match: '/feedback', body: ok() }]);
    await client.rotorStationFeedbackTrackStarted('s:1', '1:2', undefined, 1780000000);
    expect(json(calls[0]!).timestamp).toBe('2026-05-28T20:26:40.000Z');
  });
});
