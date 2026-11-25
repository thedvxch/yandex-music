/**
 * Control another device through Ynison: observe the player, then pause,
 * resume and skip to the next track with `RealtimeClient` commands.
 *
 * Commands act on the device that is currently playing; with no active device
 * they throw `YnisonNoActiveDeviceError`. Requires the optional `ws` package
 * (`npm install ws`).
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/14-ynison-remote.ts
 */
import {
  Client,
  YnisonDeviceDisplacedError,
  YnisonNoActiveDeviceError,
  YnisonUnauthorizedError,
} from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = new Client({ token });
const rt = client.realtime();

rt.on('trackChange', ({ track }) => console.log('now playing:', track?.title));
rt.on('playStateChange', (paused) => console.log(paused ? 'paused' : 'playing'));
rt.on('error', (err) => {
  // Terminal errors stop reconnecting; everything else is retried by the client.
  if (err instanceof YnisonUnauthorizedError || err instanceof YnisonDeviceDisplacedError) {
    console.error('terminal:', err.message);
    rt.stop();
  } else {
    console.error('realtime error:', err.message);
  }
});

rt.start(); // not awaited: it runs until rt.stop()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(3000); // wait for the first state frame

try {
  rt.pause();
  await sleep(2000);
  rt.resume();
  await sleep(2000);
  rt.nextTrack();
} catch (error) {
  if (error instanceof YnisonNoActiveDeviceError) {
    console.log('No device is playing right now — start playback somewhere first.');
  } else {
    throw error;
  }
}

await sleep(3000);
rt.stop();
