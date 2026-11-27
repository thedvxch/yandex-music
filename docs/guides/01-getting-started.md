---
title: Начало работы
group: Документация
---

# Начало работы

## Установка

```bash
npm install @dvxch/yandex-music
```

Для realtime («сейчас играет») дополнительно нужен опциональный пакет `ws`:

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

## init() — когда обязателен

`new Client({ token })` дёшев. `await client.init()` один раз подгружает данные
аккаунта, чтобы методы, подставляющие user id по умолчанию (`usersLikes*`,
`usersPlaylists*`, `pins`, `presaves`), работали без явного `userId`.
Каталожные read-only запросы (`tracks`, `albums`, `search`, …) работают и без `init()`.

## Токен, таймаут и прокси

- **Токен.** `client.token` — сеттер: `client.token = 'новый'` сразу обновляет заголовок
  `Authorization`, `client.token = undefined` его убирает (для нижнего уровня есть
  `client.request.setAuthorization(token)` и `clearAuthorization()`).
- **Таймаут.** Опция `timeout` (мс, по умолчанию 5000) задаёт таймаут запроса. Для
  одного запроса его можно переопределить: `client.request.send(method, url, { timeout })`.
  Ретраи настраиваются `retries`, `retryBaseMs`, `retryMaxMs`.
- **Прокси.** Встроенной поддержки прокси нет: передайте `fetch`, который ходит через
  прокси (`fetch: myProxyFetch`). Опция `proxyUrl` на транспорте объявлена устаревшей —
  она никогда не применялась.

## Обработка ошибок

Любая ошибка наследует `YandexMusicError`; сетевые дополнительно наследуют
`NetworkError`. Ловите по классу, а не по строке.

```ts
import { NotFoundError, UnauthorizedError, NetworkError } from '@dvxch/yandex-music';

try {
  await client.tracks(2);
} catch (e) {
  if (e instanceof UnauthorizedError) { /* переавторизация */ }
  else if (e instanceof NotFoundError) { /* нет такого */ }
  else if (e instanceof NetworkError) { /* ретрай; e.cause — исходная ошибка fetch */ }
  else throw e;
}
```

У ошибок есть поля `status` (HTTP-код), `code` (машинный код из тела, например `error`
OAuth) и `retryAfterMs` (подсказка из `Retry-After`). `429` даёт
`TooManyRequestsError`, `5xx` — `ServerError` (`502` — `BadGatewayError`), `403` —
`ForbiddenError` (подкласс `UnauthorizedError`), `410` — `GoneError`, прочие `4xx` —
`ClientError`; все сетевые наследуют `NetworkError`. Повторяются только ошибки с
`error.retryable === true`. На `429`/`503` библиотека ждёт `Retry-After`, но если пауза больше
`retryMaxMs`, ошибка бросается сразу. Если у метода нужен user id, а `init()` не
вызывался, бросается `IdMissingError` — до любого запроса.
