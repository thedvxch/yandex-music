---
title: Реализованные эндпоинты
group: Документация
---

# Реализованные эндпоинты

Реализован и протестирован весь HTTP API. Каждый эндпоинт прогнан на живом API
Яндекс Музыки с реальным токеном. Те немногие эндпоинты, которые сервер больше не
отдаёт обычному аккаунту (например, устаревшее создание очереди, rotor feedback),
кидают типизированную ошибку, а не падают молча.

| Домен       | Методы |
| ----------- | ------- |
| account     | `init`, `accountStatus`, `accountSettings`, `accountSettingsSet`, `settings`, `usersSettings`, `permissionAlerts`, `accountExperiments`, `accountExperimentsDetails`, `consumePromoCode` |
| tracks      | `tracks`, `tracksDownloadInfo`, `tracksLyrics`, `tracksSimilar`, `tracksFullInfo`, `tracksTrailer`, `trackSupplement`, `tracksCredits`, `tracksDisclaimer`, `playAudio`, `afterTrack` |
| albums      | `albums`, `albumsWithTracks`, `albumsSimilarEntities`, `albumsTrailer`, `albumsDisclaimer` |
| artists     | `artists`, `artistsBriefInfo`, `artistsTracks`, `artistsTrackIds`, `artistsDirectAlbums`, `artistsAlsoAlbums`, `artistsDiscographyAlbums`, `artistsSafeDirectAlbums`, `artistsSimilar`, `artistsLinks`, `artistsTrailer` |
| search      | `search`, `searchSuggest` |
| likes       | `usersLikesTracks` + add/remove для треков, артистов, альбомов, плейлистов; `usersDislikesTracks`/`Artists` + add/remove |
| playlists   | `playlist`, `playlists`, `playlistsList`, `playlistsPersonal`, `usersPlaylists`, `usersPlaylistsList`, `usersPlaylistsKinds`, `usersPlaylistsCreate`, `usersPlaylistsDelete`, `usersPlaylistsName`, `usersPlaylistsVisibility`, `usersPlaylistsDescription`, `usersPlaylistsChange`, `usersPlaylistsInsertTrack`, `usersPlaylistsDeleteTrack`, `usersPlaylistsRecommendations`, `usersPlaylistsTrailer`, `playlistSimilarEntities`, `playlistsCollectiveJoin` |
| device auth | `requestDeviceCode`, `pollDeviceToken`, `deviceAuth` (блокирующий flow), `refreshAccessToken` (обновление по refresh-токену) |
| landing     | `landing`, `chart`, `newReleases`, `newPlaylists`, `podcasts`, `genres` |
| radio       | `rotorStationsDashboard`, `rotorStationsList`, `rotorStationInfo`, `rotorStationTracks`, `rotorAccountStatus`, `rotorStationFeedback` (+ шорткаты `radioStarted`/`trackStarted`/`trackFinished`/`skip`), `rotorStationSettings2` |
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
| realtime    | `client.realtime()` → `RealtimeClient` (Ynison; нужен `ws`) |

## Скачивание и качество

Для lossy-вариантов используйте `tracksDownloadInfo` / `track.getDownloadInfo()` и
выбирайте по битрейту:

```ts
const variants = await track!.getDownloadInfo();          // DownloadInfo[]
const best = [...variants].sort((a, b) => (b.bitrateInKbps ?? 0) - (a.bitrateInKbps ?? 0))[0];
await best!.download('track.mp3');
```

Для lossless (FLAC) — отдельный путь через `get-file-info`
(`LosslessDownloadInfo`, AES-CTR-расшифровка), описанный в типах пакета.
