/**
 * Quick start: authenticate with an OAuth token, fetch a track and download it.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/01-quickstart.ts
 *
 * In your own project, import from the package instead of the source:
 *   import { Client } from '@dvxch/yandex-music';
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

// `init()` loads account info once so later calls can default the user id.
const client = await new Client({ token }).init();

// Fetch a track by id (accepts `trackId` or `trackId:albumId`).
const [track] = await client.tracks(2);
console.log(`${track?.title} — ${track?.artists?.[0]?.name}`);

// Resolve a direct link for the best available bitrate and save it.
const variants = await track!.getDownloadInfo();
const best = variants.sort((a, b) => (b.bitrateInKbps ?? 0) - (a.bitrateInKbps ?? 0))[0];
await best?.download('track.mp3');
console.log(`Saved track.mp3 (${best?.bitrateInKbps} kbps)`);

// Lyrics, when available (TEXT or synced LRC).
const lyrics = await client.tracksLyrics(2, 'LRC');
if (lyrics) {
  console.log(await lyrics.fetchLyrics());
}
