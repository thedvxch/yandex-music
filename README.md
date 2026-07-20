<p align="center">
  <img src="assets/hero.png" alt="@dvxch/yandex-music — типизированный TypeScript-клиент API Яндекс Музыки" width="100%">
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
  <a href="https://gh.dvxch.link/yandex-music/"><b>📖 Документация</b></a> ·
  <a href="./README.en.md">🇬🇧 In English</a> ·
  <a href="https://www.npmjs.com/package/@dvxch/yandex-music">npm</a>
</p>

Типизированный асинхронный **TypeScript-клиент для API Яндекс Музыки**.

`@dvxch/yandex-music` — независимая реализация HTTP API Яндекс Музыки на
TypeScript. Ориентирован на современный Node.js (≥ 20), поставляется как ESM с
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

### Оглавление

- [Возможности](#возможности)
- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Архитектура](#архитектура)
- [Конфигурация](#конфигурация)
- [Обработка ошибок](#обработка-ошибок)
- [Реализованные эндпоинты](#реализованные-эндпоинты)
- [Realtime](#realtime)
- [Примеры](#примеры)
- [Документация](#документация)
- [Благодарности](#благодарности)
- [Лицензия](#лицензия)

## Возможности

- **Ноль рантайм-зависимостей.** На встроенном `fetch`; только ESM, Node ≥ 20.
- **Полная типизация.** У каждого эндпоинта и модели — ручные типы и статический `deJson`, без `any` в публичном API.
- **Полное покрытие API.** ~145 методов по всем доменам, держим паритет с актуальным API.
- **Надёжный транспорт.** Автоматические ретраи с экспоненциальным backoff + jitter на транзиентных сбоях (только идемпотентные запросы); типизированные ошибки; пер-вызов таймауты.
- **Стриминговое скачивание.** `download()` льёт сразу на диск (константная память), на лету расшифровывая lossless (`encraw`/FLAC), с опциональной **гонкой CDN-зеркал** и watchdog'ом зависшего стрима.
- **Realtime «сейчас играет»** через Ynison — переподключающийся `EventEmitter` + синхронный снимок `nowPlaying`.
- **Детект дрейфа.** Опциональный хук `onUnknownField` репортит любое поле API, которое модели ещё не мапят, — изменения сервера ловятся, а не теряются.
- **Подключаемый `fetch`.** Свой транспорт (прокси, TLS-имперсонация, тюнинг пула соединений).

## Установка

```bash
npm install @dvxch/yandex-music
```

Требования: Node.js ≥ 20. Для realtime («сейчас играет») дополнительно нужен
опциональный пакет `ws`:

```bash
npm install ws
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

`new Client({ token })` дёшев. `await client.init()` один раз подгружает данные
аккаунта, чтобы методы, подставляющие user id по умолчанию (`usersLikes*`,
`usersPlaylists*`, `pins`, `presaves`), работали без явного `userId`. Каталожные
read-only запросы (`tracks`, `albums`, `search`, …) работают и без `init()`.

## Архитектура

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
- **Никогда не `JSON.stringify` модель** — она держит обратную ссылку на клиент
  (циклическая структура). Читайте поля напрямую.

## Конфигурация

Всё, чем клиент представляется API, задаётся через конструктор:

```ts
const client = new Client({
  token: process.env.YM_TOKEN,
  userAgent: 'my-app/1.0',                         // по умолчанию — UA библиотеки
  headers: { 'X-Yandex-Music-Client': 'custom' },  // мержатся с дефолтными
  device: 'os=Linux; model=my-app; ...',           // device-дескриптор для очередей
  language: 'en',                                   // язык ответов: en/uz/uk/us/ru/kk/hy
  fetch: myFetch,                                   // свой транспорт (напр. node-wreq)
  retries: 2,                                        // ретраи транзиентных GET-сбоев (0 — выкл.)
  onUnknownField: ({ model, fields }) =>            // хук дрейфа: немаппленные поля API
    console.warn(`${model}: unmapped ${fields.join(', ')}`),
});
```

`userAgent` и `headers` влияют только на автоматически создаваемый транспорт —
если передаёшь свой `request`, задавай их прямо в нём. Идентичность устройства
для realtime настраивается отдельно через `client.realtime({ deviceInfo })`.

### Все опции `ClientOptions`

| Опция | Назначение |
| ----- | ---------- |
| `token` | OAuth-токен |
| `baseUrl` | переопределить origin API |
| `language` | язык ответов: `en`/`uz`/`uk`/`us`/`ru`/`kk`/`hy` (по умолчанию `ru`) |
| `userAgent` | переопределить User-Agent |
| `headers` | доп. заголовки, мержатся с дефолтными |
| `device` | device-дескриптор для запросов очереди |
| `fetch` | свой `fetch` (прокси, моки, ретраи) |
| `retries` | ретраи транзиентных сбоев для GET (по умолчанию 2, 0 — выкл.) |
| `reportUnknownFields` | подсветить поля API, которые модели ещё не маппят |
| `onUnknownField` | хук вместо `console.warn` для того же дрейфа |
| `request` | полностью преднастроенный транспорт (перекрывает `userAgent`/`headers`/`fetch`) |

## Обработка ошибок

Каждая ошибка библиотеки наследует `YandexMusicError` — одного `catch`
достаточно, чтобы перехватить всё. Сетевые и транспортные сбои дополнительно
наследуют `NetworkError`:

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
    // токен отсутствует или истёк — переавторизуйтесь
  } else if (error instanceof NotFoundError) {
    // у трека нет текста
  } else if (error instanceof TimedOutError) {
    // запрос завис — можно повторить
  } else if (error instanceof YandexMusicError) {
    // любая другая ошибка библиотеки
  } else {
    throw error; // не наша ошибка
  }
}
```

`GET`-запросы автоматически повторяются при транзиентных сбоях (экспоненциальный
backoff + jitter, `retries` попыток сверху, по умолчанию 2). Мутирующие запросы
(`POST`/`PUT`/`DELETE`) никогда не повторяются автоматически — это защищает от
двойных сайд-эффектов (например, двойного лайка).

## Реализованные эндпоинты

| Домен       | Методы |
| ----------- | ------- |
| account     | `init`, `accountStatus`, `accountSettings`, `accountSettingsSet`, `settings`, `permissionAlerts`, `accountExperiments`, `accountExperimentsDetails`, `consumePromoCode` |
| tracks      | `tracks`, `tracksDownloadInfo`, `tracksLosslessInfo`, `tracksLyrics`, `tracksSimilar`, `tracksFullInfo`, `tracksTrailer`, `trackSupplement`, `playAudio`, `afterTrack` |
| albums      | `albums`, `albumsWithTracks`, `albumsSimilarEntities`, `albumsTrailer` |
| artists     | `artists`, `artistsBriefInfo`, `artistsInfo`, `artistsAbout`, `artistsClips`, `artistsDonation`, `artistsSkeleton`, `artistsTracks`, `artistsTrackIds`, `artistsDirectAlbums`, `artistsAlsoAlbums`, `artistsDiscographyAlbums`, `artistsSafeDirectAlbums`, `artistsSimilar`, `artistsLinks`, `artistsTrailer` |
| search      | `search`, `searchSuggest` |
| likes       | `usersLikesTracks`/`Albums`/`Artists`/`Playlists`/`Clips` + add/remove для каждого; `usersDislikesTracks`/`Artists` + add/remove |
| playlists   | `playlist`, `playlists`, `playlistsList`, `playlistsPersonal`, `usersPlaylists`, `usersPlaylistsList`, `usersPlaylistsKinds`, `usersPlaylistsCreate`, `usersPlaylistsDelete`, `usersPlaylistsName`, `usersPlaylistsVisibility`, `usersPlaylistsDescription`, `usersPlaylistsChange`, `usersPlaylistsInsertTrack`, `usersPlaylistsDeleteTrack`, `usersPlaylistsRecommendations`, `usersPlaylistsTrailer`, `usersSettings`, `playlistSimilarEntities`, `playlistsCollectiveJoin` |
| device auth | `requestDeviceCode`, `pollDeviceToken`, `deviceAuth` (блокирующий flow), `refreshAccessToken` (обновление по refresh-токену) |
| landing     | `landing`, `feed`, `feedWizardIsPassed`, `tags`, `chart`, `newReleases`, `newPlaylists`, `podcasts`, `genres` |
| radio       | `rotorStationsDashboard`, `rotorStationsList`, `rotorStationInfo`, `rotorStationTracks`, `rotorAccountStatus`, `rotorStationFeedback` (+ шорткаты `rotorStationFeedbackRadioStarted`/`TrackStarted`/`TrackFinished`/`Skip`), `rotorStationSettings2` |
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

### Скачивание и качество

Для lossy-вариантов используйте `tracksDownloadInfo` / `track.getDownloadInfo()`
и выбирайте по битрейту:

```ts
const variants = await track!.getDownloadInfo();          // DownloadInfo[]
const best = [...variants].sort((a, b) => (b.bitrateInKbps ?? 0) - (a.bitrateInKbps ?? 0))[0];
await best!.download('track.mp3');
```

Для lossless (FLAC) — отдельный путь через `tracksLosslessInfo` /
`track.getLosslessInfo(quality)` (`LosslessDownloadInfo`, AES-CTR-расшифровка на
лету), описанный в типах пакета.

## Realtime

У Яндекс Музыки нет HTTP-вебхуков; единственный канал server-push — **Ynison**
(WebSocket-протокол синхронизации воспроизведения между устройствами).
`client.realtime()` оборачивает его в типизированный `EventEmitter`, который сам
делает рукопожатие, keep-alive и переподключение. Нужен опциональный пакет `ws`
(`npm install ws`); остальная библиотека рантайм-зависимостей не имеет.

```ts
const rt = client.realtime();
rt.on('trackChange', ({ track }) => console.log('сейчас играет:', track?.title));
rt.on('playStateChange', (paused) => console.log(paused ? 'пауза' : 'играет'));
await rt.start(); // резолвится, когда вы вызовете rt.stop()
```

Для боевого «наблюдателя» удобнее **синхронный снимок**, чем ожидание
следующего события — например, чтобы ответить на HTTP-запрос прямо сейчас:

```ts
const rt = client.realtime({
  staleTimeoutMs: 120_000, // форс-реконнект, если фреймы замолчали (broken pipe без RST)
});
rt.start(); // не await — крутится до rt.stop()

const np = rt.nowPlaying; // null до первого фрейма / когда ничего не играет
if (np?.track) {
  console.log(np.track.title, np.paused ? '⏸' : '▶',
    `${Math.round(np.progressMs / 1000)}/${Math.round(np.durationMs / 1000)}с`); // progressMs экстраполируется живьём
}
```

`deviceId` по умолчанию генерируется один раз и переиспользуется между
переподключениями — **не меняйте его на каждый реконнект**: Ynison дедуплицирует
рассылку по устройству, и новый id выкидывает вашего наблюдателя из fan-out,
после чего состояние молча замирает. Геттеры `state` / `lastStateAgeMs` /
`liveProgressMs()` дают остальную часть снимка для `/health`.

## Примеры

Запускаемые примеры лежат в [`examples/`](./examples):

- `01-quickstart.ts` — трек, прямая ссылка и текст песни;
- `02-search.ts` — поиск и саджесты;
- `03-device-auth.ts` — получение токена через device flow;
- `04-realtime.ts` — слежение за «сейчас играет» через Ynison;
- `05-likes-library.ts` — просмотр библиотеки, цикл лайк/анлайк;
- `06-playlists.ts` — полный жизненный цикл плейлиста (создать → изменить → удалить);
- `07-radio.ts` — станции «Моей волны», пакеты треков, обратная связь;
- `08-charts-and-new.ts` — чарт, новинки, жанры;
- `09-lyrics.ts` — синхронизированный по времени (LRC) текст песни;
- `10-download-quality.ts` — выбор качества/кодека, включая lossless (FLAC);
- `11-artist.ts` — краткая информация об артисте, треки, дискография, похожие;
- `12-custom-fetch.ts` — инъекция кастомного `fetch` (например, `node-wreq` для TLS-имперсонации).

Подробности и команды запуска — в [`examples/README.md`](./examples/README.md).

## Документация

Полный справочник — на [сайте документации](https://gh.dvxch.link/yandex-music/),
разбитый по разделам:

- **[Начало работы](docs/guides/01-getting-started.md)** — установка, быстрый старт, `init()`, ошибки.
- **[Архитектура и конфигурация](docs/guides/02-architecture.md)** — устройство клиента, все опции `ClientOptions`.
- **[Реализованные эндпоинты](docs/guides/03-endpoints.md)** — полный каталог методов по доменам, скачивание и качество.
- **[Realtime «сейчас играет»](docs/guides/04-realtime.md)** — Ynison: события, снимок `nowPlaying`, стабильный `deviceId`.
- **[Примеры и разработка](docs/guides/05-examples.md)** — запускаемые примеры и команды сборки.

Плюс автогенерируемый **[API-reference](https://gh.dvxch.link/yandex-music/)** по
всем классам, методам и моделям (TypeDoc).

## Благодарности

Спасибо [MarshalX](https://github.com/MarshalX) за библиотеку
[yandex-music](https://github.com/MarshalX/yandex-music-api) — бесценный
ориентир по API Яндекс Музыки.

## Лицензия

[MIT](./LICENSE) © dvxch
