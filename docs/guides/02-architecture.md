---
title: Архитектура и конфигурация
group: Документация
---

# Архитектура и конфигурация

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
  `TimedOutError`, `UnauthorizedError`, `TooManyRequestsError`, `ServerError`). Поля
  ошибки: `status`, `code`, `retryAfterMs`.
- **Баррели экспорта.** Публичная поверхность собирается в `src/index.ts` из
  файлов `src/exports/*.ts` (по одному на область: `track`, `rotor`, `ynison`,
  `methods-rotor` и т.д.). Новый публичный символ добавляется в соответствующий
  баррель; удалять и переименовывать экспорты нельзя (это проверяет
  `test/public-api.test.ts`).
- **Единая точка запроса.** `Request.send(method, url, { params, json, form, headers,
  retry, timeout })` — общий низкоуровневый метод: `null` в `headers` убирает заголовок,
  `retry: true` включает ретраи для идемпотентного чтения через `POST`. `get`, `post`,
  `postJson`, `put`, `delete` — тонкие обёртки над ним.
- **Модели безопасно сериализовать и логировать.** Ссылка `client` у модели и
  `client.token` неперечисляемые, `JSON.stringify(track)` отдаёт только данные, а
  `console.log(client)` маскирует токен. `Authorization` уходит только на origin
  `baseUrl`, `https://api.music.yandex.net` и `authOrigins`.

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
| `reportUnknownFields` | подсветить поля API, которые модели ещё не маппят |
| `request` | полностью преднастроенный транспорт (перекрывает `userAgent`/`headers`/`fetch`) |
| `onUnknownField` | хук вместо `console.warn`: получает `{ model, fields, raw, shapes }` |
| `retries` / `retryBaseMs` / `retryMaxMs` | ретраи GET и пакетного чтения через POST (по умолчанию 2 / 300 / 4000 мс) |
| `timeout` | таймаут запроса, мс (по умолчанию 5000) |

## Дрейф API: `reportUnknown`

Каждая модель после разбора вызывает `reportUnknown`: он сравнивает ключи ответа с
теми, которые модель реально присвоила (`assign()` их запоминает), и сообщает
остальные. Объявленные, но не присвоенные поля класса тоже считаются
немаппленными. Хук `onUnknownField` (или `reportUnknownFields: true` с выводом в
`console.warn`) получает отчёт `{ model, fields, raw, shapes }`; `shapes` описывает
только тип значения каждого ключа (например `list[{id: int, title: str}]`, глубина до 3,
строка до 500 символов), сами данные в отчёт не попадают. Ошибка в хуке не прерывает
разбор ответа.
