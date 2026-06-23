# @dvxch/yandex-music

[![npm](https://img.shields.io/npm/v/@dvxch/yandex-music?color=cb3837&logo=npm)](https://www.npmjs.com/package/@dvxch/yandex-music)
[![CI](https://github.com/thedvxch/yandex-music/actions/workflows/ci.yml/badge.svg)](https://github.com/thedvxch/yandex-music/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/@dvxch/yandex-music?logo=typescript&logoColor=white)](https://www.npmjs.com/package/@dvxch/yandex-music)
[![bundle](https://img.shields.io/badge/runtime%20deps-0-44cc11)](./package.json)
[![node](https://img.shields.io/node/v/@dvxch/yandex-music?logo=node.js&logoColor=white)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@dvxch/yandex-music?color=blue)](./LICENSE)

[🇬🇧 Documentation in English](./README.en.md) · [📖 API-документация](https://thedvxch.github.io/yandex-music/)

Типизированный асинхронный **TypeScript-клиент для API Яндекс Музыки**.

`@dvxch/yandex-music` — независимая реализация HTTP API Яндекс Музыки на
TypeScript, написанная с нуля, а не транспиляция какой-либо существующей
библиотеки. Ориентирован на современный Node.js (≥ 20), поставляется как ESM с
полными декларациями типов и **без рантайм-зависимостей** (использует встроенный
`fetch`).

> Статус: готово. Реализован и протестирован весь HTTP API — `account` / `tracks`
> / `albums` / `artists` / `search` / `likes` / `playlists` / `device auth` /
> `landing` / `radio` / `queue` / `history` / `clips` / `credits` /
> `disclaimers` / `labels` / `metatags` / `pins` / `presaves` / `concerts`, —
> включая мутации плейлистов, дизлайки и обратную связь rotor, а также realtime
> («сейчас играет») через Ynison.

Каждый эндпоинт прогнан на живом API Яндекс Музыки с реальным токеном. Те
немногие эндпоинты, которые сервер больше не отдаёт обычному аккаунту (например,
устаревшее создание очереди, rotor feedback), кидают типизированную ошибку, а не
падают молча.

## Установка

```bash
npm install @dvxch/yandex-music
```

## Быстрый старт

```ts
import { Client } from '@dvxch/yandex-music';

// Создаём с OAuth-токеном и один раз вызываем init() для загрузки данных аккаунта.
const client = await new Client({ token: process.env.YM_TOKEN }).init();

// Получаем трек по id.
const [track] = await client.tracks(2);
console.log(track?.title, '—', track?.artists?.[0]?.name);

// Получаем прямую ссылку и скачиваем.
const [info] = await track!.getDownloadInfo();
await info.download('track.mp3');

// Текст песни (TEXT или LRC).
const lyrics = await client.tracksLyrics(2, 'LRC');
console.log(await lyrics?.fetchLyrics());
```

## Дизайн

- **Плоский интерфейс клиента.** Методы лежат прямо на клиенте
  (`client.tracks(...)`, `client.tracksDownloadInfo(...)`), повторяя исходный API.
  Внутри клиент собирается из *миксинов* по доменам — каждая область в своём файле.
- **Модели в camelCase.** API уже возвращает ключи в camelCase, поэтому модели
  хранят их как есть — без слоя нормализации snake_case. У каждой модели есть
  статический `deJson(raw, client)`, который строит типизированный экземпляр и
  рекурсивно разбирает вложенные модели; массивы обрабатывает
  `deList(Model.deJson, raw, client)`.
- **Модели несут клиент.** Удобные методы вроде `Track.getDownloadInfo()` или
  `DownloadInfo.download()` переиспользуют клиент-владелец, так что вручную его
  прокидывать почти не нужно.
- **Типизированные ошибки.** Любая ошибка наследует `YandexMusicError`; сетевые
  дополнительно наследуют `NetworkError` (`BadRequestError`, `NotFoundError`,
  `TimedOutError`, `UnauthorizedError`).

## Конфигурация

Всё, чем клиент представляется API, задаётся через конструктор:

```ts
const client = new Client({
  token: process.env.YM_TOKEN,
  userAgent: 'my-app/1.0',                         // по умолчанию — UA библиотеки
  headers: { 'X-Yandex-Music-Client': 'custom' },  // мержатся с дефолтными
  device: 'os=Linux; model=my-app; ...',           // device-дескриптор для очередей
  language: 'en',                                   // язык ответов
  fetch: myFetch,                                   // свой транспорт (напр. node-wreq)
});
```

`userAgent` и `headers` влияют только на автоматически создаваемый транспорт —
если передаёшь свой `request`, задавай их прямо в нём. Идентичность устройства
для realtime настраивается отдельно через `client.realtime({ deviceInfo })`.

## Реализованные эндпоинты

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

## Realtime («сейчас играет»)

У Яндекс Музыки нет HTTP-вебхуков; единственный канал server-push — **Ynison**
(WebSocket-протокол синхронизации воспроизведения между устройствами).
`client.realtime()` оборачивает его в типизированный `EventEmitter`, который сам
делает рукопожатие, keep-alive и переподключение. Нужен опциональный пакет `ws`
(`npm install ws`); остальная библиотека рантайм-зависимостей не имеет.

```ts
const rt = client.realtime();
rt.on('trackChange', ({ track }) => console.log('сейчас играет:', track?.title));
rt.on('playStateChange', (paused) => console.log(paused ? 'пауза' : 'играет'));
await rt.start();   // резолвится, когда вы вызовете rt.stop()
```

Для боевого «наблюдателя» удобнее **синхронный снимок** вместо ожидания
следующего события — например, чтобы ответить на HTTP-запрос прямо сейчас:

```ts
const rt = client.realtime({
  staleTimeoutMs: 120_000,   // форс-реконнект, если фреймы замолчали (broken pipe без RST)
});
rt.start();                  // не await — крутится до rt.stop()

const np = rt.nowPlaying;    // null до первого фрейма / когда ничего не играет
if (np?.track) {
  console.log(np.track.title, np.paused ? '⏸' : '▶',
    `${Math.round(np.progressMs / 1000)}/${Math.round(np.durationMs / 1000)}s`); // progressMs интерполируется «на сейчас»
}
```

`deviceId` по умолчанию генерится один раз и переиспользуется на всех
реконнектах — **не меняйте его на каждое переподключение**: Ynison дедуплицирует
рассылку по устройству, и наблюдатель с новым id выпадает из broadcast, а
состояние молча застывает. Геттеры `state` / `lastStateAgeMs` / `liveProgressMs()`
дают остальной снимок для `/health`.

## Примеры

В каталоге [`examples/`](./examples) лежат запускаемые примеры:

- `01-quickstart.ts` — трек, прямая ссылка, текст песни;
- `02-search.ts` — поиск и подсказки;
- `03-device-auth.ts` — вход через device-flow;
- `04-realtime.ts` — отслеживание «сейчас играет» через Ynison;
- `05-likes-library.ts` — библиотека, лайк/анлайк;
- `06-playlists.ts` — жизненный цикл плейлиста (создать → изменить → удалить);
- `07-radio.ts` — «Моя волна», батчи треков, обратная связь;
- `08-charts-and-new.ts` — чарт, новинки, жанры;
- `09-lyrics.ts` — синхронизированный (LRC) текст;
- `10-download-quality.ts` — выбор качества/кодека, включая lossless (FLAC);
- `11-artist.ts` — об артисте: краткая инфо, треки, дискография, похожие.

## Разработка

```bash
npm run typecheck   # проверка типов src + тестов
npm test            # запуск тестов (node:test)
npm run build       # сборка dist/ (ESM + .d.ts)
npm run docs        # генерация API-документации (TypeDoc) в docs/api
```

## Благодарности

Спасибо [MarshalX](https://github.com/MarshalX) за библиотеку
[yandex-music](https://github.com/MarshalX/yandex-music-api) — бесценный
ориентир по API Яндекс Музыки.

## Лицензия

[MIT](./LICENSE) © dvxch
