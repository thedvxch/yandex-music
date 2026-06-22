import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Album,
  Artist,
  Best,
  Client,
  DeviceCode,
  Like,
  OAuthToken,
  NetworkError,
  NotFoundError,
  Playlist,
  Search,
  Suggestions,
  Track,
  YandexMusicError,
  convertTrackIdToNumber,
  getSignRequest,
  isJsonObject,
} from '../src/index.js';

test('Track.deJson maps scalars and nested models', () => {
  const track = Track.deJson({
    id: '42:7',
    title: 'Sample',
    durationMs: 200000,
    available: true,
    artists: [{ id: 1, name: 'Artist One' }],
    albums: [{ id: 9, title: 'Album Nine' }],
    normalization: { gain: -7.5, peak: 32000 },
    lyricsInfo: { hasAvailableSyncLyrics: true, hasAvailableTextLyrics: false },
  });

  assert.ok(track);
  assert.equal(track.title, 'Sample');
  assert.equal(track.durationMs, 200000);
  assert.equal(track.available, true);
  assert.equal(track.artists?.length, 1);
  assert.ok(track.artists?.[0] instanceof Artist);
  assert.equal(track.artists?.[0]?.name, 'Artist One');
  assert.ok(track.albums?.[0] instanceof Album);
  assert.equal(track.albums?.[0]?.title, 'Album Nine');
  assert.equal(track.normalization?.gain, -7.5);
  assert.equal(track.lyricsInfo?.hasAvailableSyncLyrics, true);
});

test('Track.deJson rejects non-objects', () => {
  assert.equal(Track.deJson(null), null);
  assert.equal(Track.deJson('nope'), null);
  assert.equal(Track.deJson([]), null);
});

test('Album.deJson groups tracks into volumes', () => {
  const album = Album.deJson({
    id: 9,
    title: 'Album Nine',
    trackCount: 2,
    volumes: [[{ id: 1, title: 'A' }], [{ id: 2, title: 'B' }]],
    labels: [{ id: 5, name: 'Label' }, 'Bare Label'],
  });

  assert.ok(album);
  assert.equal(album.volumes?.length, 2);
  assert.equal(album.volumes?.[0]?.[0]?.title, 'A');
  assert.equal(album.volumes?.[1]?.[0]?.title, 'B');
  assert.equal(album.labels?.length, 2);
  assert.equal(album.labels?.[1], 'Bare Label');
});

test('getSignRequest produces a base64 signature for a compound id', () => {
  const sign = getSignRequest('42:7');
  assert.equal(typeof sign.timestamp, 'number');
  assert.ok(sign.value.length > 0);
  assert.match(sign.value, /^[A-Za-z0-9+/]+=*$/);
});

test('convertTrackIdToNumber drops the album suffix', () => {
  assert.equal(convertTrackIdToNumber('42:7'), 42);
  assert.equal(convertTrackIdToNumber(99), 99);
});

test('exception hierarchy and names', () => {
  const error = new NotFoundError('missing');
  assert.ok(error instanceof NotFoundError);
  assert.ok(error instanceof NetworkError);
  assert.ok(error instanceof YandexMusicError);
  assert.equal(error.name, 'NotFoundError');
  assert.equal(error.message, 'missing');
});

test('isJsonObject narrows correctly', () => {
  assert.equal(isJsonObject({}), true);
  assert.equal(isJsonObject([]), false);
  assert.equal(isJsonObject(null), false);
  assert.equal(isJsonObject('x'), false);
});

test('Search.deJson builds typed result blocks and best match', () => {
  const search = Search.deJson({
    searchRequestId: 'req-1',
    text: 'query',
    best: { type: 'artist', result: { id: 7, name: 'Best Artist' } },
    tracks: { type: 'track', total: 1, perPage: 20, order: 0, results: [{ id: 1, title: 'T' }] },
    albums: { total: 0, perPage: 20, order: 1, results: [] },
  });

  assert.ok(search);
  assert.equal(search.searchRequestId, 'req-1');
  assert.ok(search.best instanceof Best);
  assert.ok(search.best?.result instanceof Artist);
  assert.equal((search.best?.result as Artist).name, 'Best Artist');
  assert.equal(search.tracks?.total, 1);
  assert.ok(search.tracks?.results?.[0] instanceof Track);
  assert.equal(search.tracks?.results?.[0]?.title, 'T');
  assert.equal(search.albums?.type, 'album'); // filled from the type hint
});

test('Suggestions.deJson maps best + completions', () => {
  const sug = Suggestions.deJson({
    best: { type: 'track', result: { id: 9, title: 'Z' } },
    suggestions: ['ab', 'abc'],
  });
  assert.ok(sug);
  assert.deepEqual(sug.suggestions, ['ab', 'abc']);
  assert.ok(sug.best?.result instanceof Track);
});

test('Like.deJson resolves the entity by type', () => {
  const like = Like.deJson({ type: 'album', id: '5', album: { id: 5, title: 'A' } });
  assert.ok(like);
  assert.ok(like.album instanceof Album);
  assert.equal(like.album?.title, 'A');
});

test('Playlist.deJson maps owner, tracks and nesting', () => {
  const playlist = Playlist.deJson({
    kind: 3,
    title: 'My list',
    trackCount: 1,
    owner: { uid: 1, login: 'me' },
    tracks: [{ id: '42', timestamp: '2020' }],
  });
  assert.ok(playlist);
  assert.equal(playlist.title, 'My list');
  assert.equal(playlist.owner?.login, 'me');
  assert.equal(playlist.tracks?.[0]?.id, '42');
});

test('device auth models parse the OAuth snake_case payload', () => {
  const code = DeviceCode.deJson({
    device_code: 'd',
    user_code: 'ABCD',
    verification_url: 'u',
    interval: 5,
    expires_in: 300,
  });
  assert.equal(code?.userCode, 'ABCD');
  assert.equal(code?.deviceCode, 'd');
  assert.equal(code?.expiresIn, 300);

  const token = OAuthToken.deJson({ access_token: 'tok', token_type: 'bearer', expires_in: 100 });
  assert.equal(token?.accessToken, 'tok');
  assert.equal(token?.tokenType, 'bearer');
  assert.equal(token?.expiresIn, 100);
});

test('client exposes the new method surface', () => {
  const client = new Client({ token: 'x' });
  for (const method of [
    'tracks',
    'search',
    'searchSuggest',
    'usersLikesTracksAdd',
    'usersLikesTracks',
    'usersPlaylists',
    'playlist',
    'requestDeviceCode',
    'deviceAuth',
  ]) {
    assert.equal(typeof (client as unknown as Record<string, unknown>)[method], 'function', method);
  }
});
