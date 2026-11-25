import { describe, expect, it } from 'vitest';
import {
  Album,
  AlbumActionButton,
  AlbumSimilarEntities,
  AlbumTrailerStatus,
  Artist,
  ArtistDonationInfo,
  ArtistInfo,
  ArtistSkeleton,
  ArtistTrailerStatus,
  BriefInfo,
  CustomWave,
  SimilarEntityItem,
  SkeletonBlock,
  UpcomingAlbum,
} from '../src/index.js';
import type { Client, JSONObject, UnknownFieldsReport } from '../src/index.js';

function collect(): { client: Client; reports: UnknownFieldsReport[] } {
  const reports: UnknownFieldsReport[] = [];
  const client = { onUnknownField: (r: UnknownFieldsReport) => void reports.push(r) } as unknown as Client;
  return { client, reports };
}

describe('Album', () => {
  const raw: JSONObject = {
    id: 1,
    title: 'T',
    durationSec: 120,
    originalReleaseYear: 1999,
    buy: [{ a: 1 }],
    prerolls: [],
    availableAsRbt: true,
    rememberPosition: false,
    albums: [{ id: 2, title: 'Nested' }],
    hasTrailer: true,
    trailer: { available: true },
    backgroundImageUrl: 'bg',
    sortOrder: 'asc',
    metaTagId: 'm',
    childContent: false,
    customWave: { title: 'w' },
    cover: { type: 'from-album-cover', uri: 'u' },
    derivedColors: { average: '#fff' },
    pager: { page: 0, perPage: 10, total: 1 },
    actionButton: { text: 'Go', url: 'https://x', color: '#000', viewBrowser: true },
  };

  it('maps the new scalar fields', () => {
    const album = Album.deJson(raw)!;
    expect(album.durationSec).toBe(120);
    expect(album.originalReleaseYear).toBe(1999);
    expect(album.buy).toEqual([{ a: 1 }]);
    expect(album.prerolls).toEqual([]);
    expect(album.availableAsRbt).toBe(true);
    expect(album.rememberPosition).toBe(false);
    expect(album.backgroundImageUrl).toBe('bg');
    expect(album.sortOrder).toBe('asc');
    expect(album.customWave).toBeInstanceOf(CustomWave);
  });

  it('types nested albums', () => {
    const album = Album.deJson(raw)!;
    expect(album.albums![0]).toBeInstanceOf(Album);
    expect(album.albums![0]!.title).toBe('Nested');
  });

  it('types trailer as AlbumTrailerStatus (retyped raw field)', () => {
    const album = Album.deJson(raw)!;
    expect(album.trailer).toBeInstanceOf(AlbumTrailerStatus);
    expect(album.trailer!.available).toBe(true);
    expect(Album.deJson({ id: 1 })!.trailer).toBeUndefined();
  });

  it('maps AlbumActionButton.viewBrowser', () => {
    const album = Album.deJson(raw)!;
    expect(album.actionButton).toBeInstanceOf(AlbumActionButton);
    expect(album.actionButton!.viewBrowser).toBe(true);
  });

  it('reports no unknown fields for a fully mapped album', () => {
    const { client, reports } = collect();
    Album.deJson(raw, client);
    expect(reports).toEqual([]);
  });
});

describe('Artist', () => {
  const raw: JSONObject = {
    id: 5,
    name: 'A',
    hasTrailer: true,
    fullNames: ['A B'],
    aliases: ['ab'],
    trailer: { available: false },
    donationInfo: { title: 'Support', url: 'https://d' },
    actionButton: { text: 'Go', url: 'https://x' },
    decomposed: ['A', ' & ', { id: 6, name: 'B' }],
  };

  it('maps new fields and retyped trailer/donationInfo', () => {
    const artist = Artist.deJson(raw)!;
    expect(artist.hasTrailer).toBe(true);
    expect(artist.fullNames).toEqual(['A B']);
    expect(artist.aliases).toEqual(['ab']);
    expect(artist.trailer).toBeInstanceOf(ArtistTrailerStatus);
    expect(artist.trailer!.available).toBe(false);
    expect(artist.donationInfo).toBeInstanceOf(ArtistDonationInfo);
    expect(artist.donationInfo!.url).toBe('https://d');
    expect(artist.actionButton).toBeInstanceOf(AlbumActionButton);
    expect(Array.isArray(artist.decomposed)).toBe(true);
  });

  it('reports no unknown fields', () => {
    const { client, reports } = collect();
    Artist.deJson(raw, client);
    expect(reports).toEqual([]);
  });
});

describe('BriefInfo', () => {
  const raw: JSONObject = {
    artist: { id: 1 },
    actionButton: { text: 'Go' },
    backgroundImageUrl: 'bg',
    backgroundVideoId: 'vid',
    backgroundVideoUrl: 'https://v',
    bandlinkScannerLink: 'https://b',
    hasTrailer: true,
    clips: [{ clipId: 3 }],
    customWave: { title: 'w' },
    links: [{ title: 'l' }],
    concerts: [{ id: 'raw' }],
    upcomingAlbum: {
      id: 9,
      title: 'Soon',
      type: 'single',
      releaseDate: '2027-01-01',
      millisecondsUntilRelease: 1000,
      coverUri: 'c',
      presaved: true,
      artists: [{ id: 1 }],
      contentRestrictions: { available: true },
    },
  };

  it('maps the new fields', () => {
    const info = BriefInfo.deJson(raw)!;
    expect(info.actionButton).toBeInstanceOf(AlbumActionButton);
    expect(info.backgroundImageUrl).toBe('bg');
    expect(info.backgroundVideoId).toBe('vid');
    expect(info.backgroundVideoUrl).toBe('https://v');
    expect(info.concerts).toEqual([{ id: 'raw' }]);
    expect(info.upcomingAlbum).toBeInstanceOf(UpcomingAlbum);
    expect(info.upcomingAlbum!.presaved).toBe(true);
    expect(info.upcomingAlbum!.artists![0]).toBeInstanceOf(Artist);
    expect(info.upcomingAlbum!.millisecondsUntilRelease).toBe(1000);
  });

  it('reports no unknown fields', () => {
    const { client, reports } = collect();
    BriefInfo.deJson(raw, client);
    expect(reports).toEqual([]);
  });
});

describe('ArtistInfo / ArtistSkeleton / AlbumSimilarEntities', () => {
  it('types ArtistInfo.trailer', () => {
    const info = ArtistInfo.deJson({ trailer: { available: true } })!;
    expect(info.trailer).toBeInstanceOf(ArtistTrailerStatus);
  });

  it('types ArtistSkeleton.blocks', () => {
    const skeleton = ArtistSkeleton.deJson({ id: 's', blocks: [{ id: 'b', type: 't' }] })!;
    expect(skeleton.blocks![0]).toBeInstanceOf(SkeletonBlock);
    expect(skeleton.blocks![0]!.id).toBe('b');
  });

  it('types AlbumSimilarEntities.items', () => {
    const similar = AlbumSimilarEntities.deJson({ items: [{ type: 'album' }] })!;
    expect(similar.items![0]).toBeInstanceOf(SimilarEntityItem);
    expect(similar.items![0]!.type).toBe('album');
  });
});
