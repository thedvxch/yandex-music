# yamuse

A typed, async **TypeScript client for the Yandex Music API**.

`yamuse` is an independent, from-scratch TypeScript implementation of the Yandex
Music HTTP API — not a transpile of any existing library. It targets modern
Node.js (≥ 20), ships ESM with full type declarations, and has **zero runtime
dependencies** (it uses the built-in `fetch`).

> Status: growing. Twelve domains — `account` / `tracks` / `albums` / `artists` /
> `search` / `likes` / `playlists` (read) / `device auth` / `landing` / `radio` /
> `queue` / `history` — are implemented and tested. The rest (ynison remote
> control, playlist mutations, …) are being added incrementally — see
> [Roadmap](#roadmap).

## Install

```bash
npm install yamuse
```

## Quick start

```ts
import { Client } from 'yamuse';

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
| albums      | `albums`, `albumsWithTracks` |
| artists     | `artists`, `artistsTracks` |
| search      | `search`, `searchSuggest` |
| likes       | `usersLikesTracks` + add/remove for tracks, artists, albums, playlists |
| playlists   | `playlist`, `usersPlaylists`, `usersPlaylistsList`, `usersPlaylistsKinds` |
| device auth | `requestDeviceCode`, `pollDeviceToken`, `deviceAuth` (blocking flow) |
| landing     | `landing`, `chart`, `newReleases`, `newPlaylists`, `podcasts`, `genres` |
| radio       | `rotorStationsDashboard`, `rotorStationsList`, `rotorStationInfo`, `rotorStationTracks`, `rotorAccountStatus` |
| queue       | `queuesList`, `queue`, `queueUpdatePosition` |
| history     | `musicHistory` |

## Roadmap

- ynison remote control (a dedicated WebSocket module, separate from this HTTP client)
- `feed`, `musicHistoryItems`, `queueCreate`
- playlist mutations (create / rename / change / insert-track), dislikes,
  rotor feedback
- clips, concerts, credits, disclaimers, labels, metatags, pins, presaves
- typed sub-models: `Status` (permissions/subscription/plus), block-entity
  variants, station settings/restrictions

## Development

```bash
npm run typecheck   # type-check src + tests
npm test            # run the test suite (node:test)
npm run build       # emit dist/ (ESM + .d.ts)
```

## License

LGPL-3.0-or-later.
