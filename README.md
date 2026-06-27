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
