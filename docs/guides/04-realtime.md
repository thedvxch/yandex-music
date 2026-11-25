---
title: Realtime «сейчас играет»
group: Документация
---

# Realtime «сейчас играет»

У Яндекс Музыки нет HTTP-вебхуков; единственный канал server-push — **Ynison**
(WebSocket-протокол синхронизации воспроизведения между устройствами).
`client.realtime()` оборачивает его в типизированный `EventEmitter`, который сам
делает рукопожатие, keep-alive и переподключение. Нужен опциональный пакет `ws`
(`npm install ws`); остальная библиотека рантайм-зависимостей не имеет.

## События

```ts
const rt = client.realtime();
rt.on('trackChange', ({ track }) => console.log('сейчас играет:', track?.title));
rt.on('playStateChange', (paused) => console.log(paused ? 'пауза' : 'играет'));
await rt.start();   // резолвится, когда вы вызовете rt.stop()
```

## Синхронный снимок `nowPlaying`

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

## Стабильный `deviceId` — важно

`deviceId` по умолчанию генерится один раз и переиспользуется на всех
реконнектах — **не меняйте его на каждое переподключение**: Ynison дедуплицирует
рассылку по устройству, и наблюдатель с новым id выпадает из broadcast, а
состояние молча застывает.

Геттеры `state` / `lastStateAgeMs` / `liveProgressMs()` дают остальной снимок
для `/health`.

Если два наблюдателя с одним токеном выбивают друг друга (сервер отвечает кодом
`400090001`; вживую не проверялось), задайте им разные `deviceId`. `deviceIdFromToken(token)` возвращает
детерминированный id из токена — он годится, когда нужен один стабильный
наблюдатель между перезапусками процесса.

## Команды

`RealtimeClient` и `YnisonClient` умеют управлять устройством, на котором сейчас
играет музыка:

```ts
rt.pause();
rt.resume();
rt.nextTrack();
rt.previousTrack();
rt.setVolume(0.5);              // активное устройство
rt.setVolume(0.5, targetDeviceId); // конкретное устройство
rt.sendRaw({ /* PutYnisonStateRequest */ }); // низкоуровневая отправка
```

Команды берут последнее состояние (`YnisonClient.latestState`), поэтому вызывать их
имеет смысл после первого кадра. Исключения: `YnisonNoActiveDeviceError` (нет
играющего устройства), `YnisonQueueBoundaryError` (первый/последний трек очереди),
`YnisonConnectionClosedError` (сокет закрыт). Сборщики кадров доступны отдельно:
`buildSetPausedRequest`, `buildChangeTrackRequest`, `buildSetVolumeRequest`; для
разбора состояния — `getActiveDevice`, `getPlaybackOrder`, `getNeighbourIndex`,
`getCurrentProgressMs`. `YnisonState` дополнен полями `devices`, `activeDeviceId`,
`shuffleIndices` и `raw`. Команды реализованы по референсной библиотеке и **не
проверялись на реальном плеере**. Пример — `examples/14-ynison-remote.ts`.

## Ошибки и переподключение

Типизированные ошибки: `YnisonServerError` (кадр ошибки от сервера, разбирается
`parseServerError`), `YnisonUnauthorizedError`, `YnisonDeviceDisplacedError`,
`YnisonTimeoutError`, `YnisonConnectionClosedError`. Получить их можно через событие
`error` у `RealtimeClient` или `YnisonClient.onError(listener)`.

- **Терминальные** ошибки (`YnisonUnauthorizedError`, `YnisonDeviceDisplacedError`)
  останавливают переподключение. Причину остановки можно прочитать из геттера
  `RealtimeClient.terminalError` (`Error | null`; выставляется при остановке, сбрасывается
  в `start()`) или из первого аргумента события `close`, даже если на `error` никто не
  подписан.
- **go-away** от сервера не терминален: клиент переподключается через
  `min(retryAfterMs, goAwayMaxMs)` (`goAwayMaxMs` по умолчанию 60000).
- Некорректные кадры состояния приходят как события `error` у `RealtimeClient`; если они
  не нужны, не подписывайтесь на `error` (без слушателя ошибка не выбрасывается).
- Сессия, которая продержалась меньше `stableSessionMs` (по умолчанию 5000 мс), не сбрасывает
  счётчик попыток, а следующая пауза не короче 1000 мс.
- Остальные ретраятся по расписанию `[0, 1000, 5000, 30000]` мс + jitter до
  `reconnectMaxMs`; `ynison-backoff-millis` от сервера заменяет расписание.
  `reconnectBaseMs` — лишь минимальная пауза и по умолчанию не задан, так что первая
  повторная попытка немедленная. `stop()` отменяет отложенное переподключение.
- Опция `ynison: { redirectUrl, stateUrl, connectTimeoutMs }` у `client.realtime()`
  переопределяет адреса и таймаут подключения (`connectTimeoutMs` по умолчанию 10000).

