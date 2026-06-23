---
title: Примеры и разработка
group: Документация
---

# Примеры и разработка

## Примеры

В каталоге [`examples/`](https://github.com/thedvxch/yandex-music/tree/main/examples)
лежат запускаемые примеры:

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
npm test            # запуск тестов (vitest)
npm run build       # сборка dist/ (ESM + .d.ts)
npm run docs        # генерация API-документации (TypeDoc) в docs/api
```
