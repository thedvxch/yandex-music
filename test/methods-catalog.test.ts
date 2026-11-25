import { describe, it, expect } from 'vitest';
import { clientWith } from './helpers/http.js';
import { IdMissingError } from '../src/exceptions.js';

const ok = (result: unknown = {}) => ({ body: { result } });

describe('tracks methods', () => {
  it('playerInformers encodes locations via params and sends a clean body', async () => {
    const { client, calls } = clientWith([{ match: '/player-informers', ...ok({}) }]);
    await client.playerInformers([{ trackId: 1, artistIds: [2, 3] }], ['a b', 1]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('POST');
    const u = new URL(calls[0]!.url);
    expect(u.pathname.endsWith('/player-informers')).toBe(true);
    expect(u.searchParams.get('locations')).toBe('a b,1');
    expect(calls[0]!.url).toContain('locations=a+b%2C1');
    expect(calls[0]!.headers['Content-Type']).toContain('application/json');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ tracks: [{ trackId: '1', artistIds: ['2', '3'] }] });
    expect(calls[0]!.body).not.toContain('albumId');
  });

  it('playerInformers without locations has no query', async () => {
    const { client, calls } = clientWith([{ match: '/player-informers', ...ok({}) }]);
    await client.playerInformers([{ trackId: 1, artistIds: [], albumId: 5 }]);
    expect(new URL(calls[0]!.url).search).toBe('');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ tracks: [{ trackId: '1', artistIds: [], albumId: '5' }] });
  });

  it('playsBulk puts client-now in the query and omits undefined keys', async () => {
    const { client, calls } = clientWith([{ match: '/plays', ...ok('ok') }]);
    const r = await client.playsBulk([{ trackId: 1, albumId: 2, from: 'x' }], '2020-01-01T00:00:00.000Z');
    expect(r).toBe(true);
    expect(calls[0]!.method).toBe('POST');
    expect(new URL(calls[0]!.url).searchParams.get('client-now')).toBe('2020-01-01T00:00:00.000Z');
    const body = JSON.parse(calls[0]!.body!) as { plays: Array<Record<string, unknown>> };
    const play = body.plays[0]!;
    expect(typeof play['playId']).toBe('string');
    expect((play['playId'] as string).length).toBeGreaterThan(0);
    expect(play).not.toHaveProperty('playlistId');
    expect(play).not.toHaveProperty('trackLengthSeconds');
    expect(play['trackId']).toBe('1');
    expect(play['albumId']).toBe('2');
  });

  it('playAudio without uid sends no uid key', async () => {
    const { client, calls } = clientWith([{ match: '/play-audio', ...ok('ok') }]);
    expect(await client.playAudio({ trackId: 1, from: 'x', albumId: 2 })).toBe(true);
    expect(calls[0]!.method).toBe('POST');
    const form = new URLSearchParams(calls[0]!.body!);
    expect(form.has('uid')).toBe(false);
    expect(form.get('track-id')).toBe('1');
    expect(form.get('album-id')).toBe('2');
  });

  it('playAudio uses an explicit uid', async () => {
    const { client, calls } = clientWith([{ match: '/play-audio', ...ok('ok') }]);
    await client.playAudio({ trackId: 1, from: 'x', albumId: 2, uid: 77 });
    expect(new URLSearchParams(calls[0]!.body!).get('uid')).toBe('77');
  });

  it('resolveUid still throws IdMissingError without init', () => {
    const { client } = clientWith([]);
    expect(() => client.resolveUid()).toThrow(IdMissingError);
  });
});

describe('artists / labels / concerts methods', () => {
  it('artistsSkeleton defaults to web-artist-default', async () => {
    const { client, calls } = clientWith([{ match: '/skeletons/', ...ok({}) }]);
    await client.artistsSkeleton(1);
    expect(calls[0]!.method).toBe('GET');
    expect(new URL(calls[0]!.url).pathname.endsWith('/artists/1/skeletons/web-artist-default')).toBe(true);
    await client.artistsSkeleton(1, 'other');
    expect(new URL(calls[1]!.url).pathname.endsWith('/artists/1/skeletons/other')).toBe(true);
  });

  it('labelAlbums omits undefined sort params', async () => {
    const { client, calls } = clientWith([{ match: '/labels/5/albums', ...ok({}) }]);
    await client.labelAlbums(5);
    const u = new URL(calls[0]!.url);
    expect(u.searchParams.get('page')).toBe('0');
    expect(u.searchParams.get('pageSize')).toBe('100');
    expect(u.searchParams.has('sortBy')).toBe(false);
    expect(u.searchParams.has('sortOrder')).toBe(false);
    expect(u.search).not.toContain('undefined');
  });

  it('labelAlbums sends sort params when given', async () => {
    const { client, calls } = clientWith([{ match: '/labels/5/albums', ...ok({}) }]);
    await client.labelAlbums(5, 1, 10, 'year', 'desc');
    const u = new URL(calls[0]!.url);
    expect(u.searchParams.get('sortBy')).toBe('year');
    expect(u.searchParams.get('sortOrder')).toBe('desc');
    expect(u.searchParams.get('page')).toBe('1');
    expect(u.searchParams.get('pageSize')).toBe('10');
  });

  it('label GETs /labels/{id}', async () => {
    const { client, calls } = clientWith([{ match: '/labels/9', ...ok({ id: 9, name: 'L' }) }]);
    const l = await client.label(9);
    expect(calls[0]!.method).toBe('GET');
    expect(l?.name).toBe('L');
  });

  it('concertsLandingArtists passes locations as an encoded query', async () => {
    const { client, calls } = clientWith([{ match: '/concerts/landing/artists', ...ok({}) }]);
    await client.concertsLandingArtists([1, 2], ['a b', 3]);
    expect(calls[0]!.method).toBe('POST');
    const u = new URL(calls[0]!.url);
    expect(u.pathname.endsWith('/concerts/landing/artists')).toBe(true);
    expect(u.searchParams.get('locations')).toBe('a b,3');
    expect(calls[0]!.url).toContain('locations=a+b%2C3');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ artistIds: ['1', '2'] });
  });

  it('concertsLandingArtists without locations has no query', async () => {
    const { client, calls } = clientWith([{ match: '/concerts/landing/artists', ...ok({}) }]);
    await client.concertsLandingArtists([1]);
    expect(new URL(calls[0]!.url).search).toBe('');
  });

  it('labelArtists GETs page and pageSize with defaults 0 and 100', async () => {
    const { client, calls } = clientWith([{ match: '/labels/', ...ok({}) }]);
    await client.labelArtists(77);
    await client.labelArtists(77, 2, 30);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
    const first = new URL(calls[0]!.url);
    expect(first.pathname).toBe('/labels/77/artists');
    expect(Object.fromEntries(first.searchParams)).toEqual({ page: '0', pageSize: '100' });
    expect(Object.fromEntries(new URL(calls[1]!.url).searchParams)).toEqual({ page: '2', pageSize: '30' });
  });

  it('getModel-based concert GETs hit the expected paths', async () => {
    const { client, calls } = clientWith([{ match: '/concerts', ...ok({}) }, { match: '/artists/4/concerts', ...ok({}) }]);
    await client.artistsConcerts(4);
    await client.concertInfo(5);
    await client.concertSkeleton(6);
    await client.concertsLocations();
    await client.concertsTabConfig();
    const paths = calls.map((c) => new URL(c.url).pathname.replace(/^.*?(?=\/(artists|concerts))/, ''));
    expect(paths).toEqual([
      '/artists/4/concerts',
      '/concerts/5/info',
      '/concerts/6/skeletons/concert_page',
      '/concerts/locations',
      '/concerts/tab-config',
    ]);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });
});
