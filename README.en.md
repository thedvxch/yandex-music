<p align="center">
  <img src="assets/hero.png" alt="@dvxch/yandex-music — typed TypeScript client for the Yandex Music API" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dvxch/yandex-music"><img src="https://img.shields.io/npm/v/@dvxch/yandex-music?color=8b5cf6&logo=npm" alt="npm"></a>
  <a href="https://github.com/thedvxch/yandex-music/actions/workflows/ci.yml"><img src="https://github.com/thedvxch/yandex-music/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@dvxch/yandex-music"><img src="https://img.shields.io/npm/types/@dvxch/yandex-music?logo=typescript&logoColor=white&color=8b5cf6" alt="types"></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/runtime%20deps-0-44cc11" alt="zero deps"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@dvxch/yandex-music?logo=node.js&logoColor=white&color=44cc11" alt="node"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@dvxch/yandex-music?color=a78bfa" alt="license"></a>
</p>

<p align="center">
  <a href="https://gh.dvxch.link/yandex-music/"><b>📖 Documentation</b></a> ·
  <a href="./README.md">🇷🇺 На русском</a> ·
  <a href="https://www.npmjs.com/package/@dvxch/yandex-music">npm</a>
</p>

A typed, async **TypeScript client for the Yandex Music API**.

`@dvxch/yandex-music` is an independent TypeScript implementation of the Yandex
Music HTTP API. It targets modern Node.js (≥ 20), ships ESM with full type
declarations, and has **zero runtime dependencies** (it uses the built-in
`fetch`).

> Status: complete. The full HTTP API — `account` / `tracks` / `albums` /
> `artists` / `search` / `likes` / `playlists` / `device auth` / `landing` /
> `radio` / `queue` / `history` / `clips` / `credits` / `disclaimers` / `labels`
> / `metatags` / `pins` / `presaves` / `concerts` — is implemented and tested,
> including playlist mutations, dislikes and rotor feedback, plus a realtime
> ("now playing") API over Ynison.

Every endpoint has been exercised against the live Yandex Music API with a real
token; the few endpoints the server no longer fulfils for a regular account
(e.g. legacy queue creation, rotor feedback) surface a typed error rather than
failing silently.

### Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Design](#design)
- [Configuration](#configuration)
- [Error handling](#error-handling)
- [Implemented endpoints](#implemented-endpoints)
- [Realtime](#realtime)
- [Examples](#examples)
- [Documentation](#documentation)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Features

- **Zero runtime dependencies.** Built on the platform `fetch`; ESM-only, Node ≥ 20.
- **Fully typed.** Every endpoint and model has hand-written types and a static `deJson` — no `any` on the public surface.
- **Complete API coverage.** ~145 methods across every domain, kept at parity with the upstream API.
- **Robust transport.** Automatic retries with exponential backoff + jitter on transient failures (idempotent requests only); typed errors; per-call timeouts.
- **Streaming downloads.** `download()` streams straight to disk (constant memory), transparently AES-CTR-decrypting lossless (`encraw`/FLAC) on the fly, with optional **CDN-mirror racing** and an idle-stall watchdog.
- **Realtime "now playing"** over Ynison — a reconnecting `EventEmitter` plus a synchronous `nowPlaying` snapshot.
- **Drift detection.** Opt-in `onUnknownField` hook reports any API field the models don't yet map — so upstream changes are caught, not swallowed.
- **Pluggable `fetch`.** Inject a custom transport (proxy, TLS impersonation, tuned connection pool).

## Install

```bash
npm install @dvxch/yandex-music
```

Requires Node.js ≥ 20. Realtime ("now playing") additionally needs the optional
`ws` package:

```bash
npm install ws
```

## Quick start

```ts
import { Client } from '@dvxch/yandex-music';

// Construct with an OAuth token, then init() once to load account info.
const client = await new Client({ token: process.env.YM_TOKEN }).init();

// Fetch a track by id.
const [track] = await client.tracks(2);
console.log(track?.title, '—', track?.artists?.[0]?.name);

// Resolve a direct link and download it.
const [info] = await track!.getDownloadInfo();
await info.download('track.mp3');

// Lyrics (TEXT or LRC).
const lyrics = await client.tracksLyrics(2, 'LRC');
console.log(await lyrics?.fetchLyrics());
```

`new Client({ token })` is cheap. `await client.init()` loads account info once,
so methods that default to the current user (`usersLikes*`, `usersPlaylists*`,
`pins`, `presaves`) work without an explicit `userId`. Read-only catalog calls
(`tracks`, `albums`, `search`, …) work without `init()` too.

## Design

- **Flat client surface.** Methods live directly on the client
  (`client.tracks(...)`, `client.tracksDownloadInfo(...)`), mirroring the upstream
  API. Internally the client is assembled from per-domain *mixins* so each area
  lives in its own file.
- **camelCase models.** The API already returns camelCase keys, so models keep
  them verbatim — no snake_case normalization layer. Every model exposes a static
  `deJson(raw, client)` that builds a typed instance and recurses into nested
  models; `deList(Model.deJson, raw, client)` handles arrays.
- **Models carry the client.** Convenience methods such as
  `Track.getDownloadInfo()` or `DownloadInfo.download()` reuse the owning client,
  so you rarely thread it through manually.
- **Typed errors.** Every failure derives from `YandexMusicError`; network
  failures additionally derive from `NetworkError` (`BadRequestError`,
  `NotFoundError`, `TimedOutError`, `UnauthorizedError`).
- **Never `JSON.stringify` a model** — it carries a back-reference to the client
  (a cyclic structure). Read fields directly instead.

## Configuration

Everything that identifies the client to the API is set through the constructor:

```ts
const client = new Client({
  token: process.env.YM_TOKEN,
  userAgent: 'my-app/1.0',                         // default: the library UA
  headers: { 'X-Yandex-Music-Client': 'custom' },  // merged onto the defaults
  device: 'os=Linux; model=my-app; ...',           // device descriptor for queues
  language: 'en',                                   // response language
  fetch: myFetch,                                   // custom transport (e.g. node-wreq)
  retries: 2,                                       // retries for transient GET failures (0 = off)
  onUnknownField: ({ model, fields }) =>            // drift hook: API fields not yet modelled
    console.warn(`${model}: unmapped ${fields.join(', ')}`),
});
```

`userAgent` and `headers` apply only to the auto-built transport — pass them on
your own `request` instead when you supply one. The realtime device identity is
set separately via `client.realtime({ deviceInfo })`.

### All `ClientOptions`

| Option | Purpose |
| ----- | ---------- |
| `token` | OAuth token |
| `baseUrl` | override the API origin |
| `language` | response language: `en`/`uz`/`uk`/`us`/`ru`/`kk`/`hy` (default `ru`) |
| `userAgent` | override the User-Agent |
| `headers` | extra headers, merged onto the defaults |
| `device` | device descriptor for queue requests |
| `fetch` | custom `fetch` (proxy, mocks, retries) |
| `retries` | retries for transient GET failures (default 2, 0 = off) |
| `retryBaseMs` / `retryMaxMs` | initial and maximum retry backoff in ms (default 300 / 4000) |
| `timeout` | default per-request timeout in ms (default 5000; ignored when `request` is supplied) |
| `reportUnknownFields` | surface API fields the models don't yet map |
| `onUnknownField` | hook to use instead of `console.warn` for the same drift |
| `request` | a fully pre-configured transport (overrides `userAgent`/`headers`/`fetch`) |

## Error handling

Every library error derives from `YandexMusicError` — a single `catch` is
enough to intercept all of them. Network and transport failures additionally
derive from `NetworkError`:

```ts
import {
  YandexMusicError,
  UnauthorizedError,
  NotFoundError,
  TimedOutError,
} from '@dvxch/yandex-music';

try {
  await client.tracksLyrics(trackId);
} catch (error) {
  if (error instanceof UnauthorizedError) {
    // token missing or expired — re-authenticate
  } else if (error instanceof NotFoundError) {
    // this track has no lyrics
  } else if (error instanceof TimedOutError) {
    // the request stalled — safe to retry
  } else if (error instanceof YandexMusicError) {
    // any other library error
  } else {
    throw error; // not ours
  }
}
```

`GET` requests automatically retry on transient failures (exponential backoff +
jitter, `retries` attempts on top, 2 by default). Mutating requests
(`POST`/`PUT`/`DELETE`) are never retried automatically — this guards against
duplicate side effects (e.g. a double like). The exception is batch reads sent as
`POST` (`tracks`, `albums`, `artists`, `playlists`): they are idempotent and are
retried like `GET`.

### Errors and retries

`YandexMusicError` carries `status` (the HTTP code), `code` (a machine-readable
code from the body, for example the OAuth `error` field) and `retryAfterMs`:

- `429` raises `TooManyRequestsError` and `5xx` (except `502`) raises
  `ServerError`; both extend `NetworkError`. `502` stays
  `NetworkError('Bad Gateway')` with `status` 502.
- `429` and `503` honour the `Retry-After` header: the pause comes from it, and a
  delay above `retryMaxMs` throws immediately instead of waiting.
- A non-JSON error body produces a message of the form `HTTP <status>: <first 200 chars>`.
- Methods that need a user id throw `IdMissingError` before any request when
  `init()` was not called and no `userId` was passed.

```ts
import { TooManyRequestsError } from '@dvxch/yandex-music';

try {
  await client.feed();
} catch (error) {
  if (error instanceof TooManyRequestsError) {
    console.log(error.status, error.retryAfterMs); // 429, the server hint in ms or undefined
  }
}
```

### Token and timeout

`client.token` is a setter: assigning a new value updates the `Authorization`
header at once, and assigning `undefined` removes it. The default timeout is set
with the `timeout` option; a single request can override it through
`client.request.send(method, url, { timeout })`. There is no built-in proxy
support: pass a proxy-aware `fetch`. The Android `proxyUrl` option is deprecated
(it was never applied).

### API drift: `reportUnknown`

The `onUnknownField` hook receives `{ model, fields, raw, shapes }`. `fields` are
the response keys the model did not map (declared fields that are never assigned
count too). `shapes` describes only the *type* of each key's value, for example
`list[{id: int, title: str}]` (depth up to 3, strings up to 500 chars); the data
itself is not included.

## Implemented endpoints

| Domain      | Methods |
| ----------- | ------- |
| account     | `init`, `accountStatus`, `accountSettings`, `accountSettingsSet`, `settings`, `permissionAlerts`, `accountExperiments`, `accountExperimentsDetails`, `consumePromoCode` |
| tracks      | `tracks`, `tracksDownloadInfo`, `tracksLosslessInfo`, `tracksFileInfo`, `tracksLyrics`, `tracksSimilar`, `tracksFullInfo`, `tracksTrailer`, `trackSupplement`, `playAudio`, `afterTrack` |
| albums      | `albums`, `albumsWithTracks`, `albumsSimilarEntities`, `albumsTrailer` |
| artists     | `artists`, `artistsBriefInfo`, `artistsInfo`, `artistsAbout`, `artistsClips`, `artistsDonation`, `artistsSkeleton`, `artistsTracks`, `artistsTrackIds`, `artistsDirectAlbums`, `artistsAlsoAlbums`, `artistsDiscographyAlbums`, `artistsSafeDirectAlbums`, `artistsSimilar`, `artistsLinks`, `artistsTrailer` |
| search      | `search`, `searchSuggest` |
| likes       | `usersLikesTracks`/`Albums`/`Artists`/`Playlists`/`Clips` + add/remove for each, `usersLikesArtistsWithTimestamps`; `usersDislikesTracks`/`Artists` + add/remove |
| playlists   | `playlist`, `playlists`, `playlistsList`, `playlistsPersonal`, `usersPlaylists`, `usersPlaylistsList`, `usersPlaylistsKinds`, `usersPlaylistsCreate`, `usersPlaylistsDelete`, `usersPlaylistsName`, `usersPlaylistsVisibility`, `usersPlaylistsDescription`, `usersPlaylistsChange`, `usersPlaylistsInsertTrack`, `usersPlaylistsDeleteTrack`, `usersPlaylistsRecommendations`, `usersPlaylistsTrailer`, `usersSettings`, `playlistSimilarEntities`, `playlistsCollectiveJoin` |
| device auth | `requestDeviceCode`, `pollDeviceToken`, `deviceAuth` (blocking flow), `refreshAccessToken` (renew via refresh token) |
| landing     | `landing`, `feed`, `feedWizardIsPassed`, `tags`, `chart`, `newReleases`, `newPlaylists`, `podcasts`, `genres` |
| radio       | `rotorStationsDashboard`, `rotorStationsList`, `rotorStationInfo`, `rotorStationTracks`, `rotorAccountStatus`, `rotorStationFeedback` (+`rotorStationFeedbackRadioStarted`/`TrackStarted`/`TrackFinished`/`Skip` shortcuts), `rotorStationSettings2`, `rotorStationStream`, `rotorStationStreamFeedback`, `rotorWaveSettings`, `rotorWaveLast`, `rotorWaveLastReset`, `rotorSessionNew`, `rotorSessionClone`, `rotorSessionTracks`, `rotorSessionFeedback` (+`rotorSessionFeedbackRadioStarted`/`TrackStarted`/`TrackFinished`/`Skip` shortcuts), `rotorSessionFeedbacks`, `rotorSessionsFeedbacks`, `rotorCombinedSessionNew`, `rotorCombinedSessionNext`, `rotorCombinedSessionLanding` |
| queue       | `queuesList`, `queue`, `queueUpdatePosition`, `queueCreate` |
| history     | `musicHistory`, `musicHistoryItems` |
| clips       | `clips`, `clipsWillLike` |
| credits     | `tracksCredits`, `clipsCredits` |
| disclaimers | `tracksDisclaimer`, `clipsDisclaimer`, `albumsDisclaimer`, `artistsDisclaimer` |
| labels      | `label`, `labelAlbums`, `labelArtists` |
| metatags    | `metatags`, `metatag`, `metatagAlbums`, `metatagArtists`, `metatagPlaylists` |
| pins        | `pins`, `pin{Album,Artist,Playlist,Wave}`, `unpin{Album,Artist,Playlist,Wave}` |
| presaves    | `usersPresaves`, `usersPresavesAdd`, `usersPresavesRemove` |
| concerts    | `artistsConcerts`, `concertInfo`, `concertSkeleton`, `concertsFeed`, `concertsLocations`, `concertsTabConfig` |
| realtime    | `client.realtime()` → `RealtimeClient` (Ynison; needs `ws`): events, `nowPlaying`, commands `pause`/`resume`/`nextTrack`/`previousTrack`/`setVolume` |

### Downloads and quality

For lossy variants, use `tracksDownloadInfo` / `track.getDownloadInfo()` and
pick by bitrate:

```ts
const variants = await track!.getDownloadInfo();          // DownloadInfo[]
const best = [...variants].sort((a, b) => (b.bitrateInKbps ?? 0) - (a.bitrateInKbps ?? 0))[0];
await best!.download('track.mp3');
```

Lossless (FLAC) goes through a separate path, the signed `get-file-info` endpoint:

- `tracksFileInfo(trackId, { quality, codecs, transport, signKey, clientHeader })` /
  `track.getFileInfo(options)` returns a `FileInfo` whose `downloadInfo` is a
  `LosslessDownloadInfo`. `quality` is `lossless` (default), `hq` or `nq`; the
  default transport is `raw` (a plain stream).
- `tracksLosslessInfo(trackId, quality, options)` /
  `track.getLosslessInfo(quality)` returns the `LosslessDownloadInfo` directly and
  keeps the `encraw` transport; `download()` decrypts the AES-CTR stream on the fly.
- Requests are signed with the desktop key and the
  `YandexMusicDesktopAppWindows/5.95.0` client header (override with `signKey` and
  `clientHeader`; they must match). The track id is sent as given.
- When a track has no lossless source the server answers with a lossy codec:
  check `info.isLossless` and `info.codec`.

```ts
const file = await client.tracksFileInfo(trackId, { quality: 'lossless' });
const info = file?.downloadInfo;
if (info) {
  console.log(info.codec, info.isLossless, info.isEncrypted);
  await info.download('track.flac');
}
```

## Realtime

Yandex Music has no HTTP webhooks; the only server-push channel is **Ynison**
(the WebSocket protocol that syncs playback across devices). `client.realtime()`
wraps it in a typed `EventEmitter` that handles the handshake, keep-alive and
reconnection for you. It needs the optional `ws` package (`npm install ws`); the
rest of the library has no runtime dependencies.

```ts
const rt = client.realtime();
rt.on('trackChange', ({ track }) => console.log('now playing:', track?.title));
rt.on('playStateChange', (paused) => console.log(paused ? 'paused' : 'playing'));
await rt.start();   // resolves when you call rt.stop()
```

For a production watcher it's easier to read a **synchronous snapshot** than to wait
for the next event — e.g. to answer an HTTP request right now:

```ts
const rt = client.realtime({
  staleTimeoutMs: 120_000,   // force a reconnect if frames go quiet (silent broken pipe)
});
rt.start();                  // don't await — it runs until rt.stop()

const np = rt.nowPlaying;    // null before the first frame / when nothing is playing
if (np?.track) {
  console.log(np.track.title, np.paused ? '⏸' : '▶',
    `${Math.round(np.progressMs / 1000)}/${Math.round(np.durationMs / 1000)}s`); // progressMs is live-extrapolated
}
```

`deviceId` defaults to an id generated once and reused across reconnects — **don't
rotate it per reconnect**: Ynison dedupes its broadcast by device, so a fresh id
drops your observer from the fan-out and the state silently freezes. The `state` /
`lastStateAgeMs` / `liveProgressMs()` getters give the rest of the snapshot for `/health`.

### Ynison commands

`RealtimeClient` (and `YnisonClient`) can control the device that is currently
playing: `pause()`, `resume()`, `nextTrack()`, `previousTrack()`,
`setVolume(volume, targetDeviceId?)` and the low-level `sendRaw(request)`. A
command goes to the active device; with no playing device it throws
`YnisonNoActiveDeviceError`, at the queue edge `YnisonQueueBoundaryError`, and
on a closed connection `YnisonConnectionClosedError`.

```ts
const rt = client.realtime();
rt.start(); // don't await
// ... after the first state:
rt.pause();
rt.nextTrack();
rt.setVolume(0.5);
```

Terminal errors (`YnisonUnauthorizedError`, `YnisonDeviceDisplacedError`) stop
reconnecting (the cause is in `terminalError`); a server go-away is not terminal:
the client waits `min(retryAfterMs, goAwayMaxMs)`; everything else is retried on the schedule
`[0, 1000, 5000, 30000]` ms plus jitter (`reconnectBaseMs` is only a minimum
delay, and the server's `ynison-backoff-millis` replaces the schedule). If two
observers on one token displace each other, give them different `deviceId`s;
`deviceIdFromToken(token)` returns a deterministic id. The `ynison: { redirectUrl,
stateUrl, connectTimeoutMs }` option overrides the endpoints and the connect
timeout. The commands were implemented from the reference library and have not
been run against a real player.

### Playlists: revision

`usersPlaylistsChange`, `usersPlaylistsInsertTrack` and `usersPlaylistsDeleteTrack`
take an optional `revision`: when omitted, the library first fetches the
playlist's current revision (falling back to 1). An explicit stale revision is
rejected by the server with HTTP 412.

### "My Wave" sessions

`rotorSessionNew(seeds, options)` now sends a `POST` with a JSON body. The usual
loop is `rotorSessionNew` → `rotorSessionTracks(sessionId, { queue })` → the
feedback shortcuts `rotorSessionFeedbackTrackStarted` / `TrackFinished` / `Skip`
(see `examples/13-wave-session.ts`). The event timestamp defaults to an ISO "now".
The old `rotorSessionNew(boolean)` and `rotorSessionsFeedbacks(params)` forms are
deprecated. The station, stream and combined-session request bodies follow the
reference library and have not been verified live.

## Examples

Runnable examples live in [`examples/`](./examples):

- `01-quickstart.ts` — a track, its direct link and lyrics;
- `02-search.ts` — search and suggestions;
- `03-device-auth.ts` — obtaining a token via the device flow;
- `04-realtime.ts` — following "now playing" over Ynison;
- `05-likes-library.ts` — browse the library, like/unlike round-trip;
- `06-playlists.ts` — full playlist lifecycle (create → edit → delete);
- `07-radio.ts` — "My Wave" stations, track batches, feedback;
- `08-charts-and-new.ts` — chart, new releases, genres;
- `09-lyrics.ts` — time-synced (LRC) lyrics;
- `10-download-quality.ts` — quality/codec selection incl. lossless (FLAC);
- `11-artist.ts` — artist brief info, tracks, discography, similar;
- `12-custom-fetch.ts` — injecting a custom `fetch` (e.g. `node-wreq` for TLS impersonation);
- `13-wave-session.ts` — a "My Wave" session loop: new session, track batches, feedback;
- `14-ynison-remote.ts` — controlling a playing device over Ynison (pause, resume, next);
- `15-file-info.ts` — `tracksFileInfo` download (lossless with an hq fallback).

See [`examples/README.md`](./examples/README.md) for details and run commands.

## Documentation

The narrative guides under [`docs/guides`](docs/guides) are written in Russian
(they back the [documentation site](https://gh.dvxch.link/yandex-music/)); the
auto-generated **[API reference](https://gh.dvxch.link/yandex-music/)** (TypeDoc,
built from the English source comments) covers every class, method and model
and is the best starting point if you don't read Russian.

## Acknowledgements

Thanks to [MarshalX](https://github.com/MarshalX) for the
[yandex-music](https://github.com/MarshalX/yandex-music-api) library — an
invaluable map of the Yandex Music API.

## License

[MIT](./LICENSE) © dvxch
