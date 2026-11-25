---
title: Реализованные эндпоинты
group: Документация
---

# Реализованные эндпоинты

Реализован весь HTTP API, который удалось сопоставить со справочной библиотекой
(MarshalX/yandex-music-api 3.2.2). Статус каждого метода указан в таблице «Каталог
методов» ниже: `reference-parity` — форма запроса сверена с референсом (часть
методов дополнительно прогнана на живом API), `TS-only (unverified)` — метода нет в
референсе, он реализован по наблюдаемому поведению и не проверялся. Эндпоинты,
которые сервер больше не отдаёт обычному аккаунту, кидают типизированную ошибку, а
не падают молча.

| Домен       | Методы |
| ----------- | ------- |
| account     | `init`, `accountStatus`, `accountSettings`, `accountSettingsSet`, `settings`, `usersSettings`, `permissionAlerts`, `accountExperiments`, `accountExperimentsDetails`, `consumePromoCode` |
| tracks      | `tracks`, `tracksDownloadInfo`, `tracksLosslessInfo`, `tracksFileInfo`, `tracksLyrics`, `tracksSimilar`, `tracksFullInfo`, `tracksTrailer`, `trackSupplement`, `tracksCredits`, `tracksDisclaimer`, `playAudio`, `afterTrack` |
| albums      | `albums`, `albumsWithTracks`, `albumsSimilarEntities`, `albumsTrailer`, `albumsDisclaimer` |
| artists     | `artists`, `artistsBriefInfo`, `artistsTracks`, `artistsTrackIds`, `artistsDirectAlbums`, `artistsAlsoAlbums`, `artistsDiscographyAlbums`, `artistsSafeDirectAlbums`, `artistsSimilar`, `artistsLinks`, `artistsTrailer` |
| search      | `search`, `searchSuggest` |
| likes       | `usersLikesTracks` + add/remove для треков, артистов, альбомов, плейлистов, клипов; `usersLikesArtistsWithTimestamps`; `usersDislikesTracks`/`Artists` + add/remove |
| playlists   | `playlist`, `playlists`, `playlistsList`, `playlistsPersonal`, `usersPlaylists`, `usersPlaylistsList`, `usersPlaylistsKinds`, `usersPlaylistsCreate`, `usersPlaylistsDelete`, `usersPlaylistsName`, `usersPlaylistsVisibility`, `usersPlaylistsDescription`, `usersPlaylistsChange`, `usersPlaylistsInsertTrack`, `usersPlaylistsDeleteTrack`, `usersPlaylistsRecommendations`, `usersPlaylistsTrailer`, `playlistSimilarEntities`, `playlistsCollectiveJoin` |
| device auth | `requestDeviceCode`, `pollDeviceToken`, `deviceAuth` (блокирующий flow), `refreshAccessToken` (обновление по refresh-токену) |
| landing     | `landing`, `chart`, `newReleases`, `newPlaylists`, `podcasts`, `genres` |
| radio       | `rotorStationsDashboard`, `rotorStationsList`, `rotorStationInfo`, `rotorStationTracks`, `rotorAccountStatus`, `rotorStationFeedback` (+ шорткаты `rotorStationFeedbackRadioStarted`/`TrackStarted`/`TrackFinished`/`Skip`), `rotorStationSettings2`, `rotorStationStream`, `rotorStationStreamFeedback`, `rotorWaveSettings`, `rotorSessionNew`, `rotorSessionClone`, `rotorSessionTracks`, `rotorSessionFeedback*`, `rotorSessionsFeedbacks`, `rotorCombinedSession*` |
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

Для lossless (FLAC) — отдельный путь через подписанный `get-file-info`:

```ts
// raw-транспорт (по умолчанию): обычный поток
const file = await client.tracksFileInfo(trackId, { quality: 'lossless' }); // 'lossless' | 'hq' | 'nq'
await file?.downloadInfo?.download('track.flac');

// encraw-транспорт: поток зашифрован, download() расшифровывает на лету
const info = await client.tracksLosslessInfo(trackId, 'lossless');
await info?.download('track.flac');
```

- Опции `tracksFileInfo`: `quality`, `codecs`, `transport` (`raw`/`encraw`),
  `signKey`, `clientHeader` (ключ и заголовок должны соответствовать друг другу).
  По умолчанию запрос подписывается десктопным ключом (`DESKTOP_SIGN_KEY`) и
  заголовком `DESKTOP_CLIENT` (`YandexMusicDesktopAppWindows/5.95.0`); id трека
  уходит как передан. Проверено вживую: lossless `flac-mp4` по `raw`, hq `aac-mp4`
  и `encraw` с ключом. `isEncrypted` и `download()` расшифровывают поток, если есть
ключ и транспорт не `raw` (отсутствующий транспорт считается зашифрованным).
- `FileInfo.downloadInfo` — `LosslessDownloadInfo` (`FileDownloadInfo` — его
  синоним): `codec`, `bitrate`, `isLossless`, `isEncrypted`, `links()`,
  `getDirectLink()`, `downloadBytes()`, `download(path)`. Если lossless-источника
  нет, сервер вернёт lossy-кодек.
- `track.getFileInfo(options)` и `track.getLosslessInfo(quality)` — то же через модель.

## Что изменилось в 0.4.0

Полный список — в [CHANGELOG](https://github.com/thedvxch/yandex-music/blob/main/CHANGELOG.md).

### Лайки

- `usersLikesArtistsWithTimestamps()` возвращает `Like[]` с временными метками.
- `usersLikesTracks` / `usersDislikesTracks` принимают `ifModifiedSinceRevision`.
- `usersLikesAlbums(userId, rich = true)` по умолчанию просит расширенный ответ.
- `usersLikesClipsAdd` кладёт `clip-id` в query (тело пустое). `Like.id` всегда строка.

### Плейлисты: ревизия

`usersPlaylistsChange`, `usersPlaylistsInsertTrack` и `usersPlaylistsDeleteTrack`
принимают `revision` необязательно. Если его не передать, библиотека сначала
запрашивает текущую ревизию (при неудаче берёт 1). Явная устаревшая ревизия
отклоняется сервером с HTTP 412 (проверено вживую).

### Сессии «Моей волны»

`rotorSessionNew(seeds, options)` — `POST` с JSON-телом (раньше `GET`); `seeds` —
строка или массив (`'user:onyourwave'`, `'genre:rock'`, `'track:123'`), `options` —
`RotorSessionOptions`. `rotorSessionTracks(id, { queue, feedbacks })` возвращает
`RotorSessionTracks`; обратная связь — `rotorSessionFeedback*` (метка времени по
умолчанию — ISO «сейчас»). Форма `rotorSessionNew(boolean)` и
`rotorSessionsFeedbacks(params)` устарели. Пример — `examples/13-wave-session.ts`.

Обратная связь по станции (`rotorStationFeedback*`) теперь уходит JSON-телом; метка
времени — ISO-строка, а не секунды; `batch-id` и `streamId` идут в query.

### Исправленные значения по умолчанию

`artistsSkeleton` — id скелета необязателен (`web-artist-default`);
`playAudio` без uid не шлёт `uid=''`; методы с user id без `init()` бросают
`IdMissingError` до запроса; `search()` бросает `BadRequestError` на ответ-строку.
Неизменным оставлен `presaves includeReleased = true` (в референсе `false`).

### Ранее «сырые» поля, теперь с типами

Ключи те же, меняются только типы: код, который присваивает эти поля переменным
`JSONValue`, может перестать компилироваться; чтение свойств в рантайме работает
как раньше. Полный список — в разделе «Typed previously-raw fields» CHANGELOG. Для
миграции чаще всего нужно: `Album.trailer` → `AlbumTrailerStatus`,
`Artist.donationInfo` → `ArtistDonationInfo`, `ArtistSkeleton.blocks` →
`SkeletonBlock[]`, `Playlist.tags` → `Tag[]`, `Feed.headlines` → `FeedHeadline[]`
(это объекты `{ type, id, message }`, а не строки), `Feed.nextRevision` → `string`.
`Artist.id` по-прежнему типизирован как `number`, хотя живой API в `usersLikesArtists`
отдаёт строку.

## Каталог методов

Колонка «Эндпоинт» собрана из исходников (`src/methods`) и показывает, какой путь
вызывает метод; «Пагинация» описывает параметры «как есть» — у API разные
эндпоинты используют разные схемы, библиотека их не унифицирует. Методы
`init` и `*Add`/`*Remove` — тонкие обёртки над общими хелперами.

| Метод | Эндпоинт | Статус | Пагинация |
| ----- | -------- | ------ | --------- |
| `init` | `GET /account/status` (через `accountStatus`) | reference-parity | — |
| `accountStatus` | `GET /account/status` | reference-parity | — |
| `accountAbout` | `GET /account/about` | TS-only (unverified) | — |
| `accountSettings` | `GET /account/settings` | reference-parity | — |
| `accountSettingsSet` | `POST /account/settings` | reference-parity | — |
| `settings` | `GET /settings` | reference-parity | — |
| `permissionAlerts` | `GET /permission-alerts` | reference-parity | — |
| `accountExperiments` | `GET /account/experiments` | reference-parity | — |
| `accountExperimentsDetails` | `GET /account/experiments/details` | reference-parity | — |
| `consumePromoCode` | `POST /account/consume-promo-code` | reference-parity | — |
| `personalTopArtistsMonth` | `GET /personal/top/artists/month` | TS-only (unverified) | — |
| `collectionSync` | `POST /collection/sync` | TS-only (unverified) | — |
| `albums` | `POST /albums` (пакетное чтение) | reference-parity | — |
| `albumsWithTracks` | `GET /albums/{albumId}/with-tracks` | reference-parity | — |
| `albumsSimilarEntities` | `GET /albums/{albumId}/similar-entities` | reference-parity | — |
| `albumsTrailer` | `GET /albums/{albumId}/trailer` | reference-parity | — |
| `albumsDonations` | `GET /donation/albums/{albumId}` | TS-only (unverified) | — |
| `albumsRelatedContent` | `GET /albums/{albumId}/related-content` | TS-only (unverified) | — |
| `artists` | `POST /artists` (пакетное чтение) | reference-parity | — |
| `artistsBriefInfo` | `GET /artists/{artistId}/brief-info` | reference-parity | — |
| `artistsTracks` | `GET /artists/{artistId}/tracks` | reference-parity | `page` + `page-size` |
| `artistsDirectAlbums` | `GET /artists/{artistId}/direct-albums` | reference-parity | `page` + `page-size` |
| `artistsAlsoAlbums` | `GET /artists/{artistId}/also-albums` | reference-parity | `page` + `page-size` |
| `artistsDiscographyAlbums` | `GET /artists/{artistId}/discography-albums` | reference-parity | `page` + `page-size` |
| `artistsSafeDirectAlbums` | `GET /artists/{artistId}/safe-direct-albums` | reference-parity | `limit` |
| `artistsSimilar` | `GET /artists/{artistId}/similar` | reference-parity | — |
| `artistsLinks` | `GET /artists/{artistId}/artist-links` | reference-parity | — |
| `artistsTrailer` | `GET /artists/{artistId}/trailer` | reference-parity | — |
| `artistsTrackIds` | `GET /artists/{artistId}/track-ids` | reference-parity | `page` + `page-size` |
| `artistsInfo` | `GET /artists/{artistId}/info` | reference-parity | — |
| `artistsAbout` | `GET /artists/{artistId}/about-artist` | reference-parity | — |
| `artistsClips` | `GET /artists/{artistId}/blocks/artist-clips` | reference-parity | — |
| `artistsDonation` | `GET /artists/{artistId}/blocks/artist-donation` | reference-parity | — |
| `artistsSkeleton` | `GET /artists/{artistId}/skeletons/{skeletonId}` | reference-parity | — |
| `artistsFamiliarYou` | `GET /artists/{artistId}/familiar-you` | TS-only (unverified) | — |
| `clips` | `GET /clips` | reference-parity | — |
| `clipsWillLike` | `GET /clips/will/like` | reference-parity | `page` + `pageSize` |
| `artistsConcerts` | `GET /artists/{artistId}/concerts` | reference-parity | — |
| `concertInfo` | `GET /concerts/{concertId}/info` | reference-parity | — |
| `concertSkeleton` | `GET /concerts/{concertId}/skeletons/{skeletonId}` | reference-parity | — |
| `concertsFeed` | `GET /concerts/feed` | reference-parity | — |
| `concertsLocations` | `GET /concerts/locations` | reference-parity | — |
| `concertsTabConfig` | `GET /concerts/tab-config` | reference-parity | — |
| `concertsLandingArtists` | `POST /concerts/landing/artists` | TS-only (unverified) | — |
| `tracksCredits` | `GET /tracks/{trackId}/credits` | reference-parity | — |
| `clipsCredits` | `GET /clips/{clipId}/credits` | reference-parity | — |
| `requestDeviceCode` | `POST https://oauth.yandex.ru/device/code` | reference-parity | — |
| `pollDeviceToken` | цикл по `pollDeviceTokenOnce` | reference-parity | — |
| `pollDeviceTokenOnce` | `POST https://oauth.yandex.ru/token` | reference-parity | — |
| `refreshAccessToken` | `POST https://oauth.yandex.ru/token` | TS-only (unverified) | — |
| `deviceAuth` | `requestDeviceCode` + `pollDeviceToken` | reference-parity | — |
| `tracksDisclaimer` | `GET /tracks/{trackId}/disclaimer` | reference-parity | — |
| `clipsDisclaimer` | `GET /clips/{clipId}/disclaimer` | reference-parity | — |
| `albumsDisclaimer` | `GET /albums/{albumId}/disclaimer` | reference-parity | — |
| `artistsDisclaimer` | `GET /artists/{artistId}/disclaimer` | reference-parity | — |
| `disclaimers` | `GET /disclaimers` | TS-only (unverified) | — |
| `label` | `GET /labels/{labelId}` | reference-parity | — |
| `labelAlbums` | `GET /labels/{labelId}/albums` | reference-parity | `page` + `pageSize` |
| `labelArtists` | `GET /labels/{labelId}/artists` | reference-parity | `page` + `pageSize` |
| `landing` | `GET /landing3` | reference-parity | — |
| `chart` | `GET /landing3/chart/{chartOption}` | reference-parity | — |
| `newReleases` | `GET /landing3/new-releases` | reference-parity | — |
| `newPlaylists` | `GET /landing3/new-playlists` | reference-parity | — |
| `podcasts` | `GET /landing3/podcasts` | reference-parity | — |
| `genres` | `GET /genres` | reference-parity | — |
| `feed` | `GET /feed` | reference-parity | — |
| `feedWizardIsPassed` | `GET /feed/wizard/is-passed` | reference-parity | — |
| `feedPlaylistsSeen` | `GET /feed/playlists/seen` | TS-only (unverified) | — |
| `chartAlbums` | `GET /chart/albums` | TS-only (unverified) | — |
| `chartPodcasts` | `GET /chart/podcasts` | TS-only (unverified) | — |
| `nonMusicBookshelf` | `GET /non-music/bookshelf` | TS-only (unverified) | — |
| `nonMusicCatalogue` | `GET /non-music/catalogue` | TS-only (unverified) | — |
| `nonMusicNewEpisodes` | `GET /non-music/new-episodes` | TS-only (unverified) | — |
| `landingRecentlyPlayed` | `GET /landing-blocks/recently-played` | TS-only (unverified) | — |
| `landingMixes` | `GET /landing/block/mixes` | TS-only (unverified) | — |
| `landingBlockEntities` | `GET /landing/block/{blockId}/entities` | TS-only (unverified) | `page` + `page-size` |
| `landingBlocksEntitiesTag` | `GET /landing-blocks/entities/tag/{metaTagId}/block/{metaTagType}` | TS-only (unverified) | `page` + `page-size` |
| `landingBlocksNonMusicContinueListen` | `GET /landing-blocks/non-music/continue-listen` | TS-only (unverified) | — |
| `lumen` | `GET /lumen` | TS-only (unverified) | — |
| `nonMusicCategoryAlbums` | `GET /non-music/category/{name}/albums` | TS-only (unverified) | — |
| `nonMusicCompilation` | `GET /non-music/compilations/{compilationId}` | TS-only (unverified) | — |
| `nonMusicEditorialAlbum` | `GET /non-music/editorial/album/{name}` | TS-only (unverified) | — |
| `nonMusicEditorialPlaylist` | `GET /non-music/editorial/playlist/{name}` | TS-only (unverified) | — |
| `childrenLandingCategoryAlbums` | `GET /children-landing/category/{name}/albums` | TS-only (unverified) | — |
| `childrenLandingCompilation` | `GET /children-landing/compilations/{compilationId}` | TS-only (unverified) | — |
| `childrenLandingEditorialAlbum` | `GET /children-landing/editorial/album/{name}` | TS-only (unverified) | — |
| `childrenLandingEditorialPlaylist` | `GET /children-landing/editorial/playlist/{name}` | TS-only (unverified) | — |
| `recapSlidesUser` | `GET /recap-slides/user` | TS-only (unverified) | — |
| `recapSlidesKids` | `GET /recap-slides/kids` | TS-only (unverified) | — |
| `recapSlidesArtist` | `GET /recap-slides/artist/{artistId}` | TS-only (unverified) | — |
| `tags` | `GET /tags/{tagId}/playlist-ids` | reference-parity | — |
| `usersLikesTracksAdd` | `POST /users/{uid}/likes/tracks/add-multiple` | reference-parity | — |
| `usersLikesTracksRemove` | `POST /users/{uid}/likes/tracks/remove` | reference-parity | — |
| `usersLikesArtistsAdd` | `POST /users/{uid}/likes/artists/add-multiple` | reference-parity | — |
| `usersLikesArtistsRemove` | `POST /users/{uid}/likes/artists/remove` | reference-parity | — |
| `usersLikesAlbumsAdd` | `POST /users/{uid}/likes/albums/add-multiple` | reference-parity | — |
| `usersLikesAlbumsRemove` | `POST /users/{uid}/likes/albums/remove` | reference-parity | — |
| `usersLikesPlaylistsAdd` | `POST /users/{uid}/likes/playlists/add-multiple` | reference-parity | — |
| `usersLikesPlaylistsRemove` | `POST /users/{uid}/likes/playlists/remove` | reference-parity | — |
| `usersLikesTracks` | `GET /users/{uid}/likes/tracks` | reference-parity | — |
| `usersLikesAlbums` | `GET /users/{uid}/likes/albums` | reference-parity | — |
| `usersLikesArtists` | `GET /users/{uid}/likes/artists` | reference-parity | — |
| `usersLikesArtistsWithTimestamps` | `GET /users/{uid}/likes/artists` | reference-parity | — |
| `usersLikesPlaylists` | `GET /users/{uid}/likes/playlists` | reference-parity | — |
| `usersDislikesTracks` | `GET /users/{uid}/dislikes/tracks` | reference-parity | — |
| `usersDislikesTracksAdd` | `POST /users/{uid}/dislikes/tracks/add-multiple` | reference-parity | — |
| `usersDislikesTracksRemove` | `POST /users/{uid}/dislikes/tracks/remove` | reference-parity | — |
| `usersDislikesArtists` | `GET /users/{uid}/dislikes/artists` | reference-parity | — |
| `usersDislikesArtistsAdd` | `POST /users/{uid}/dislikes/artists/add-multiple` | reference-parity | — |
| `usersDislikesArtistsRemove` | `POST /users/{uid}/dislikes/artists/remove` | reference-parity | — |
| `usersLikesClips` | `GET /users/{uid}/likes/clips` | reference-parity | `page` + `pageSize` |
| `usersLikesClipsAdd` | `POST /users/{uid}/likes/clips/add` | reference-parity | — |
| `usersLikesClipsRemove` | `POST /users/{uid}/likes/clips/{clipId}/remove` | reference-parity | — |
| `metatags` | `GET /landing3/metatags` | reference-parity | — |
| `metatag` | `GET /metatags/{metatagId}` | reference-parity | — |
| `metatagAlbums` | `GET /metatags/{metatagId}/albums` | reference-parity | `offset` + `limit` |
| `metatagArtists` | `GET /metatags/{metatagId}/artists` | reference-parity | `offset` + `limit` |
| `metatagPlaylists` | `GET /metatags/{metatagId}/playlists` | reference-parity | `offset` + `limit` |
| `musicHistory` | `GET /music-history` | reference-parity | — |
| `musicHistoryItems` | `POST /music-history/items` | reference-parity | — |
| `pins` | `GET /pins` | reference-parity | — |
| `pinAlbum` | `PUT /pin/album` | reference-parity | — |
| `unpinAlbum` | `DELETE /pin/album` | reference-parity | — |
| `pinArtist` | `PUT /pin/artist` | reference-parity | — |
| `unpinArtist` | `DELETE /pin/artist` | reference-parity | — |
| `pinPlaylist` | `PUT /pin/playlist` | reference-parity | — |
| `unpinPlaylist` | `DELETE /pin/playlist` | reference-parity | — |
| `pinWave` | `PUT /pin/wave` | reference-parity | — |
| `unpinWave` | `DELETE /pin/wave` | reference-parity | — |
| `usersSettings` | `GET /users/{uid}/settings` | reference-parity | — |
| `usersPlaylists` | `POST /users/{uid}/playlists` | reference-parity | — |
| `usersPlaylistsRecommendations` | `GET /users/{uid}/playlists/{kind}/recommendations` | reference-parity | — |
| `usersPlaylistsCreate` | `POST /users/{uid}/playlists/create` | reference-parity | — |
| `usersPlaylistsDelete` | `POST /users/{uid}/playlists/{kind}/delete` | reference-parity | — |
| `usersPlaylistsName` | `POST /users/{uid}/playlists/{kind}/name` | reference-parity | — |
| `usersPlaylistsVisibility` | `POST /users/{uid}/playlists/{kind}/visibility` | reference-parity | — |
| `usersPlaylistsDescription` | `POST /users/{uid}/playlists/{kind}/description` | reference-parity | — |
| `usersPlaylistsChange` | `POST /users/{uid}/playlists/{kind}/change` | reference-parity | — |
| `usersPlaylistsInsertTrack` | через `usersPlaylistsChange` | reference-parity | — |
| `usersPlaylistsDeleteTrack` | через `usersPlaylistsChange` | reference-parity | — |
| `playlistsCollectiveJoin` | `POST /playlists/collective/join` | reference-parity | — |
| `usersPlaylistsList` | `GET /users/{uid}/playlists/list` | reference-parity | — |
| `playlist` | `GET /playlist/{playlistUuid}` | reference-parity | — |
| `playlistSimilarEntities` | `GET /playlist/{playlistUuid}/similar-entities` | reference-parity | — |
| `playlists` | `GET /playlists` | reference-parity | — |
| `playlistsList` | через `getList` | reference-parity | — |
| `playlistsPersonal` | `GET /playlists/personal/{playlistId}` | reference-parity | — |
| `usersPlaylistsTrailer` | `GET /users/{uid}/playlists/{kind}/trailer` | reference-parity | — |
| `usersPlaylistsKinds` | `GET /users/{uid}/playlists/list/kinds` | reference-parity | — |
| `usersPresaves` | `GET /users/{uid}/presaves` | reference-parity | — |
| `usersPresavesAdd` | `POST /users/{uid}/presaves/add` | reference-parity | — |
| `usersPresavesRemove` | `POST /users/{uid}/presaves/remove` | reference-parity | — |
| `queuesList` | `GET /queues` | reference-parity | — |
| `queue` | `GET /queues/{queueId}` | reference-parity | — |
| `queueUpdatePosition` | `POST /queues/{queueId}/update-position` | reference-parity | — |
| `queueCreate` | `POST /queues` | reference-parity | — |
| `rotorAccountStatus` | `GET /rotor/account/status` | reference-parity | — |
| `rotorStationsDashboard` | `GET /rotor/stations/dashboard` | reference-parity | — |
| `rotorStationsList` | `GET /rotor/stations/list` | reference-parity | — |
| `rotorStationInfo` | `GET /rotor/station/{station}/info` | reference-parity | — |
| `rotorStationStream` | `GET /rotor/station/{station}/stream` | reference-parity | — |
| `rotorStationStreamFeedback` | `POST /rotor/station/{station}/feedback` | reference-parity | — |
| `rotorStationTracks` | `GET /rotor/station/{station}/tracks` | reference-parity | — |
| `rotorStationFeedback` | `POST /rotor/station/{station}/feedback` | reference-parity | — |
| `rotorStationFeedbackRadioStarted` | через `rotorStationFeedback` | reference-parity | — |
| `rotorStationFeedbackTrackStarted` | через `rotorStationFeedback` | reference-parity | — |
| `rotorStationFeedbackTrackFinished` | через `rotorStationFeedback` | reference-parity | — |
| `rotorStationFeedbackSkip` | через `rotorStationFeedback` | reference-parity | — |
| `rotorStationSettings2` | `POST /rotor/station/{station}/settings3` | reference-parity | — |
| `rotorWaveSettings` | `GET /rotor/wave/settings` | reference-parity | — |
| `rotorWaveLast` | `GET /rotor/wave/last` | reference-parity | — |
| `rotorWaveLastReset` | `POST /rotor/wave/last/reset` | reference-parity | — |
| `rotorSessionNew` | `POST /rotor/session/new` | reference-parity | — |
| `rotorCombinedSessionNew` | `POST /rotor/combined/session/new` | reference-parity | — |
| `rotorCombinedSessionLanding` | `POST /rotor/combined/session/landing` | reference-parity | — |
| `rotorGetOfflineRecommender` | `POST /rotor/get-offline-recommender` | TS-only (unverified) | — |
| `rotorSessionsFeedbacks` | `POST /rotor/sessions/feedbacks` | reference-parity | — |
| `rotorSessionTracks` | `POST /rotor/session/{sessionId}/tracks` | reference-parity | — |
| `rotorSessionClone` | `POST /rotor/session/{sessionId}/clone` | reference-parity | — |
| `rotorSessionFeedback` | `POST /rotor/session/{sessionId}/feedback` | reference-parity | — |
| `rotorSessionFeedbackRadioStarted` | через `rotorSessionFeedback` | reference-parity | — |
| `rotorSessionFeedbackTrackStarted` | через `rotorSessionFeedback` | reference-parity | — |
| `rotorSessionFeedbackTrackFinished` | через `rotorSessionFeedback` | reference-parity | — |
| `rotorSessionFeedbackSkip` | через `rotorSessionFeedback` | reference-parity | — |
| `rotorSessionFeedbacks` | `POST /rotor/session/{sessionId}/feedbacks` | reference-parity | — |
| `rotorCombinedSessionNext` | `POST /rotor/combined/session/{sessionId}/next` | reference-parity | — |
| `search` | `GET /search` | reference-parity | `page` |
| `searchSuggest` | `GET /search/suggest` | reference-parity | — |
| `searchInstant` | `GET /search/instant/mixed` | TS-only (unverified) | `page` + `pageSize` |
| `usersSearchHistory` | `GET /users/{uid}/search-history` | TS-only (unverified) | — |
| `usersSearchHistoryClear` | `GET /users/{uid}/search-history/clear` | TS-only (unverified) | — |
| `tracks` | через `getList` | reference-parity | — |
| `tracksDownloadInfo` | `GET /tracks/{trackId}/download-info` | reference-parity | — |
| `tracksFileInfo` | `GET /get-file-info` (подписанный) | reference-parity | — |
| `tracksLosslessInfo` | `GET /get-file-info` (подписанный, `encraw`) | reference-parity | — |
| `tracksLyrics` | `GET /tracks/{trackId}/lyrics` | reference-parity | — |
| `tracksSimilar` | `GET /tracks/{trackId}/similar` | reference-parity | — |
| `tracksSimilarEntities` | `GET /tracks/{trackId}/similar-entities` | TS-only (unverified) | — |
| `tracksFullInfo` | `GET /tracks/{trackId}/full-info` | reference-parity | — |
| `tracksTrailer` | `GET /tracks/{trackId}/trailer` | reference-parity | — |
| `trackSupplement` | `GET /tracks/{trackId}/supplement` | reference-parity | — |
| `playAudio` | `POST /play-audio` | reference-parity | — |
| `playsBulk` | `POST /plays` | TS-only (unverified) | — |
| `playerInformers` | `POST /player-informers` | TS-only (unverified) | — |
| `afterTrack` | `GET /after-track` | reference-parity | — |

