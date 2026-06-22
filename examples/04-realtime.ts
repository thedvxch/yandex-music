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
const rt = client.realtime();

rt.on('open', () => console.log('connected to Ynison'));
rt.on('trackChange', ({ track }) => {
  console.log('now playing:', track?.title, '—', track?.artists?.[0]?.name);
});
rt.on('playStateChange', (paused) => console.log(paused ? 'paused' : 'playing'));
rt.on('state', (state) => console.log(`position: ${Math.round(liveProgressMs(state) / 1000)}s`));
rt.on('error', (err) => console.error('realtime error:', err.message));
rt.on('reconnect', (ms) => console.log(`reconnecting in ${ms}ms`));

// Stop after 60 seconds for the sake of the example.
setTimeout(() => rt.stop(), 60_000);

await rt.start(); // resolves once stopped
console.log('stopped');
