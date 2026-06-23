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
