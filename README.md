# @dvxch/yandex-music

A typed, async **TypeScript client for the Yandex Music API**.

`@dvxch/yandex-music` is an independent, from-scratch TypeScript implementation of
the Yandex Music HTTP API — not a transpile of any existing library. It targets
modern Node.js (≥ 20), ships ESM with full type declarations, and has **zero
runtime dependencies** (it uses the built-in `fetch`).

> Status: the full HTTP API is covered — `account` / `tracks` / `albums` /
> `artists` / `search` / `likes` / `playlists` / `device auth` / `landing` /
> `radio` / `queue` / `history` / `clips` / `credits` / `disclaimers` / `labels`
> / `metatags` / `pins` / `presaves` / `concerts` — all implemented and tested,
> including playlist mutations, dislikes and rotor feedback. Only ynison
> real-time remote control remains — see [Roadmap](#roadmap).

## Install

```bash
npm install @dvxch/yandex-music
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

## Implemented endpoints

| Domain      | Methods |
| ----------- | ------- |
| account     | `init`, `accountStatus` |
| tracks      | `tracks`, `tracksDownloadInfo`, `tracksLyrics`, `tracksSimilar`, `tracksFullInfo`, `tracksTrailer` |
| albums      | `albums`, `albumsWithTracks`, `albumsSimilarEntities`, `albumsTrailer` |
| artists     | `artists`, `artistsBriefInfo`, `artistsTracks`, `artistsTrackIds`, `artistsDirectAlbums`, `artistsAlsoAlbums`, `artistsDiscographyAlbums`, `artistsSafeDirectAlbums`, `artistsSimilar`, `artistsLinks`, `artistsTrailer` |
| search      | `search`, `searchSuggest` |
| likes       | `usersLikesTracks` + add/remove for tracks, artists, albums, playlists; `usersDislikesTracks`/`Artists` + add/remove |
| playlists   | `playlist`, `playlists`, `playlistsList`, `playlistsPersonal`, `usersPlaylists`, `usersPlaylistsList`, `usersPlaylistsKinds`, `usersPlaylistsCreate`, `usersPlaylistsDelete`, `usersPlaylistsName`, `usersPlaylistsVisibility`, `usersPlaylistsDescription`, `usersPlaylistsChange`, `usersPlaylistsInsertTrack`, `usersPlaylistsDeleteTrack`, `usersPlaylistsRecommendations`, `usersPlaylistsTrailer`, `playlistSimilarEntities`, `playlistsCollectiveJoin` |
| device auth | `requestDeviceCode`, `pollDeviceToken`, `deviceAuth` (blocking flow) |
| landing     | `landing`, `chart`, `newReleases`, `newPlaylists`, `podcasts`, `genres` |
| radio       | `rotorStationsDashboard`, `rotorStationsList`, `rotorStationInfo`, `rotorStationTracks`, `rotorAccountStatus`, `rotorStationFeedback` (+`radioStarted`/`trackStarted`/`trackFinished`/`skip` shortcuts), `rotorStationSettings2` |
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

## Roadmap

- ynison remote control (a dedicated WebSocket module, separate from this HTTP
  client) — wrapped in a friendly real-time event API
- typed sub-models: `Status` (permissions/subscription/plus), block-entity
  variants, station settings/restrictions

## Development

```bash
npm run typecheck   # type-check src + tests
npm test            # run the test suite (node:test)
npm run build       # emit dist/ (ESM + .d.ts)
npm run docs        # generate API docs (TypeDoc) into docs/api
```

## License

LGPL-3.0-or-later.
