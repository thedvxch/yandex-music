import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { Client } from '../src/client.js';
import { YnisonRebalancedError, YnisonServerError, YandexMusicError } from '../src/exceptions.js';
import { BASE_HEADERS, DEFAULT_CLIENT_HEADER } from '../src/request.js';
import { DESKTOP_CLIENT, DESKTOP_SIGN_KEY } from '../src/signRequest.js';
import { parseServerError } from '../src/ynison/client.js';
import { ANDROID_DEVICE_INFO, YNISON_ANDROID_APP_VERSION, androidDeviceInfo } from '../src/ynison/messages.js';
import { SkeletonSource } from '../src/models/skeleton.js';
import { clientWith } from './helpers/http.js';

const API = 'https://api.music.yandex.net';

const FILE_INFO = {
  trackId: '138756212',
  quality: 'lossless',
  codec: 'flac-mp4',
  bitrate: 0,
  transport: 'raw',
  gain: false,
  urls: ['https://strm-1.test/music/a', 'https://strm-2.test/music/a'],
  r128: { i: -7.4, tp: 0.9 },
};

/** Expected file-info signature, computed independently of the library. */
function expectedSign(ts: string, ids: string, quality: string, codecs: string, transport: string): string {
  return createHmac('sha256', DESKTOP_SIGN_KEY)
    .update(`${ts}${ids}${quality}${codecs.replace(/,/g, '')}${transport}`)
    .digest('base64')
    .slice(0, -1);
}

describe('batch and v2 file info', () => {
  test('tracksFileInfoBatch signs the comma-joined ids and parses result.downloadInfos', async () => {
    const { client, calls } = clientWith([
      { match: '/get-file-info/batch', body: { result: { downloadInfos: [FILE_INFO, { ...FILE_INFO, trackId: '2' }] } } },
    ]);
    const infos = await client.tracksFileInfoBatch(['138756212', 2], { quality: 'lossless' });
    expect(infos.map((i) => i.trackId)).toEqual(['138756212', '2']);
    expect(infos[0]!.links()).toHaveLength(2);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/get-file-info/batch');
    expect(url.searchParams.get('trackIds')).toBe('138756212,2');
    expect(url.searchParams.has('trackId')).toBe(false);
    expect(url.searchParams.get('transports')).toBe('raw');
    const q = url.searchParams;
    expect(q.get('sign')).toBe(expectedSign(q.get('ts')!, '138756212,2', 'lossless', q.get('codecs')!, 'raw'));
    expect(calls[0]!.headers['X-Yandex-Music-Client']).toBe(DESKTOP_CLIENT);
  });

  test('tracksFileInfoV2 parses the bare object, including r128', async () => {
    const { client, calls } = clientWith([{ match: '/resources/v2/file-info', body: FILE_INFO }]);
    const info = await client.tracksFileInfoV2(138756212, { quality: 'smart_preview' });
    expect(info?.codec).toBe('flac-mp4');
    expect(info?.r128?.i).toBe(-7.4);
    expect(info?.isEncrypted).toBe(false);
    const q = new URL(calls[0]!.url).searchParams;
    expect(q.get('trackId')).toBe('138756212');
    expect(q.get('quality')).toBe('smart_preview');
    expect(q.get('sign')).toBe(expectedSign(q.get('ts')!, '138756212', 'smart_preview', q.get('codecs')!, 'raw'));
  });

  test('tracksFileInfoBatchV2 parses fileInfos', async () => {
    const { client, calls } = clientWith([{ match: '/resources/v2/file-info/batch', body: { fileInfos: [FILE_INFO] } }]);
    const infos = await client.tracksFileInfoBatchV2([1, 2]);
    expect(infos).toHaveLength(1);
    expect(infos[0]!.r128?.tp).toBe(0.9);
    expect(new URL(calls[0]!.url).searchParams.get('trackIds')).toBe('1,2');
  });
});

describe('download-info anti-ad parameters', () => {
  test('sent by default, omitted with antiAdParams: false', async () => {
    const { client, calls } = clientWith([{ match: '/download-info', body: { result: [] } }]);
    await client.tracksDownloadInfo(5);
    await client.tracksDownloadInfo(5, false, { antiAdParams: false });
    const first = new URL(calls[0]!.url).searchParams;
    expect(first.get('from')).toBe('web-main');
    expect(first.get('external-domain')).toBe('music.yandex.ru');
    expect(first.get('overloading')).toBe('false');
    expect(new URL(calls[1]!.url).search).toBe('');
  });
});

describe('landing blocks', () => {
  test('waves', async () => {
    const { client } = clientWith([
      {
        match: '/landing-blocks/waves',
        body: {
          waves: [
            {
              id: 'mix',
              title: 'топ',
              items: [
                {
                  title: 'Русский рэп',
                  header: 'Моя волна по жанру',
                  stationId: 'genre:rusrap',
                  seeds: ['genre:rusrap'],
                  colors: { average: '#58cd9c', waveText: '#c1ffe5' },
                  agent: { animationUri: 'https://a.test/x', cover: { uri: 'c/%%' } },
                },
              ],
            },
          ],
        },
      },
    ]);
    const waves = await client.landingBlocksWaves();
    const item = waves!.waves![0]!.items![0]!;
    expect(item.stationId).toBe('genre:rusrap');
    expect(item.colors?.waveText).toBe('#c1ffe5');
    expect(item.agent?.cover?.uri).toBe('c/%%');
  });

  test('artists, new playlists and personal playlists share the items shape', async () => {
    const { client } = clientWith([
      {
        match: '/landing-blocks/artists',
        body: { items: [{ type: 'artist_item', data: { artist: { id: 1, name: 'A' }, trailer: { available: true } } }] },
      },
      {
        match: '/landing-blocks/new-playlists',
        body: {
          items: [
            { type: 'liked_playlist_item', data: { playlist: { uid: 1, kind: 3, title: 'P' }, likesCount: 10, trackCount: 20 } },
          ],
        },
      },
      {
        match: '/landing-blocks/personal-playlists',
        body: {
          items: [
            {
              type: 'personal_playlist_item',
              data: { playlist: { uid: 1, kind: 2, title: 'Плейлист дня' }, playlistType: 'playlistOfTheDay', notify: true, idForFrom: 'playlist_of_the_day' },
            },
          ],
        },
      },
    ]);
    expect((await client.landingBlocksArtists())!.items![0]!.data!.artist!.name).toBe('A');
    expect((await client.landingBlocksNewPlaylists())!.items![0]!.data!.likesCount).toBe(10);
    const personal = (await client.landingBlocksPersonalPlaylists())!.items![0]!.data!;
    expect(personal.playlistType).toBe('playlistOfTheDay');
    expect(personal.playlist?.kind).toBe(2);
  });

  test('new releases and in-style', async () => {
    const release = {
      cover: { uri: 'c/%%' },
      artists: [{ id: 1, name: 'A' }],
      album: { id: 9, title: '67 BARS', albumType: 'single' },
      releaseDate: '2026-11-26T21:00:00+00:00',
      trailer: { available: false },
    };
    const { client } = clientWith([
      { match: '/landing-blocks/new-releases', body: { newReleases: [release] } },
      { match: '/landing-blocks/in-style', body: { inStyleTabs: [{ id: 5, title: 'CUPSIZE', cover: { uri: 'x' }, items: [release] }] } },
    ]);
    const releases = await client.landingBlocksNewReleases();
    expect(releases!.newReleases![0]!.album!.title).toBe('67 BARS');
    expect(releases!.newReleases![0]!.releaseDate).toBe('2026-11-26T21:00:00+00:00');
    const style = await client.landingBlocksInStyle();
    expect(style!.inStyleTabs![0]!.items![0]!.artists![0]!.name).toBe('A');
  });

  test('skeleton and generic block fetch', async () => {
    const { client, calls } = clientWith([
      {
        match: '/landing/skeleton/main',
        body: {
          id: 'main',
          title: 'Для вас',
          blocks: [
            {
              id: 'TABS_BLOCK',
              type: 'TABS',
              data: { source: { uri: '/landing/skeleton/main/tabs' }, tabs: [{ id: 'foryou', title: 'Для вас', blocks: [] }], selectedTabIndex: 0 },
            },
          ],
        },
      },
      { match: '/landing/block/x', body: { items: [1, 2] } },
    ]);
    const skeleton = await client.landingSkeleton('main', { showWizard: false });
    expect(skeleton!.blocks![0]!.data!.tabs![0]!.id).toBe('foryou');
    expect(new URL(calls[0]!.url).searchParams.get('showWizard')).toBe('false');
    const source = SkeletonSource.deJson({ uri: '/landing/block/x', countWeb: 12 })!;
    expect(await client.landingBlockSource(source)).toEqual({ items: [1, 2] });
    expect(new URL(calls[1]!.url).searchParams.get('count')).toBe('12');
    await client.landingBlockSource(`${API}/landing/block/x`, { count: 3 });
    expect(new URL(calls[2]!.url).searchParams.get('count')).toBe('3');
    await expect(client.landingBlockSource('https://evil.test/landing/block/x')).rejects.toBeInstanceOf(YandexMusicError);
    expect(calls).toHaveLength(3);
  });

  test('landing/block/chart and concerts/landing/personal', async () => {
    const { client } = clientWith([
      {
        match: '/landing/block/chart',
        body: { id: 'c', type: 'chart', title: 'Чарт', menu: { items: [{ title: 'Россия', url: 'russia', selected: true }] }, chart: { uid: 1, kind: 2 } },
      },
      {
        match: '/concerts/landing/personal',
        body: { concerts: [{ id: 'u', concertTitle: 'Cupsize', city: 'Москва', datetime: '2027-03-17T20:00:00+03:00', eventInfo: { type: 'concert' } }] },
      },
    ]);
    const chart = await client.landingBlockChart();
    expect(chart!.chart!.kind).toBe(2);
    expect(chart!.menu!.items![0]!.url).toBe('russia');
    const concerts = await client.concertsLandingPersonal();
    expect(concerts!.concerts![0]!.concertTitle).toBe('Cupsize');
  });
});

describe('client identity defaults', () => {
  test('the default client header is the 2026.11.1 Android build; clientHeader overrides it', async () => {
    expect(BASE_HEADERS['X-Yandex-Music-Client']).toBe(DEFAULT_CLIENT_HEADER);
    expect(DEFAULT_CLIENT_HEADER).toBe('YandexMusicAndroid/26111171');
    const { client, calls } = clientWith([{ match: '/', body: { result: 1 } }], { clientHeader: 'YandexMusicAndroid/1' });
    await client.request.get(`${API}/x`);
    expect(calls[0]!.headers['X-Yandex-Music-Client']).toBe('YandexMusicAndroid/1');
    expect(new Client().request.headers['X-Yandex-Music-Client']).toBe(DEFAULT_CLIENT_HEADER);
  });

  test('Ynison Android identity: bumped default, overridable appVersion', () => {
    expect(ANDROID_DEVICE_INFO.appVersion).toBe(YNISON_ANDROID_APP_VERSION);
    expect(YNISON_ANDROID_APP_VERSION).toBe('2026.11.1');
    expect(androidDeviceInfo({ appVersion: '2027.01.1' })).toMatchObject({ type: 'ANDROID', appVersion: '2027.01.1' });
  });

  test('Ynison codes 300100001 / 300100002 classify as YnisonRebalancedError', () => {
    for (const code of ['300100001', '300100002']) {
      const err = parseServerError({ grpc_code: 14, message: 'moved', details: { 'ynison-error-code': code } });
      expect(err).toBeInstanceOf(YnisonRebalancedError);
      expect(err).toBeInstanceOf(YnisonServerError);
    }
  });
});
