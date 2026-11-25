import { describe, expect, test } from 'vitest';
import { Artist, BadRequestError, IdMissingError, Like } from '../src/index.js';
import { clientWith } from './helpers/http.js';

const PL = { kind: 5, revision: 7, title: 'p' };
const BASE = 'https://api.music.yandex.net';

describe('likes', () => {
  test('usersLikesTracks sends if-modified-since-revision only when given', async () => {
    const { client, calls } = clientWith([
      { match: '/likes/tracks', body: { result: { library: { uid: 1, revision: 2, tracks: [] } } } },
    ]);
    await client.usersLikesTracks(1);
    await client.usersLikesTracks(1, 4);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.url).toBe(`${BASE}/users/1/likes/tracks`);
    expect(calls[1]!.url).toBe(`${BASE}/users/1/likes/tracks?if-modified-since-revision=4`);
  });

  test('usersDislikesTracks sends if-modified-since-revision', async () => {
    const { client, calls } = clientWith([
      { match: '/dislikes/tracks', body: { result: { library: { uid: 1, revision: 2, tracks: [] } } } },
    ]);
    await client.usersDislikesTracks(1, 9);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/dislikes/tracks?if-modified-since-revision=9`);
  });

  test('usersLikesAlbums sends rich=true by default and honours false', async () => {
    const { client, calls } = clientWith([{ match: '/likes/albums', body: { result: [] } }]);
    await client.usersLikesAlbums(1);
    await client.usersLikesAlbums(1, false);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/likes/albums?rich=true`);
    expect(calls[1]!.url).toBe(`${BASE}/users/1/likes/albums?rich=false`);
  });

  const artistBody = {
    result: [
      { id: 1, name: 'A' },
      { id: '2', timestamp: 't', artist: { id: 2, name: 'B' } },
    ],
  };

  test('usersLikesArtists handles bare and wrapped artists without extra params', async () => {
    const { client, calls } = clientWith([{ match: '/likes/artists', body: artistBody }]);
    const artists = await client.usersLikesArtists(1);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/likes/artists`);
    expect(artists.map((a) => a.name)).toEqual(['A', 'B']);
    expect(artists[1]).toBeInstanceOf(Artist);
  });

  test('usersLikesArtistsWithTimestamps returns Like with artist for both shapes', async () => {
    const { client, calls } = clientWith([{ match: '/likes/artists', body: artistBody }]);
    const likes = await client.usersLikesArtistsWithTimestamps(1);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/likes/artists?with-timestamps=true`);
    expect(likes).toHaveLength(2);
    for (const l of likes) {
      expect(l).toBeInstanceOf(Like);
      expect(l.type).toBe('artist');
      expect(l.artist).toBeInstanceOf(Artist);
    }
    expect(likes[1]!.timestamp).toBe('t');
  });

  test('usersLikesClipsAdd puts clip-id in the query, not the body', async () => {
    const { client, calls } = clientWith([{ match: '/likes/clips/add', body: { result: 'ok' } }]);
    expect(await client.usersLikesClipsAdd(77, 1)).toBe(true);
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.url).toBe(`${BASE}/users/1/likes/clips/add?clip-id=77`);
    expect(calls[0]!.body ?? '').not.toContain('clip-id');
  });

  test('missing uid throws IdMissingError before any request', async () => {
    const { client, calls } = clientWith([]);
    await expect(client.usersLikesTracks()).rejects.toThrow(IdMissingError);
    await expect(client.usersLikesTracksAdd(1)).rejects.toThrow(IdMissingError);
    expect(calls).toHaveLength(0);
  });
});

describe('playlists revision', () => {
  test('omitted revision fetches the current one first', async () => {
    const { client, calls } = clientWith([
      { method: 'GET', match: '/users/1/playlists/5', body: { result: PL } },
      { method: 'POST', match: '/playlists/5/change', body: { result: PL } },
    ]);
    await client.usersPlaylistsDeleteTrack(5, 0, 1, undefined, 1);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.method).toBe('GET');
    expect(calls[0]!.url).toBe(`${BASE}/users/1/playlists/5`);
    const sent = new URLSearchParams(calls[1]!.body);
    expect(sent.get('revision')).toBe('7');
    expect(sent.get('kind')).toBe('5');
    expect(sent.get('diff')).toContain('delete');
  });

  test('insertTrack sends kind, revision and the exact insert diff', async () => {
    const { client, calls } = clientWith([{ method: 'POST', match: '/playlists/5/change', body: { result: PL } }]);
    await client.usersPlaylistsInsertTrack(5, 10, 20, 2, 7, 1);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/playlists/5/change`);
    const sent = new URLSearchParams(calls[0]!.body);
    expect([...sent.keys()].sort()).toEqual(['diff', 'kind', 'revision']);
    expect(sent.get('kind')).toBe('5');
    expect(sent.get('revision')).toBe('7');
    expect(JSON.parse(sent.get('diff')!)).toEqual([{ op: 'insert', at: 2, tracks: [{ id: 10, albumId: 20 }] }]);
  });

  test('deleteTrack sends kind, revision and the exact delete diff', async () => {
    const { client, calls } = clientWith([{ method: 'POST', match: '/playlists/5/change', body: { result: PL } }]);
    await client.usersPlaylistsDeleteTrack(5, 1, 3, 7, 1);
    const sent = new URLSearchParams(calls[0]!.body);
    expect([...sent.keys()].sort()).toEqual(['diff', 'kind', 'revision']);
    expect(sent.get('revision')).toBe('7');
    expect(JSON.parse(sent.get('diff')!)).toEqual([{ op: 'delete', from: 1, to: 3 }]);
  });

  test('insertTrack without revision also fetches it', async () => {
    const { client, calls } = clientWith([
      { method: 'GET', match: '/users/1/playlists/5', body: { result: PL } },
      { method: 'POST', match: '/playlists/5/change', body: { result: PL } },
    ]);
    await client.usersPlaylistsInsertTrack(5, 10, 20, 0, undefined, 1);
    expect(calls).toHaveLength(2);
    expect(new URLSearchParams(calls[1]!.body).get('revision')).toBe('7');
  });

  test('falls back to revision 1 when the playlist has none', async () => {
    const { client, calls } = clientWith([
      { method: 'GET', match: '/users/1/playlists/5', body: { result: { kind: 5 } } },
      { method: 'POST', match: '/playlists/5/change', body: { result: PL } },
    ]);
    await client.usersPlaylistsChange(5, '[]', undefined, 1);
    expect(new URLSearchParams(calls[1]!.body).get('revision')).toBe('1');
  });

  test('explicit revision makes one call and is sent unchanged', async () => {
    const { client, calls } = clientWith([{ method: 'POST', match: '/playlists/5/change', body: { result: PL } }]);
    await client.usersPlaylistsChange(5, '[]', 3, 1);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/playlists/5/change`);
    expect(new URLSearchParams(calls[0]!.body).get('revision')).toBe('3');
  });

  test('missing uid throws IdMissingError', async () => {
    const { client } = clientWith([]);
    await expect(client.usersPlaylistsChange(5, '[]', 3)).rejects.toThrow(IdMissingError);
  });
});

describe('presaves', () => {
  test('defaults and uid resolution', async () => {
    const { client, calls } = clientWith([{ match: '/presaves', body: { result: {} } }]);
    await client.usersPresaves(undefined, undefined, 1);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/presaves?includeReleased=true&includeUpcoming=true`);
    await expect(client.usersPresaves()).rejects.toThrow(IdMissingError);
  });
});

describe('presave writes', () => {
  test('usersPresavesAdd posts albumId and likeAfterRelease (lowercase, default true)', async () => {
    const { client, calls } = clientWith([{ method: 'POST', match: '/presaves/add', body: { result: 'ok' } }]);
    expect(await client.usersPresavesAdd(9, undefined, 1)).toBe(true);
    expect(await client.usersPresavesAdd(9, false, 1)).toBe(true);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/presaves/add`);
    expect(Object.fromEntries(new URLSearchParams(calls[0]!.body))).toEqual({ albumId: '9', likeAfterRelease: 'true' });
    expect(new URLSearchParams(calls[1]!.body).get('likeAfterRelease')).toBe('false');
  });

  test('usersPresavesRemove posts only albumId and is false on a non-ok result', async () => {
    const { client, calls } = clientWith([{ method: 'POST', match: '/presaves/remove', body: { result: 'nope' } }]);
    expect(await client.usersPresavesRemove(9, 1)).toBe(false);
    expect(calls[0]!.url).toBe(`${BASE}/users/1/presaves/remove`);
    expect(Object.fromEntries(new URLSearchParams(calls[0]!.body))).toEqual({ albumId: '9' });
    await expect(client.usersPresavesRemove(9)).rejects.toThrow(IdMissingError);
  });
});

describe('search', () => {
  // The reference sends str(bool) ('False'/'True'); this library sends lowercase.
  test('query keys are text, nocorrect, type, page and playlist-in-best', async () => {
    const { client, calls } = clientWith([{ match: '/search', body: { result: {} } }]);
    await client.search('a b');
    await client.search('x', true, 'track', 2, false);
    const first = new URL(calls[0]!.url);
    expect(first.pathname).toBe('/search');
    expect([...first.searchParams.keys()]).toEqual(['text', 'nocorrect', 'type', 'page', 'playlist-in-best']);
    expect(Object.fromEntries(first.searchParams)).toEqual({
      text: 'a b',
      nocorrect: 'false',
      type: 'all',
      page: '0',
      'playlist-in-best': 'true',
    });
    expect(Object.fromEntries(new URL(calls[1]!.url).searchParams)).toEqual({
      text: 'x',
      nocorrect: 'true',
      type: 'track',
      page: '2',
      'playlist-in-best': 'false',
    });
  });

  test('bare string result throws BadRequestError', async () => {
    const { client } = clientWith([{ match: '/search', body: { result: 'bad request' } }]);
    await expect(client.search('x')).rejects.toThrow(BadRequestError);
  });

  test('history needs a uid', async () => {
    const { client } = clientWith([]);
    await expect(client.usersSearchHistory()).rejects.toThrow(IdMissingError);
  });
});
