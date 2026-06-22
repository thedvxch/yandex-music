# yamuse

A typed, async **TypeScript client for the Yandex Music API**.

`yamuse` is an independent, from-scratch TypeScript implementation of the Yandex
Music HTTP API — not a transpile of any existing library. It targets modern
Node.js (≥ 20), ships ESM with full type declarations, and has **zero runtime
dependencies** (it uses the built-in `fetch`).

> Status: early. The transport, model machinery and the `tracks` / `albums` /
> `artists` / `account` domains are implemented and tested. The remaining
> domains (search, playlists, landing, likes, radio, queue, ynison, device auth,
> …) are being added incrementally — see [Roadmap](#roadmap).

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

| Domain   | Methods |
| -------- | ------- |
| account  | `init`, `accountStatus` |
| tracks   | `tracks`, `tracksDownloadInfo`, `tracksLyrics`, `tracksSimilar`, `tracksFullInfo`, `tracksTrailer` |
| albums   | `albums`, `albumsWithTracks` |
| artists  | `artists`, `artistsTracks` |

## Roadmap

- search (`search`, `searchSuggest`) + playlist/video/user models
- landing, likes, radio (rotor), queue, ynison remote control
- device auth (OAuth device flow), clips, concerts, credits, disclaimers,
  labels, metatags, music history, pins, presaves
- typed `Status` sub-models (permissions, subscription, plus)

## Development

```bash
npm run typecheck   # type-check src + tests
npm test            # run the test suite (node:test)
npm run build       # emit dist/ (ESM + .d.ts)
```

## License

LGPL-3.0-or-later.
