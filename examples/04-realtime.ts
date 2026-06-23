/**
 * Realtime "now playing" over Ynison: subscribe to track and play-state changes.
 *
 * Yandex Music has no HTTP webhooks — this WebSocket stream is the only
 * server-push channel. Requires the optional `ws` package (`npm install ws`).
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/04-realtime.ts
 */
import { Client, liveProgressMs } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = new Client({ token });
const rt = client.realtime({
  staleTimeoutMs: 120_000, // force a reconnect if frames go quiet (silent broken pipe)
});

rt.on('open', () => console.log('connected to Ynison'));
rt.on('trackChange', ({ track }) => {
  console.log('now playing:', track?.title, '—', track?.artists?.[0]?.name);
});
rt.on('playStateChange', (paused) => console.log(paused ? 'paused' : 'playing'));
rt.on('state', (state) => console.log(`position: ${Math.round(liveProgressMs(state) / 1000)}s`));
rt.on('stale', (idleMs) => console.log(`no frames for ${Math.round(idleMs / 1000)}s — reconnecting`));
rt.on('error', (err) => console.error('realtime error:', err.message));
rt.on('reconnect', (ms) => console.log(`reconnecting in ${ms}ms`));

console.log(`device id: ${rt.deviceIdValue}`); // stable across reconnects
rt.start(); // don't await — it runs until rt.stop()

// The synchronous snapshot: read what's playing at any moment, without waiting
// for the next event. Handy from an HTTP handler.
const snapshot = setInterval(() => {
  const np = rt.nowPlaying;
  if (np?.track) {
    const pos = Math.round(np.progressMs / 1000); // live-extrapolated to *now*
    const dur = Math.round(np.durationMs / 1000);
    console.log(`[snapshot] ${np.track.title} ${np.paused ? '⏸' : '▶'} ${pos}/${dur}s`);
  }
}, 10_000);

// Stop after 60 seconds for the sake of the example.
setTimeout(() => {
  clearInterval(snapshot);
  rt.stop();
}, 60_000);
