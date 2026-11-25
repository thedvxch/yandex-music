import { describe, expect, it } from 'vitest';
import {
  Block,
  BlockEntity,
  ChartInfo,
  ChartInfoMenu,
  ConcertSkeleton,
  Feed,
  FeedHeadline,
  Genre,
  Images,
  LandingList,
  MusicHistoryContextFullModel,
  MusicHistoryItem,
  PersonalPlaylistsData,
  PlayContextsData,
  PlaylistId,
  Search,
  SearchBanner,
  SearchHistoryItem,
  SearchResult,
  SkeletonBlock,
  Tag,
  TagResult,
  Track,
  TrackShortOld,
  Clip,
  Event,
} from '../src/index.js';
import type { Client, UnknownFieldsReport } from '../src/index.js';

function collect(): { client: Client; reports: UnknownFieldsReport[] } {
  const reports: UnknownFieldsReport[] = [];
  const client = { onUnknownField: (r: UnknownFieldsReport) => void reports.push(r) } as unknown as Client;
  return { client, reports };
}

describe('landing models', () => {
  it('Block.data is polymorphic by type', () => {
    const personal = Block.deJson({ id: 'b', type: 'personal-playlists', data: { isWizardPassed: true } })!;
    expect(personal.data).toBeInstanceOf(PersonalPlaylistsData);
    expect((personal.data as PersonalPlaylistsData).isWizardPassed).toBe(true);

    const contexts = Block.deJson({
      type: 'play-contexts',
      data: { otherTracks: [{ trackId: { id: '1', albumId: '2' }, timestamp: 't' }] },
    })!;
    expect(contexts.data).toBeInstanceOf(PlayContextsData);
    const other = (contexts.data as PlayContextsData).otherTracks![0]!;
    expect(other).toBeInstanceOf(TrackShortOld);
    expect(other.timestamp).toBe('t');
    expect(other.trackId?.id).toBe('1');

    const raw = Block.deJson({ type: 'something-else', data: { a: 1 } })!;
    expect(raw.data).toEqual({ a: 1 });
  });

  it('BlockEntity keeps its type dispatch', () => {
    const entity = BlockEntity.deJson({ type: 'promotion', data: { promoId: 'p' } })!;
    expect(entity.data).toMatchObject({ promoId: 'p' });
  });

  it('LandingList.newPlaylists are PlaylistId models', () => {
    const list = LandingList.deJson({ newPlaylists: [{ uid: 1, kind: 2 }], newReleases: [5] })!;
    expect(list.newPlaylists![0]).toBeInstanceOf(PlaylistId);
    expect(list.newPlaylists![0]!.playlistId).toBe('1:2');
    expect(list.newReleases).toEqual([5]);
  });

  it('ChartInfo.menu is a typed menu', () => {
    const info = ChartInfo.deJson({ id: 'c', menu: { items: [{ title: 'Russia', url: '/u', selected: true }] } })!;
    expect(info.menu).toBeInstanceOf(ChartInfoMenu);
    expect(info.menu!.items![0]).toMatchObject({ title: 'Russia', url: '/u', selected: true });
  });
});

describe('search models', () => {
  it('maps clips and banner', () => {
    const search = Search.deJson({
      text: 'q',
      clips: { total: 1, results: [{ id: 'c1', title: 'clip' }] },
      banner: { text: 't', textForSearch: 's', url: 'u', urlScheme: 'us', textColor: '#fff', textBackgroundColor: '#000', imageUrl: 'i' },
    })!;
    expect(search.tracks).toBeUndefined();
    expect(search.clips).toBeInstanceOf(SearchResult);
    expect(search.clips!.results![0]).toBeInstanceOf(Clip);
    expect(search.banner).toBeInstanceOf(SearchBanner);
    expect(search.banner!.textForSearch).toBe('s');
    expect(search.banner!.imageUrl).toBe('i');
  });

  it('reports an unknown result type instead of ignoring it', () => {
    const { client, reports } = collect();
    const known = SearchHistoryItem.deJson({ type: 'track', track: { id: '1' } }, client)!;
    expect(known.entity).toBeInstanceOf(Track);
    expect(reports).toHaveLength(0);

    const item = SearchHistoryItem.deJson({ type: 'mystery', mystery: { x: 1 } }, client)!;
    expect(item.entity).toBeUndefined();
    const report = reports.find((r) => r.model === 'SearchHistoryItem' && r.fields.includes('type:mystery'));
    expect(report).toBeDefined();
  });
});

describe('music history', () => {
  it('fullModel is a Track for track items and a context model otherwise', () => {
    const track = MusicHistoryItem.deJson({ type: 'track', data: { itemId: { trackId: '1' }, fullModel: { id: '1', title: 'T' } } })!;
    expect(track.data!.fullModel).toBeInstanceOf(Track);

    const album = MusicHistoryItem.deJson({
      type: 'album',
      data: { fullModel: { album: { id: 7, title: 'A' }, available: true, tracksCount: 3, wave: { name: 'w' } } },
    })!;
    const full = album.data!.fullModel as MusicHistoryContextFullModel;
    expect(full).toBeInstanceOf(MusicHistoryContextFullModel);
    expect(full.album?.title).toBe('A');
    expect(full.available).toBe(true);
    expect(full.tracksCount).toBe(3);
    expect(full.wave?.name).toBe('w');
  });
});

describe('misc typed fields', () => {
  it('ConcertSkeleton.blocks are SkeletonBlock models', () => {
    const skeleton = ConcertSkeleton.deJson({ id: 's', blocks: [{ id: 'b', type: 't' }] })!;
    expect(skeleton.blocks![0]).toBeInstanceOf(SkeletonBlock);
    expect(skeleton.blocks![0]!.id).toBe('b');
  });

  it('Genre.images is Images', () => {
    const genre = Genre.deJson({ id: 'g', images: { _208x208: 'a' } })!;
    expect(genre.images).toBeInstanceOf(Images);
  });

  it('TagResult.tag is Tag', () => {
    const result = TagResult.deJson({ tag: { id: 't', value: 'v', name: 'N' }, ids: ['1:2'] })!;
    expect(result.tag).toBeInstanceOf(Tag);
    expect(result.tag!.name).toBe('N');
    expect(result.ids).toEqual(['1:2']);
  });

  it('Feed and Event carry string fields', () => {
    const feed = Feed.deJson({ headlines: [{ type: 'notification', id: 'n1', message: 'm1' }, { type: 'x', id: 'n2' }], nextRevision: 'rev' })!;
    expect(feed.headlines).toHaveLength(2);
    expect(feed.headlines?.[0]).toBeInstanceOf(FeedHeadline);
    expect(feed.headlines?.[0]?.message).toBe('m1');
    expect(feed.headlines?.[1]?.id).toBe('n2');
    expect(feed.nextRevision).toBe('rev');
    const event = Event.deJson({ id: 'e', message: 'hello', device: 'phone' })!;
    expect(event.message).toBe('hello');
    expect(event.device).toBe('phone');
  });

  it('TrackShortOld has trackId and timestamp', () => {
    const t = TrackShortOld.deJson({ trackId: { id: '1' }, timestamp: 'now' })!;
    expect(t.trackId?.id).toBe('1');
    expect(t.timestamp).toBe('now');
  });
});
