import { describe, expect, it } from 'vitest';
import {
  ClonedSession,
  CombinedSession,
  CombinedSessionItem,
  CombinedSessionLanding,
  CombinedSessionQueueItem,
  GenerativeStream,
  GenerativeStreamData,
  GenerativeStreamFeedback,
  GenerativeStreamInfo,
  RotorSeed,
  RotorSession,
  RotorSessionTracks,
  RotorSettings,
  SessionEvent,
  SessionFeedback,
  SessionFeedbacks,
  SessionPlayable,
  Sequence,
  Station,
  StationResult,
  StationTracksResult,
  TrackParameters,
  WaveSettings,
  WaveSettingsBlock,
} from '../src/exports/rotor.js';
import { Fade } from '../src/models/track/nested.js';
import { Clip } from '../src/models/clip.js';
import { Track } from '../src/models/track/track.js';
import { CoverDerivedColors } from '../src/models/common.js';
import { Wave } from '../src/models/wave.js';
import type { JSONValue } from '../src/types.js';
import type { UnknownFieldsReport } from '../src/base.js';
import { Client } from '../src/client.js';

describe('RotorSeed', () => {
  it('maps type, tag and value', () => {
    const seed = RotorSeed.deJson({ type: 'user', tag: 'onyourwave', value: 'user:onyourwave' });
    expect(seed).toBeInstanceOf(RotorSeed);
    expect(seed?.type).toBe('user');
    expect(seed?.tag).toBe('onyourwave');
    expect(seed?.value).toBe('user:onyourwave');
    expect(seed?.toSeedString()).toBe('user:onyourwave');
  });

  it('parses a type:tag string, keeping colons in the tag', () => {
    const seed = RotorSeed.fromString('track:123:456');
    expect(seed.type).toBe('track');
    expect(seed.tag).toBe('123:456');
  });

  it('rejects non-objects', () => {
    expect(RotorSeed.deJson('x')).toBeNull();
  });
});

describe('RotorSession seeds (D1)', () => {
  it('object shape fills string and typed seeds, and id from radioSessionId', () => {
    const session = RotorSession.deJson({
      radioSessionId: 'sess-1',
      batchId: 'b1',
      pumpkin: false,
      interactive: true,
      offlineRecommenderData: [1, 2],
      acceptedSeeds: [{ type: 'user', tag: 'onyourwave' }],
      descriptionSeed: { type: 'user', tag: 'onyourwave' },
      sequence: [{ type: 'track', liked: true }],
      terminated: false,
    });
    expect(session).toBeInstanceOf(RotorSession);
    expect(session?.id).toBe('sess-1');
    expect(session?.radioSessionId).toBe('sess-1');
    expect(session?.acceptedSeeds).toEqual(['user:onyourwave']);
    expect(session?.acceptedRotorSeeds?.[0]).toBeInstanceOf(RotorSeed);
    expect(session?.descriptionSeed).toBe('user:onyourwave');
    expect(session?.descriptionRotorSeed).toBeInstanceOf(RotorSeed);
    expect(session?.batchId).toBe('b1');
    expect(session?.interactive).toBe(true);
    expect(session?.offlineRecommenderData).toEqual([1, 2]);
    expect(session?.sequence?.[0]).toBeInstanceOf(Sequence);
  });

  it('string shape keeps strings and parses typed seeds, radioSessionId from id', () => {
    const session = RotorSession.deJson({
      id: 'sess-2',
      acceptedSeeds: ['genre:rock'],
      descriptionSeed: 'genre:rock',
      wave: { name: 'w', stationId: 'user:onyourwave' },
    });
    expect(session?.id).toBe('sess-2');
    expect(session?.radioSessionId).toBe('sess-2');
    expect(session?.acceptedSeeds).toEqual(['genre:rock']);
    expect(session?.acceptedRotorSeeds?.[0]?.type).toBe('genre');
    expect(session?.acceptedRotorSeeds?.[0]?.tag).toBe('rock');
    expect(session?.descriptionSeed).toBe('genre:rock');
    expect(session?.descriptionRotorSeed?.tag).toBe('rock');
    expect(session?.wave?.stationId).toBe('user:onyourwave');
  });
});

describe('ClonedSession', () => {
  it('adds reference fields and typed seeds, keeping raw seeds', () => {
    const raw = {
      radioSessionId: 'c1',
      batchId: 'b',
      pumpkin: true,
      acceptedSeeds: [{ type: 'user', tag: 'x' }],
      descriptionSeed: { type: 'user', tag: 'x' },
      sequence: [{ type: 'track' }],
      terminated: false,
      interactive: false,
      offlineRecommenderData: [7],
      wave: { name: 'Wave', stationId: 'user:onyourwave' },
    };
    const cloned = ClonedSession.deJson(raw);
    expect(cloned?.radioSessionId).toBe('c1');
    expect(cloned?.acceptedSeeds).toEqual([{ type: 'user', tag: 'x' }]);
    expect(cloned?.acceptedRotorSeeds?.[0]).toBeInstanceOf(RotorSeed);
    expect(cloned?.descriptionRotorSeed).toBeInstanceOf(RotorSeed);
    expect(cloned?.sequence?.[0]).toBeInstanceOf(Sequence);
    expect(cloned?.wave).toBeInstanceOf(Wave);
    expect(cloned?.terminated).toBe(false);
    expect(cloned?.offlineRecommenderData).toEqual([7]);
    expect(cloned?.interactive).toBe(false);
  });
});

describe('RotorSessionTracks', () => {
  it('extends StationTracksResult with session fields', () => {
    const tracks = RotorSessionTracks.deJson({
      id: { type: 'user', tag: 'onyourwave' },
      batchId: 'b',
      radioSessionId: 's',
      terminated: true,
      unknownSession: false,
      offlineRecommenderData: [3],
      sequence: [{ type: 'track', trackParameters: { bpm: 100 } }],
    });
    expect(tracks).toBeInstanceOf(RotorSessionTracks);
    expect(tracks).toBeInstanceOf(StationTracksResult);
    expect(tracks?.terminated).toBe(true);
    expect(tracks?.unknownSession).toBe(false);
    expect(tracks?.offlineRecommenderData).toEqual([3]);
    expect(tracks?.id?.tag).toBe('onyourwave');
    expect(tracks?.sequence?.[0]?.trackParameters?.bpm).toBe(100);
  });
});

describe('session events and feedback', () => {
  it('maps playable, event, feedback and feedbacks', () => {
    const feedbacks = SessionFeedbacks.deJson({
      sessionId: 's',
      feedbacks: [
        {
          batchId: 'b',
          from: 'wave',
          event: {
            type: 'trackFinished',
            timestamp: 1700000000,
            trackId: '1:2',
            totalPlayedSeconds: 12.5,
            playable: { type: 'track', trackId: '1:2' },
          },
        },
      ],
    });
    expect(feedbacks).toBeInstanceOf(SessionFeedbacks);
    const feedback = feedbacks?.feedbacks?.[0];
    expect(feedback).toBeInstanceOf(SessionFeedback);
    expect(feedback?.from).toBe('wave');
    expect(feedback?.event).toBeInstanceOf(SessionEvent);
    expect(feedback?.event?.timestamp).toBe(1700000000);
    expect(feedback?.event?.totalPlayedSeconds).toBe(12.5);
    expect(feedback?.event?.playable).toBeInstanceOf(SessionPlayable);
    expect(feedback?.event?.playable?.trackId).toBe('1:2');
  });

  it('accepts a string timestamp and a clip playable', () => {
    const event = SessionEvent.deJson({
      type: 'clipStarted',
      timestamp: '2026-01-01T00:00:00Z',
      playable: { type: 'clip', id: '77' },
    });
    expect(event?.timestamp).toBe('2026-01-01T00:00:00Z');
    expect(event?.playable?.id).toBe('77');
  });
});

describe('combined session', () => {
  const trackRaw = { id: '1', title: 'T' };
  const clipRaw = { clipId: 5, title: 'C' };

  it('dispatches items on type', () => {
    const track = CombinedSessionItem.deJson({ type: 'TRACK', data: trackRaw });
    const clip = CombinedSessionItem.deJson({ type: 'CLIP', data: clipRaw });
    expect(track?.data).toBeInstanceOf(Track);
    expect(clip?.data).toBeInstanceOf(Clip);
    expect((clip?.data as Clip).clipId).toBe(5);
  });

  it('keeps raw data for an unknown type', () => {
    const unknown = CombinedSessionItem.deJson({ type: 'PODCAST', data: { id: 9 } });
    expect(unknown?.type).toBe('PODCAST');
    expect(unknown?.data).toEqual({ id: 9 });
  });

  it('retypes CombinedSession.list', () => {
    const raw: JSONValue = {
      sessionId: 's',
      batchId: 'b',
      pumpkin: false,
      list: [{ type: 'TRACK', data: trackRaw }, { type: 'CLIP', data: clipRaw }],
    };
    const session = CombinedSession.deJson(raw);
    expect(session?.list).toHaveLength(2);
    expect(session?.list?.[0]).toBeInstanceOf(CombinedSessionItem);
    expect(session?.list?.[1]?.data).toBeInstanceOf(Clip);
  });

  it('leaves list undefined when absent', () => {
    expect(CombinedSession.deJson({ sessionId: 's' })?.list).toBeUndefined();
  });

  it('maps landing and queue item', () => {
    const landing = CombinedSessionLanding.deJson({
      title: 'T',
      description: 'D',
      button: 'Go',
      list: [{ type: 'TRACK', data: trackRaw }],
    });
    expect(landing?.button).toBe('Go');
    expect(landing?.list?.[0]).toBeInstanceOf(CombinedSessionItem);
    const queue = CombinedSessionQueueItem.deJson({ type: 'CLIP', id: '5' });
    expect(queue?.type).toBe('CLIP');
    expect(queue?.id).toBe('5');
  });
});

describe('RotorSettings', () => {
  it('maps all fields', () => {
    const settings = RotorSettings.deJson({
      language: 'any',
      diversity: 'default',
      mood: 1,
      energy: 2,
      moodEnergy: 'all',
    });
    expect(settings).toBeInstanceOf(RotorSettings);
    expect(settings?.language).toBe('any');
    expect(settings?.mood).toBe(1);
    expect(settings?.moodEnergy).toBe('all');
  });
});

describe('generative stream', () => {
  it('maps nested data, colors and stream', () => {
    const stream = GenerativeStream.deJson({
      version: 'v1',
      data: {
        title: 'T',
        subtitle: 'S',
        backgroundColor: '#000000',
        derivedColors: { average: '#111111' },
        imageUrl: 'img',
        videoCoverUri: 'vid',
        explanations: 'e',
      },
      stream: { id: 'sid', url: 'https://example.invalid/s' },
    });
    expect(stream).toBeInstanceOf(GenerativeStream);
    expect(stream?.version).toBe('v1');
    expect(stream?.data).toBeInstanceOf(GenerativeStreamData);
    expect(stream?.data?.derivedColors).toBeInstanceOf(CoverDerivedColors);
    expect(stream?.data?.derivedColors?.average).toBe('#111111');
    expect(stream?.data?.videoCoverUri).toBe('vid');
    expect(stream?.stream).toBeInstanceOf(GenerativeStreamInfo);
    expect(stream?.stream?.url).toBe('https://example.invalid/s');
  });

  it('maps feedback', () => {
    const fb = GenerativeStreamFeedback.deJson({ reloadStream: true, notPaused: false });
    expect(fb?.reloadStream).toBe(true);
    expect(fb?.notPaused).toBe(false);
  });
});

describe('Station, StationResult, TrackParameters, WaveSettings', () => {
  it('maps new Station fields', () => {
    const station = Station.deJson({
      id: { type: 'user', tag: 'u' },
      name: 'N',
      specialContext: true,
      listeners: 5,
      login: 'l',
      fullName: 'F',
      displayName: 'D',
      visibility: 'public',
    });
    expect(station?.specialContext).toBe(true);
    expect(station?.listeners).toBe(5);
    expect(station?.login).toBe('l');
    expect(station?.fullName).toBe('F');
    expect(station?.displayName).toBe('D');
    expect(station?.visibility).toBe('public');
  });

  it('types StationResult.prerolls as a string list', () => {
    const result = StationResult.deJson({ prerolls: ['a', 'b'] });
    expect(result?.prerolls).toEqual(['a', 'b']);
  });

  it('maps userCollectionHue and mixFade', () => {
    const params = TrackParameters.deJson({
      bpm: 1,
      hue: 2,
      energy: 3,
      userCollectionHue: 4,
      mixFade: { inStart: 0, inStop: 1, outStart: 2, outStop: 3 },
    });
    expect(params?.userCollectionHue).toBe(4);
    expect(params?.mixFade).toBeInstanceOf(Fade);
    expect(params?.mixFade?.outStop).toBe(3);
  });

  it('types WaveSettings.blocks', () => {
    const settings = WaveSettings.deJson({
      blocks: [{ type: 'contexts', items: [{ id: { type: 'activity', tag: 'run' }, name: 'Run' }] }],
    });
    const block = settings?.blocks?.[0];
    expect(block).toBeInstanceOf(WaveSettingsBlock);
    expect(block?.type).toBe('contexts');
    expect(block?.items?.[0]).toBeInstanceOf(Station);
    expect(block?.items?.[0]?.id?.tag).toBe('run');
  });

  it('leaves blocks undefined when absent', () => {
    expect(WaveSettings.deJson({})?.blocks).toBeUndefined();
  });
});

describe('unknown-field reporting', () => {
  it('reports unmapped keys but not the new fields', () => {
    const reports: UnknownFieldsReport[] = [];
    const client = new Client({ onUnknownField: (report) => reports.push(report) });
    RotorSession.deJson({ id: 's', interactive: true, mystery: 1 }, client);
    TrackParameters.deJson({ bpm: 1, mixFade: {}, userCollectionHue: 1 }, client);
    Station.deJson({ name: 'n', login: 'l', visibility: 'v' }, client);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.model).toBe('RotorSession');
    expect(reports[0]?.fields).toEqual(['mystery']);
  });
});
