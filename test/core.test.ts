import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  Album,
  Artist,
  Best,
  BriefInfo,
  Cover,
  reportUnknown,
  Clip,
  Concert,
  Credits,
  Metatags,
  Pin,
  Status,
  RealtimeClient,
  parseStateFrame,
  parseRedirectFrame,
  liveProgressMs,
  Client,
  Dashboard,
  DeviceCode,
  Difference,
  GeneratedPlaylist,
  PlaylistId,
  Genre,
  Landing,
  MusicHistory,
  Queue,
  StationTracksResult,
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

test('Landing.deJson maps blocks and entities', () => {
  const landing = Landing.deJson({
    pumpkin: false,
    contentId: 'home',
    blocks: [
      {
        id: 'b1',
        type: 'personal-playlists',
        title: 'For you',
        entities: [{ id: 'e1', type: 'personal-playlist', data: { foo: 1 } }],
      },
    ],
  });
  assert.ok(landing);
  assert.equal(landing.blocks?.length, 1);
  assert.equal(landing.blocks?.[0]?.title, 'For you');
  assert.equal(landing.blocks?.[0]?.entities?.[0]?.id, 'e1');
});

test('Genre.deJson nests sub-genres', () => {
  const genre = Genre.deJson({
    id: 'pop',
    title: 'Pop',
    weight: 10,
    subGenres: [{ id: 'kpop', title: 'K-Pop' }],
  });
  assert.ok(genre);
  assert.equal(genre.subGenres?.[0]?.title, 'K-Pop');
});

test('rotor models map stations and track sequence', () => {
  const dash = Dashboard.deJson({
    dashboardId: 'd1',
    pumpkin: false,
    stations: [{ station: { id: { type: 'genre', tag: 'pop' }, name: 'Pop' } }],
  });
  assert.equal(dash?.stations?.[0]?.station?.name, 'Pop');
  assert.equal(dash?.stations?.[0]?.station?.id?.tag, 'pop');

  const tracks = StationTracksResult.deJson({
    id: { type: 'genre', tag: 'pop' },
    batchId: 'batch',
    sequence: [{ type: 'track', liked: false, track: { id: 1, title: 'T' } }],
  });
  assert.equal(tracks?.batchId, 'batch');
  assert.equal(tracks?.sequence?.[0]?.track?.title, 'T');
});

test('Queue.deJson maps context and track refs', () => {
  const queue = Queue.deJson({
    id: 'q1',
    currentIndex: 2,
    modified: '2024',
    context: { type: 'playlist', id: '5:3' },
    tracks: [{ id: 1, albumId: 9 }],
  });
  assert.ok(queue);
  assert.equal(queue.currentIndex, 2);
  assert.equal(queue.context?.type, 'playlist');
  assert.equal(queue.tracks?.[0]?.id, 1);
});

test('MusicHistory.deJson exposes the tab → group → item path', () => {
  const history = MusicHistory.deJson({
    historyTabs: [
      {
        date: '2024-01-01',
        items: [{ tracks: [{ type: 'track', data: { itemId: { trackId: '42', albumId: '9' } } }] }],
      },
    ],
  });
  const trackId = history?.historyTabs?.[0]?.items?.[0]?.tracks?.[0]?.data?.itemId?.trackId;
  assert.equal(trackId, '42');
});

test('BriefInfo.deJson maps the artist aggregate', () => {
  const info = BriefInfo.deJson({
    artist: { id: 1, name: 'A' },
    albums: [{ id: 9, title: 'Album' }],
    similarArtists: [{ id: 2, name: 'B' }],
    popularTracks: [{ id: '1', title: 'T' }],
    playlistIds: [{ uid: 5, kind: 3 }],
    stats: { lastMonthListeners: 1000, lastMonthListenersDelta: 50 },
    hasPromotions: false,
  });
  assert.ok(info);
  assert.equal(info.artist?.name, 'A');
  assert.equal(info.albums?.[0]?.title, 'Album');
  assert.equal(info.similarArtists?.[0]?.name, 'B');
  assert.ok(info.playlistIds?.[0] instanceof PlaylistId);
  assert.equal(info.playlistIds?.[0]?.playlistId, '5:3');
  assert.equal(info.stats?.lastMonthListeners, 1000);
});

test('GeneratedPlaylist.deJson nests the underlying playlist', () => {
  const gen = GeneratedPlaylist.deJson({
    type: 'playlistOfTheDay',
    ready: true,
    notify: false,
    data: { kind: 1, title: 'Daily' },
  });
  assert.ok(gen);
  assert.equal(gen.type, 'playlistOfTheDay');
  assert.equal(gen.data?.title, 'Daily');
});

test('Difference serializes insert and delete operations', () => {
  const insert = new Difference().addInsert(0, { id: '42', albumId: '9' }).toJson();
  assert.deepEqual(JSON.parse(insert), [{ op: 'insert', at: 0, tracks: [{ id: '42', albumId: '9' }] }]);

  const del = new Difference().addDelete(1, 3).toJson();
  assert.deepEqual(JSON.parse(del), [{ op: 'delete', from: 1, to: 3 }]);
});

test('small-domain models parse their payloads', () => {
  const clip = Clip.deJson({ clipId: 7, title: 'C', artists: [{ id: 1, name: 'A' }], explicit: true });
  assert.equal(clip?.clipId, 7);
  assert.equal(clip?.artists?.[0]?.name, 'A');

  const credits = Credits.deJson({ credits: [{ title: 'Producer', value: 'Someone' }] });
  assert.equal(credits?.credits?.[0]?.title, 'Producer');

  const pin = Pin.deJson({ type: 'album_item', data: { id: 5, title: 'Album' } });
  assert.equal(pin?.type, 'album_item');
  assert.equal(pin?.data?.title, 'Album');

  const concert = Concert.deJson({ id: 'c1', city: 'Moscow', minPrice: { value: 1000, currency: 'RUB' } });
  assert.equal(concert?.city, 'Moscow');
  assert.equal(concert?.minPrice?.value, 1000);

  const metatags = Metatags.deJson({
    trees: [{ title: 'Moods', navigationId: 'moods', leaves: [{ tag: 'happy', title: 'Happy' }] }],
  });
  assert.equal(metatags?.trees?.[0]?.leaves?.[0]?.tag, 'happy');
});

test('Status.deJson types permissions, subscription and plus', () => {
  const status = Status.deJson({
    account: { uid: 1, login: 'me' },
    permissions: { until: '2030', values: ['feed-play'], default: ['feed-play'] },
    plus: { hasPlus: true, isTutorialCompleted: false },
    subscription: {
      hadAnySubscription: true,
      autoRenewable: [{ expires: '2030', vendor: 'App Store', product: { productId: 'p', price: { amount: 169, currency: 'RUB' } } }],
    },
  });
  assert.ok(status);
  assert.equal(status.account?.login, 'me');
  assert.deepEqual(status.permissions?.values, ['feed-play']);
  assert.equal(status.plus?.hasPlus, true);
  assert.equal(status.subscription?.autoRenewable?.[0]?.product?.price?.amount, 169);
});

test('parseStateFrame reads snake_case player state', () => {
  const state = parseStateFrame(
    JSON.stringify({
      player_state: {
        status: { paused: false, duration_ms: '200000', progress_ms: '5000', playback_speed: 1, version: { timestamp_ms: '1700000000000' } },
        player_queue: {
          current_playable_index: 1,
          entity_id: '5:3',
          entity_type: 'PLAYLIST',
          playable_list: [{ playable_id: '10' }, { playable_id: '20' }],
        },
      },
    }),
  );
  assert.equal(state.paused, false);
  assert.equal(state.durationMs, 200000);
  assert.equal(state.currentPlayableIndex, 1);
  assert.equal(state.playableList[1]?.playableId, '20');
  assert.equal(state.entityType, 'PLAYLIST');
});

test('parseRedirectFrame requires host, ticket and session', () => {
  const r = parseRedirectFrame(JSON.stringify({ host: 'h', redirect_ticket: 't', session_id: 42 }));
  assert.equal(r.host, 'h');
  assert.equal(r.redirectTicket, 't');
  assert.equal(r.sessionId, '42');
  assert.throws(() => parseRedirectFrame(JSON.stringify({ host: 'h' })));
});

test('liveProgressMs extrapolates only while playing', () => {
  const paused = liveProgressMs({
    playableList: [], currentPlayableIndex: 0, entityId: null, entityType: null,
    paused: true, durationMs: 1000, progressMs: 500, playbackSpeed: 1, timestampMs: Date.now() - 10_000,
  });
  assert.equal(paused, 500);

  const playing = liveProgressMs({
    playableList: [], currentPlayableIndex: 0, entityId: null, entityType: null,
    paused: false, durationMs: 1_000_000, progressMs: 0, playbackSpeed: 1, timestampMs: Date.now() - 1000,
  });
  assert.ok(playing >= 900 && playing <= 1100);
});

test('client.realtime returns an event emitter and validates token', () => {
  const rt = new Client({ token: 'x' }).realtime();
  assert.ok(rt instanceof RealtimeClient);
  assert.equal(typeof rt.on, 'function');
  assert.equal(rt.isRunning, false);
  assert.throws(() => new Client().realtime());
});

test('realtime uses a stable device id and exposes a now-playing snapshot', async () => {
  const rt = new RealtimeClient({ token: 'x' });
  assert.match(rt.deviceIdValue, /^[0-9a-f]+$/);
  assert.equal(rt.deviceIdValue, rt.deviceIdValue); // stable
  assert.equal(rt.state, null);
  assert.equal(rt.nowPlaying as unknown, null);
  assert.equal(rt.liveProgressMs(), 0);
  assert.equal(rt.lastStateAgeMs, null);

  // an explicit device id is honoured verbatim
  assert.equal(new RealtimeClient({ token: 'x', deviceId: 'dev-123' }).deviceIdValue, 'dev-123');

  const state = parseStateFrame(
    JSON.stringify({
      player_state: {
        status: {
          paused: false,
          duration_ms: '200000',
          progress_ms: '1000',
          playback_speed: 1,
          version: { timestamp_ms: String(Date.now()) },
        },
        player_queue: {
          current_playable_index: 0,
          entity_id: '5:3',
          entity_type: 'PLAYLIST',
          playable_list: [{ playable_id: '777' }],
        },
      },
    }),
  );
  // feed a frame as the socket would, without a live connection
  await (rt as unknown as { handleState(s: typeof state): Promise<void> }).handleState(state);

  const np = rt.nowPlaying;
  if (np === null) {
    throw new Error('expected a now-playing snapshot');
  }
  assert.equal(np.playableId, '777');
  assert.equal(np.paused, false);
  assert.equal(np.entityType, 'PLAYLIST');
  assert.equal(np.durationMs, 200000);
  assert.ok(np.progressMs >= 1000);
  assert.equal(rt.state, state);
  assert.ok((rt.lastStateAgeMs ?? Number.MAX_SAFE_INTEGER) < 5000);
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
    'usersPlaylistsCreate',
    'usersPlaylistsDelete',
    'usersPlaylistsInsertTrack',
    'usersPlaylistsDeleteTrack',
    'playlistsPersonal',
    'playlist',
    'artistsBriefInfo',
    'artistsDirectAlbums',
    'artistsSimilar',
    'artistsTrackIds',
    'requestDeviceCode',
    'deviceAuth',
    'refreshAccessToken',
    'landing',
    'chart',
    'genres',
    'rotorStationsDashboard',
    'rotorStationTracks',
    'rotorStationFeedbackTrackStarted',
    'rotorStationSettings2',
    'queuesList',
    'queue',
    'queueUpdatePosition',
    'musicHistory',
    'clips',
    'clipsWillLike',
    'tracksCredits',
    'tracksDisclaimer',
    'label',
    'labelAlbums',
    'metatags',
    'metatag',
    'pins',
    'pinAlbum',
    'unpinAlbum',
    'usersPresaves',
    'usersPresavesAdd',
    'artistsConcerts',
    'concertInfo',
    'concertsFeed',
    'queueCreate',
    'musicHistoryItems',
    'realtime',
  ]) {
    assert.equal(typeof (client as unknown as Record<string, unknown>)[method], 'function', method);
  }
});

test('Track.deJson maps r128 and podcast-episode fields (drift regression)', () => {
  const track = Track.deJson({
    id: 1,
    title: 'Episode',
    r128: { i: -9.44, tp: 0.29 },
    podcastEpisodeType: 'regular',
    pubDate: '2024-01-02T00:00:00Z',
  });
  assert.ok(track);
  assert.equal(track.r128?.i, -9.44);
  assert.equal(track.r128?.tp, 0.29);
  assert.equal(track.podcastEpisodeType, 'regular');
  assert.equal(track.pubDate, '2024-01-02T00:00:00Z');
});

test('Album.deJson maps the structured cover and listeningFinished (drift regression)', () => {
  const album = Album.deJson({
    id: 9,
    title: 'A',
    cover: { type: 'pic', uri: 'avatars/%%' },
    listeningFinished: true,
    availableRegions: ['RU', 'BY'],
    hasTrailer: false,
  });
  assert.ok(album);
  assert.ok(album.cover instanceof Cover);
  assert.equal(album.cover?.uri, 'avatars/%%');
  assert.equal(album.listeningFinished, true);
  assert.deepEqual(album.availableRegions, ['RU', 'BY']);
});

test('Search.deJson reads the snake_case podcast_episodes key and clips (bug regression)', () => {
  const search = Search.deJson({
    text: 'q',
    podcast_episodes: { type: 'podcast_episode', total: 1, results: [{ id: 5, title: 'Ep' }] },
    clips: { type: 'clip', total: 1, results: [{ id: 'c1' }] },
  });
  assert.ok(search);
  assert.equal(search.podcastEpisodes?.total, 1);
  assert.ok(search.podcastEpisodes?.results?.[0] instanceof Track);
  assert.equal(search.podcastEpisodes?.results?.[0]?.title, 'Ep');
  assert.ok(search.clips?.results?.[0] instanceof Clip);
});

test('reportUnknown warns only when the client opts in', () => {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(' '));
  try {
    // Off by default: silent even with unmapped keys.
    reportUnknown(undefined, 'X', { a: 1, surprise: 2 }, { a: 1 });
    reportUnknown({ reportUnknownFields: false } as never, 'X', { surprise: 2 }, {});
    assert.equal(warnings.length, 0);
    // On: reports the unmapped key, but respects the alsoKnown allowlist.
    reportUnknown({ reportUnknownFields: true } as never, 'Track', { a: 1, surprise: 2 }, { a: 1 });
    reportUnknown({ reportUnknownFields: true } as never, 'Search', { podcast_episodes: 1 }, {}, ['podcast_episodes']);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /Track: API returned unmapped field\(s\): surprise/);
  } finally {
    console.warn = original;
  }
});
