import { describe, expect, it } from 'vitest';
import {
  AlbumActionButton,
  Artist,
  Chart,
  Fade,
  Like,
  MadeForUser,
  Playlist,
  PlaylistSimilarEntities,
  R128,
  SimilarEntityItem,
  Tag,
  Track,
  TrackShort,
  User,
} from '../src/index.js';

describe('playlist models', () => {
  it('MadeForUser', () => {
    const m = MadeForUser.deJson({ isMadeForUser: true, caseForms: { nominative: 'Ivan' } });
    expect(m).toBeInstanceOf(MadeForUser);
    expect(m?.isMadeForUser).toBe(true);
    expect(m?.caseForms?.nominative).toBe('Ivan');
    expect(MadeForUser.deJson(null)).toBeNull();
  });

  it('Playlist new fields and retyped tags/actionButton', () => {
    const p = Playlist.deJson({
      kind: 1,
      tags: [{ id: 't', value: 'v', name: 'N' }],
      actionButton: { text: 'Go', url: 'u', color: '#fff' },
      childContent: true,
      madeForUser: { isMadeForUser: false },
      dummyDescription: 'dd',
      dummyPageDescription: 'dpd',
      dummyCover: { type: 'pic', uri: 'a/%%' },
      dummyRolloverCover: { type: 'pic', uri: 'b/%%' },
      prerolls: [{ x: 1 }],
      isForFrom: 'abc',
      derivedColors: { average: '#111' },
      customWave: { title: 't', animationUrl: 'u' },
    });
    expect(p?.tags?.[0]).toBeInstanceOf(Tag);
    expect(p?.tags?.[0]?.value).toBe('v');
    expect(p?.actionButton).toBeInstanceOf(AlbumActionButton);
    expect(p?.actionButton?.text).toBe('Go');
    expect(p?.childContent).toBe(true);
    expect(p?.madeForUser).toBeInstanceOf(MadeForUser);
    expect(p?.dummyDescription).toBe('dd');
    expect(p?.dummyPageDescription).toBe('dpd');
    expect(p?.dummyCover?.uri).toBe('a/%%');
    expect(p?.dummyRolloverCover?.uri).toBe('b/%%');
    expect(p?.prerolls).toEqual([{ x: 1 }]);
    expect(p?.isForFrom).toBe('abc');
    expect(p?.derivedColors?.average).toBe('#111');
    expect(p?.customWave?.position).toBeUndefined();
  });

  it('PlaylistSimilarEntities.items are SimilarEntityItem', () => {
    const m = PlaylistSimilarEntities.deJson({ items: [{ type: 'wave', data: { wave: { name: 'w' } } }] });
    expect(m?.items?.[0]).toBeInstanceOf(SimilarEntityItem);
    expect(m?.items?.[0]?.data?.wave?.name).toBe('w');
  });
});

describe('track models', () => {
  it('Track new fields', () => {
    const t = Track.deJson({
      id: '1:2',
      chart: { position: 3, progress: 'up' },
      clipIds: [5, 6],
      isrc: 'US123',
      ugcArtistName: 'ugc',
      podcastEpisodeType: 'x',
      pubDate: '2024-01-01',
      userInfo: { uid: 7, login: 'bob' },
      mixFade: { inStart: 1, inStop: 2, outStart: 3, outStop: 4 },
    });
    expect(t?.chart).toBeInstanceOf(Chart);
    expect(t?.chart?.position).toBe(3);
    expect(t?.clipIds).toEqual([5, 6]);
    expect(t?.isrc).toBe('US123');
    expect(t?.ugcArtistName).toBe('ugc');
    expect(t?.userInfo).toBeInstanceOf(User);
    expect(t?.mixFade).toBeInstanceOf(Fade);
    expect(t?.mixFade?.outStop).toBe(4);
    expect(t?.trackId()).toBe('1:2');
  });

  it('R128.importantSecs', () => {
    const m = R128.deJson({ i: -10, tp: 1, importantSecs: 42 });
    expect(m?.importantSecs).toBe(42);
  });

  it('TrackShort.chart is Chart', () => {
    const m = TrackShort.deJson({ id: 1, chart: { position: 1 }, originalShuffleIndex: 4 });
    expect(m?.chart).toBeInstanceOf(Chart);
    expect(m?.originalShuffleIndex).toBe(4);
  });
});

describe('Like', () => {
  it('normalises id to string', () => {
    const l = Like.deJson({ id: 123, type: 'album', timestamp: 't' });
    expect(l?.id).toBe('123');
    expect(Like.deJson({ type: 'album' })?.id).toBeUndefined();
  });

  it('deListTyped wraps bare artists', () => {
    const list = Like.deListTyped([{ id: 9, name: 'Bare' }, { artist: { id: 10, name: 'Wrapped' }, timestamp: 'ts' }, 'junk'], undefined, 'artist');
    expect(list).toHaveLength(2);
    expect(list[0]?.type).toBe('artist');
    expect(list[0]?.artist).toBeInstanceOf(Artist);
    expect(list[0]?.artist?.name).toBe('Bare');
    expect(list[0]?.id).toBe('9');
    expect(list[1]?.artist?.name).toBe('Wrapped');
    expect(list[1]?.timestamp).toBe('ts');
  });

  it('deListTyped keeps album likes and tolerates non-arrays', () => {
    const list = Like.deListTyped([{ id: 1, album: { id: 1, title: 'A' } }], undefined, 'album');
    expect(list[0]?.type).toBe('album');
    expect(list[0]?.album?.title).toBe('A');
    expect(Like.deListTyped(undefined, undefined, 'album')).toEqual([]);
  });
});
