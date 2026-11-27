# Changelog

All notable changes to `@dvxch/yandex-music` are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

- Новый логотип: три книги («библиотека») — верхняя ровно, средняя в перспективе и сильно наклонена, нижняя чуть кривая — вместо прежнего знака dvxch. Обновлены `assets/hero.svg`/`hero.png`, `favicon.svg`, `mark.svg`; добавлены одноцветные `mark-mono-dark.svg` и `mark-mono-light.svg`. Знак нарисован с нуля.

## 0.4.1 - 2026-11-27

Security and reliability overhaul driven by a code review, plus endpoints found in
the current web client. Every 0.4.0 export is still exported. Behaviour changes
are listed under "Changed"; read them before upgrading.

### Security

- `Authorization` and `X-Yandex-Music-Client` are sent only to the `baseUrl`
  origin, to `DEFAULT_API_ORIGIN` (`https://api.music.yandex.net`, always, so
  absolute API URLs such as the download-info XML keep the token behind a proxy
  `baseUrl`) and to the new `ClientOptions.authOrigins` /
  `RequestInit.authOrigins`. CDN mirrors, lyrics
  storage and any other URL passed to `retrieve`, `download`, `streamToFile` or
  `raceToFile` no longer receive the OAuth token. An explicit per-call header is
  still honoured.
- `YandexMusicModel.client`, `Request.client` and `ClientBase.token` are
  non-enumerable. `YandexMusicModel.toJSON()` returns the data fields, so
  `JSON.stringify(track)` works (it threw on the client cycle) and spread copies
  no longer carry the client. `Client` and `Request` have a redacting `toJSON()`
  and `util.inspect` output, so `console.log(client)` does not print the token.
- Path parameters are encoded with `pathSegment()` (`encodeURIComponent`, keeping
  `:`, `,` and `@`; dot segments encoded), so an id such as `1/../account` cannot
  change which authenticated endpoint is called.

### Added

- Cancellation and per-call options: `RequestOptions { signal, timeout,
  deadline, retries }` on `Request.send` and the verb helpers,
  `client.withOptions(options)` and `Request.withOptions(options)` (views that
  share token, transport, account state and configuration with the parent in
  both directions, so `view.init()` sets `me` / `accountUid` on the parent;
  models returned through a view keep using it). `deadline` is a hard cap on the
  whole call (every attempt including the body read, the backoff sleeps and the
  401 repeat) and rejects with `TimedOutError`. The backoff sleep is abortable.
  New `AbortedError` (never retried, distinct from `TimedOutError`). Download
  helpers take `{ signal, timeout }` (`DownloadInfo.download`, `downloadBytes`,
  `getDirectLink`; `LosslessDownloadInfo.download`, `downloadBytes`;
  `TrackLyrics.fetchLyrics`); `deviceAuth` takes `signal`.
- Token refresh: `ClientOptions.onUnauthorized(error) => token`. Called on HTTP
  401 (never on 403, nor for a request with its own per-call `Authorization`
  header), single flight across concurrent requests; the request is repeated
  once with the new token. `RealtimeOptions.token` accepts a provider
  function (`TokenSource`) evaluated on every reconnect, plus
  `RealtimeOptions.onUnauthorized`; `client.realtime()` wires both to the client.
- Errors: `YandexMusicError.retryable`, `isRetryableStatus()`, `ClientError`
  (4xx), `GoneError` (410), `ForbiddenError` (403, extends `UnauthorizedError`),
  `BadGatewayError` (502, extends `ServerError`), `InvalidResponseError`,
  `YnisonRebalancedError`.
- File info: `tracksFileInfoBatch(ids, options)` (`GET /get-file-info/batch`),
  `tracksFileInfoV2(id, options)` (`GET /resources/v2/file-info`) and
  `tracksFileInfoBatchV2(ids, options)`. Batch requests sign the comma-joined id
  list. `LosslessDownloadInfo.r128`. `FileInfoQuality` adds `lq`, `preview` and
  `smart_preview`.
- `tracksDownloadInfo(id, getDirectLinks, { antiAdParams })` and
  `DOWNLOAD_INFO_ANTI_AD_PARAMS`; see "Changed".
- Landing: `landingBlocksWaves`, `landingBlocksArtists`, `landingBlocksInStyle`,
  `landingBlocksNewPlaylists`, `landingBlocksNewReleases`,
  `landingBlocksPersonalPlaylists`, `landingSkeleton(id, { showWizard,
  locations })`, `landingBlockSource(source, params)` (generic skeleton block
  fetch, restricted to the `baseUrl` origin) and `landingBlockChart()`. Concerts:
  `concertsLandingPersonal()`. Models `LandingWaves`, `LandingWaveGroup`,
  `LandingWaveItem`, `LandingBlockItems`, `LandingBlockItem`,
  `LandingBlockItemData`, `LandingAlbumItem`, `LandingNewReleases`,
  `LandingInStyle`, `InStyleTab`, `LandingSkeleton`, `PersonalConcerts`. Shapes
  verified against the live API on 2026-11-27.
- `DownloadInfo.directLinkResolvedAt`, `DownloadInfo.directLinkExpired`,
  `DIRECT_LINK_TTL_MS` (50 s).
- `About.geoRegionIso`, `About.userSessionRegionIso`; `OAuthToken.expiresAt`.
- Transport: `ClientOptions.bodyTimeout` / `RequestInit.bodyTimeout`
  (`DEFAULT_BODY_TIMEOUT_MS` = 30000), `ClientOptions.clientHeader`,
  `DEFAULT_CLIENT_HEADER`, `Request.isAuthOrigin()`; `DEFAULT_DOWNLOAD_TIMEOUT_MS` and
  `DEFAULT_DOWNLOAD_IDLE_MS` are exported (pass the former to `retrieve()` for audio).
- Ynison: `YnisonClient.disconnect({ force })` (terminate instead of a close
  handshake), `YNISON_ANDROID_APP_VERSION`, `androidDeviceInfo(overrides)`,
  `resolveToken()`.
- Package: `exports` has a `default` condition and `./package.json`.

### Changed

- Retries follow `error.retryable`: transport failures, timeouts and HTTP
  408/425/429/5xx. Other 4xx (405, 410, 422, 451, …) are final and sent once
  (0.4.0 retried them as plain `NetworkError`). They raise `ClientError` (or
  `GoneError` for 410). `BadRequestError`, `NotFoundError`, `ConflictError` and
  `PayloadTooLargeError` now extend `ClientError` (still `NetworkError`).
- HTTP 403 raises `ForbiddenError`. It extends `UnauthorizedError`, so existing
  `instanceof UnauthorizedError` checks still match; refresh a token only on 401.
- HTTP 502 raises `BadGatewayError` (a `ServerError` and a `NetworkError`; the
  message is still `Bad Gateway`, `name` is now `BadGatewayError`).
  `instanceof ServerError` now matches 502, and 502 honours `Retry-After`.
- A 2xx body with an `error` key and no `result` raises `InvalidResponseError`
  (0.4.0 returned it as data). Malformed JSON also raises `InvalidResponseError`
  (a `YandexMusicError`, as before).
- Downloads are written to `<file>.<id>.part` and renamed on success. A failed
  download no longer deletes an existing file at the destination.
- `Request.retrieve()` defaults to the JSON timeout (was the 300 s download
  timeout). `DownloadInfo.downloadBytes` and `LosslessDownloadInfo.downloadBytes`
  still pass the download timeout. Callers that buffer audio through `retrieve()`
  must pass a timeout.
- `timeout` now bounds the time until response headers; the body is read within
  `max(timeout, bodyTimeout)` (default 30 s). Large JSON on slow links no longer
  fails at 5 s. `withOptions({ timeout: 2000 })` is therefore no hard cap (about
  32 s worst case); use `deadline` for one.
- `tracksDownloadInfo` sends `from=web-main&external-domain=music.yandex.ru&
  overloading=false` by default (avoids an advertisement returned instead of the
  track, MarshalX/yandex-music-api#675). Pass `{ antiAdParams: false }` for the
  old request.
- `DownloadInfo.download` and `downloadBytes` reuse a cached `directLink` for at
  most 50 s and resolve it again once after a 403/410.
- `getDirectLink()` validates the download-info XML (attributes on tags are
  accepted) and throws `InvalidResponseError` with a snippet instead of building
  `https:///get-mp3/...`.
- Every error the library throws is a `YandexMusicError`: a track without an id
  raises `IdMissingError`, missing URLs raise `InvalidResponseError`, a model
  without a client raises `YandexMusicError` (all were plain `Error`).
  File-system and crypto failures raise `YandexMusicError` with
  `retryable: false` (were `NetworkError`) and stop the mirror loop and the race
  fallback. `EACCES` / `EPERM` are final even when a custom fetch throws them;
  `EMFILE` / `ENFILE` (descriptor exhaustion) are transient and stay a
  retryable `NetworkError`.
- `DeviceAuthError` keeps `code` (for example `invalid_grant`), `status` and
  `cause`; a 401 from the OAuth host (`invalid_client`) raises `DeviceAuthError`.
- Default `X-Yandex-Music-Client` is `YandexMusicAndroid/26111171` (Android
  2026.11.1, was `YandexMusicAndroid/24023621`); `ANDROID_DEVICE_INFO.appVersion`
  is `2026.11.1` (was `2026.05.3`).
- `retries` below 0, `NaN` and `Infinity` count as 0 (a negative value used to
  throw `undefined`); fractional values are floored.
- `client.language` is an accessor: assigning it updates `Accept-Language`.
- `Request.setClient()` with a token-less client clears an `Authorization` left
  by a previous client of a reused transport; a header the caller set on a fresh
  `Request` is kept (as in 0.4.0).
- `LosslessDownloadInfo.download` and `downloadBytes` share one `timeout`
  deadline across all mirrors (and retries), as `race: true` already did; each
  mirror used to get the full timeout.
- `DownloadInfo.deListAsync(…, true)` resolves direct links in parallel.

### Fixed

- `RealtimeClient`: a throwing `state`, `trackChange`, `playStateChange`, `open`
  or `reconnect` listener no longer becomes an unhandled rejection (which crashes
  Node); the error goes to `error`. `stop()` followed by `start()` no longer
  leaves the old loop reconnecting next to the new one (two sessions with one
  device id displaced each other).
- `YnisonClient` dispatches a frame over a snapshot of its listeners, so
  `waitFirstState()` unsubscribing no longer makes the next listener miss the
  first frame. `waitFirstState()` resolves at once when a frame already arrived.
- The stale watchdog terminates the socket instead of waiting up to 30 s for a
  close handshake on a dead pipe.
- Ynison codes `300100001` / `300100002` (session moved to another host)
  reconnect through the redirector at once; a repeated one uses the normal
  backoff.
- After `client.token` changes, `client.realtime()` reconnects with the new token
  instead of stopping with a terminal `YnisonUnauthorizedError`.
- Ynison command version ids use all 18 digits (`Math.random() * 1e18` left the
  low digits zero).
- `RealtimeClient`: a token provider that throws is handled like a connect
  failure (`error`, then backoff, or `close` with `reconnect: false`) instead of
  rejecting `start()` and leaving the client stuck as running. After an
  `onUnauthorized` refresh the next connect uses the refreshed token even when
  the provider still returns the old one. A loop superseded by `stop(); start()`
  no longer emits `close` next to the running one.
- An `onUnauthorized` hook that throws synchronously no longer disables token
  refresh for the rest of the client's life.
- `landingBlockSource()` resolves a relative uri such as `landing/block/chart`
  against `baseUrl` (it was passed to `fetch` as is and failed as "Invalid URL").

## 0.4.0

Parity pass with MarshalX/yandex-music-api 3.2.2. The change is additive: every
0.3.0 export is still exported (guarded by `test/public-api.test.ts`). Items that
changed behaviour are listed under "Changed".

### Added

- Transport: `Request.send(method, url, { params, json, form, headers, retry, timeout })`
  (a `null` header value removes the header), `Request.clearAuthorization()`,
  `ClientOptions.timeout`, `ClientBase.resolveUid()` (throws `IdMissingError`).
  Assigning `client.token` now keeps the `Authorization` header in sync (set and clear).
- Errors: `YandexMusicError` has `status`, `code` and `retryAfterMs`. New
  `TooManyRequestsError` (HTTP 429) and `ServerError` (5xx except 502). 429 and 503
  honour `Retry-After`; a delay above `retryMaxMs` throws immediately. Non-JSON
  error bodies produce `HTTP <status>: <first 200 chars>`. The OAuth `error`
  field is exposed as `error.code`.
- Retries: batch reads sent as POST (`getList`) are retried like GETs.
- Unknown-field reporting: `assign()` records the keys it maps, declared-but-unmapped
  fields are reported, and the `onUnknownField` report carries `shapes` (type-only
  description of each value, via `describeShape`).
- Lossless: `tracksFileInfo(trackId, { quality, codecs, transport, signKey, clientHeader })`
  (default transport `raw`), `FileInfo`, `FileDownloadInfo` (alias of
  `LosslessDownloadInfo`), `Track.getFileInfo`, `LosslessDownloadInfo.isEncrypted`,
  and the constants `DESKTOP_SIGN_KEY`, `DESKTOP_CLIENT`, `FILE_INFO_CODECS_LIST`.
- Rotor: `rotorStationStream`, `rotorStationStreamFeedback`, `rotorSessionFeedback`
  (+ `rotorSessionFeedbackRadioStarted` / `TrackStarted` / `TrackFinished` / `Skip`),
  `rotorSessionFeedbacks`, `rotorCombinedSessionLanding`, `rotorWaveSettings(seeds)`,
  `rotorSessionNew(seeds, options)`, `rotorSessionClone(id, options)`,
  `rotorSessionTracks(id, { queue, feedbacks })`, options for
  `rotorCombinedSessionNew` / `rotorCombinedSessionNext`, and
  `rotorSessionsFeedbacks(sessions[])`. Types: `FeedbackTimestamp`,
  `RotorSessionOptions`, `SessionEventInput`, `SessionFeedbackInput`,
  `SessionFeedbacksInput`, `CombinedSessionQueueInput`.
- Likes: `usersLikesArtistsWithTimestamps()` (returns `Like[]`),
  `ifModifiedSinceRevision` on `usersLikesTracks` / `usersDislikesTracks`, the `rich`
  parameter on `usersLikesAlbums`, `Like.deListTyped`.
- Device auth: `pollDeviceTokenOnce` and `PollOutcome`.
- Ynison: typed errors `YnisonServerError`, `YnisonUnauthorizedError`,
  `YnisonDeviceDisplacedError`, `YnisonTimeoutError`, `YnisonConnectionClosedError`,
  `YnisonNoActiveDeviceError`, `YnisonQueueBoundaryError`; `parseServerError`,
  `deviceIdFromToken`; options `redirectUrl`, `stateUrl`, `connectTimeoutMs` and
  `RealtimeOptions.ynison`; commands `pause`, `resume`, `nextTrack`, `previousTrack`,
  `setVolume(volume, targetDeviceId?)`, `sendRaw` on `YnisonClient` and
  `RealtimeClient`; `YnisonClient.onError` and `latestState`; request builders
  `buildSetPausedRequest`, `buildChangeTrackRequest`, `buildSetVolumeRequest`;
  helpers `getPlaybackOrder`, `getNeighbourIndex`, `getCurrentProgressMs`,
  `getActiveDevice`. `YnisonState` gains `devices`, `activeDeviceId`,
  `shuffleIndices` and `raw`.
- Models: `Images`, `Tag`, `InvocationInfo`, `Wave`, `WaveAgent`, `SimilarEntityData`,
  `SimilarEntityItem`, `SkeletonBlock`, `SkeletonBlockData`, `SkeletonTab`,
  `SkeletonSource`, `SkeletonViewAllAction`, `AlbumTrailerStatus`,
  `ArtistTrailerStatus`, `ArtistDonationInfo`, `UpcomingAlbum`, `Alert`, `AlertButton`,
  `StationData`, `ExperimentDetail`, `MadeForUser`, `SearchBanner`,
  `PersonalPlaylistsData`, `PlayContextsData`, `ChartInfoMenu`,
  `MusicHistoryContextFullModel`, `FeedHeadline`, `RotorSeed`, `RotorSessionTracks`,
  `WaveSettingsBlock`, `SessionEvent`, `SessionPlayable`, `SessionFeedback`,
  `CombinedSessionQueueItem`, `CombinedSessionItem`, `CombinedSessionLanding`,
  `RotorSettings`, `GenerativeStream`, `GenerativeStreamFeedback`.
- Model fields: `Album` (`durationSec`, `originalReleaseYear`, `buy`, `prerolls`,
  `availableAsRbt`, `rememberPosition`, `albums`), `AlbumActionButton.viewBrowser`,
  `Artist` (`actionButton`, `fullNames`, `aliases`), `BriefInfo` (`actionButton`,
  `backgroundImageUrl`, `backgroundVideoId`, `backgroundVideoUrl`, `upcomingAlbum`),
  `ArtistEvent.subscribed`, `Playlist` (`madeForUser`, `childContent`,
  `dummyDescription`, `dummyPageDescription`, `dummyCover`, `dummyRolloverCover`,
  `prerolls`, `isForFrom`), `Track` (`mixFade`, `clipIds`, `isrc`, `ugcArtistName`,
  `userInfo`), `R128.importantSecs`, `Station` (`specialContext`, `listeners`,
  `login`, `fullName`, `displayName`, `visibility`), `TrackParameters`
  (`userCollectionHue`, `mixFade`), `Search.banner`, `ExperimentsDetails.experiments`,
  `RotorSession` (`radioSessionId`, `batchId`, `pumpkin`, `sequence`,
  `offlineRecommenderData`, `interactive`, `acceptedRotorSeeds`,
  `descriptionRotorSeed`; seeds are accepted as strings or objects),
  `ClonedSession` (`terminated`, `wave`, `offlineRecommenderData`, `interactive`,
  accepted and description seeds).
- Tooling: `npm run lint`, a portable `clean` script, a CI lint step, the public API
  guard test, and `src/index.ts` split into `src/exports/*`.
- Examples `13-wave-session.ts`, `14-ynison-remote.ts`, `15-file-info.ts`; live
  tests for the new read-only endpoints (gated on `YM_TOKEN`).

### Changed

- `rotorSessionNew` is now `POST` with a JSON body (was `GET`). The old
  `rotorSessionNew(boolean)` form still works (deprecated; it sends
  `seeds: ['user:onyourwave']`). `rotorSessionClone`, `rotorSessionTracks`,
  `rotorCombinedSessionNew` and `rotorCombinedSessionNext` now send JSON bodies;
  `rotorSessionTracks` returns `RotorSessionTracks`.
- Station feedback sends a JSON body (was a form). The timestamp is an ISO string
  by default (was epoch seconds). A numeric `timestamp` keeps working in both units:
  a finite number below `1e11` is read as Unix seconds (the 0.3.0 meaning) and any
  larger number as milliseconds; both are sent as ISO strings, as are `Date` values
  (`FeedbackTimestamp` now also accepts `Date`). A falsy `trackId` and a zero `totalPlayedSeconds`
  are omitted, and `batch-id` and `streamId` go in the query.
  `rotorStationSettings2` sends JSON. `rotorWaveLastReset` is true only for `'ok'`
  or `{ result: 'ok' }`.
- Playlist edits (`usersPlaylistsChange`, `usersPlaylistsInsertTrack`,
  `usersPlaylistsDeleteTrack`): `revision` is optional. When omitted, the current
  revision is fetched first (fallback 1). Verified live: a stale explicit revision
  is rejected with HTTP 412, an automatic one is accepted. The old default of 1
  was a latent bug.
- Methods that need a user id throw `IdMissingError` before any request when there
  is no uid and `init()` was not called.
- `search()` throws `BadRequestError` when the server returns a bare string.
- `usersLikesAlbums` sends `rich=true` by default. `usersLikesClipsAdd` puts
  `clip-id` in the query and sends no body. `usersLikesArtists` also accepts
  `{ artist }`-wrapped items. `Like.id` is always a string at runtime.
- `playAudio` without a uid omits the `uid` key (was `uid=''`). `playsBulk` passes
  `client-now` through query params. `locations` of `playerInformers` and
  `concertsLandingArtists` are URL-encoded. `labelAlbums` omits undefined sort
  params. `artistsSkeleton` has an optional skeleton id, default `web-artist-default`.
- get-file-info is signed with the desktop key and the header
  `YandexMusicDesktopAppWindows/5.95.0` (verified live: lossless `flac-mp4` over
  `raw`, `hq` `aac-mp4`, and `encraw` with a key). The track id is used as given and
  the codec order follows the reference. `getFileInfoSign` defaults to the desktop
  key. `tracksLosslessInfo(id, quality, options)` keeps the `encraw` transport.
- Device auth: pending and `slow_down` are detected by `error.code`; `slow_down` adds
  5 s to the poll interval (RFC 8628); the deadline error message is
  `device authorization expired`; an unparseable token response throws
  `DeviceAuthError` (it was treated as pending). OAuth endpoints no longer receive
  the music `Authorization` and `X-Yandex-Music-Client` headers. Queue methods treat
  an empty `device` as the default.
- HTTP 429 raises `TooManyRequestsError`, 5xx (not 502) raises `ServerError`; both
  extend `NetworkError`. 502 stays `NetworkError('Bad Gateway')` with `status` 502.
- Ynison: the reconnect delay follows the schedule `[0, 1000, 5000, 30000]` plus
  jitter (a server `ynison-backoff-millis` replaces it). `reconnectBaseMs` is now a
  minimum delay and is unset by default (was 1000), so the first retry is immediate.
  Terminal errors (unauthorized, device displaced) stop reconnecting; a server
  go-away is not terminal: the client reconnects after `min(retryAfterMs,
  goAwayMaxMs)`. When a terminal error ends the loop, `RealtimeClient.terminalError`
  holds it (also the first argument of `close`), so `start()` no longer resolves
  silently for callers without an `error` listener. The reconnect attempt counter
  and server backoff ladder reset only after a session stayed open for
  `stableSessionMs` (default 5000); after a shorter session the next reconnect waits
  at least 1000 ms. Invalid Ynison state frames now surface as `error` events on
  `RealtimeClient`; to ignore them, do not subscribe to `error` (without a listener
  nothing is thrown).
  The state socket has a connect timeout, keep-alive comes from the server redirect
  frame, and `stop()` clears the reconnect timer. Verified live: connect and first
  state in about 0.4 s.
- Unknown-field reporting now also flags declared-but-unmapped fields; code that
  counts reports may see more of them.
- `Track.trackId()` JSDoc corrected.
- Transport: response headers are read defensively (custom fetch shims may expose a
  plain object, or no `get`, or no headers); `Retry-After` is still honoured when found.
  Error messages no longer read `HTTP 500:  (500)` or `HTTP 500 (500)`. Header removal
  with a `null` value is case-insensitive, so OAuth requests drop lowercase
  `authorization` / `x-yandex-music-client` too.
- `LosslessDownloadInfo.isEncrypted` and downloads decrypt whenever a `key` is present
  and the transport is not explicitly `raw` (a missing transport counts as encrypted).

### Typed previously-raw fields

Same keys, but the values are now typed model instances that keep only the keys the
model maps (unmapped keys are dropped), so code that read extra raw keys from them
may see `undefined`. Code that assigns these to `JSONValue` variables may also stop
compiling. Notable cases:

- `Album.trailer` keeps only `available`.
- `Block.data` for `personal-playlists` and `play-contexts` is mapped.
- `Playlist.tags` and `Feed.headlines` drop items that are not objects.
- `MusicHistoryItemData.fullModel` is now a `Track` or `MusicHistoryContextFullModel`
  instance.
- `RotorSession.acceptedSeeds` is always normalised to strings (typed seeds are in
  `acceptedRotorSeeds`).
- The reference library types `Feed.headlines` as strings, but the live API returns
  objects `{ type, id, message }`.

- `Album.trailer` -> `AlbumTrailerStatus`; `Artist.trailer` and `ArtistInfo.trailer`
  -> `ArtistTrailerStatus`; `Artist.donationInfo` -> `ArtistDonationInfo`.
- `ArtistSkeleton.blocks` and `ConcertSkeleton.blocks` -> `SkeletonBlock[]`.
- `AlbumSimilarEntities.items` and `PlaylistSimilarEntities.items` -> `SimilarEntityItem[]`.
- `Status.stationData` -> `StationData`; `Status.barBelow` -> `Alert`.
- `Playlist.tags` -> `Tag[]`; `Playlist.actionButton` -> `AlbumActionButton`.
- `TrackShort.chart` -> `Chart`; `ChartInfo.menu` -> `ChartInfoMenu`.
- `Block.data` -> `PersonalPlaylistsData | PlayContextsData | JSONValue`;
  `LandingList.newPlaylists` -> `PlaylistId[]`.
- `MusicHistoryItemData.fullModel` -> `Track | MusicHistoryContextFullModel`
  (`MusicHistoryItemData.deJson` gained an optional third parameter `itemType`).
- `Genre.images` -> `Images`; `TagResult.tag` -> `Tag`.
- `CombinedSession.list` -> `CombinedSessionItem[]`; `WaveSettings.blocks` ->
  `WaveSettingsBlock[]`; `StationResult.prerolls` -> `string[]`.
- `Feed.headlines` -> `FeedHeadline[]` (`{ type, id, message }`; verified live that
  they are objects, the reference library says strings); `Feed.nextRevision` ->
  `string`; `Event.message` and `Event.device` -> `string`.

### Fixed

- Unknown-field reporting missed API keys that matched a declared but never mapped
  class field.
- The `clean` script was not portable to Windows.
- Leftover "yamuse" references, unused code and mixin-chain indentation in `src/client.ts`.

### Deprecated

- `proxyUrl` (it was never applied; pass a proxy-aware `fetch` instead).
- `rotorSessionNew(boolean)`: pass seeds, `rotorSessionNew('user:onyourwave', options)`.
- `rotorSessionsFeedbacks(params)`: pass an array of `SessionFeedbacksInput`.

### Unverified

Implemented from the reference library and not checked against a real account or
player. Do not rely on these without testing:

- Ynison commands (pause, resume, next, previous, volume) on a real player; the
  device-displaced error code `400090001`.
- 429 `Retry-After` format; the OAuth `slow_down` and `authorization_pending` HTTP
  shapes and header-less OAuth requests.
- `rotorStationStream`, `rotorStationStreamFeedback`, `rotorSessionFeedback(s)`,
  `rotorSessionsFeedbacks` and `rotorCombinedSessionLanding` request bodies.
- `usersLikesClipsAdd` with `clip-id` in the query.
- `presaves` `includeReleased` default is still `true` (the reference uses `false`);
  deliberately not changed.
- Payload shapes of `ArtistEvent.subscribed`, `Block.data`, `SearchBanner`,
  `ChartInfoMenu`, `MusicHistoryContextFullModel`, and `buy`, `prerolls`, `fullNames`,
  `aliases`, `upcomingAlbum`.
- All TS-only methods with no counterpart in the reference library (`nonMusic*`,
  `childrenLanding*`, `lumen`, `recapSlides*`, `collectionSync`, and similar).

Known type mismatch: `Artist.id` is typed `number`, but the live API returns a
string for artist ids in `usersLikesArtists`. It is left as is, because widening
the type would break callers.
