import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Album,
  Artist,
  NetworkError,
  NotFoundError,
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
