/**
 * Download a track through `tracksFileInfo`: ask for lossless, fall back to
 * high-quality, and save the file.
 *
 * The default transport is `raw` (a plain stream); `tracksLosslessInfo` uses
 * `encraw` and the returned info decrypts it for you.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/15-file-info.ts [trackId]
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const trackId = Number(process.argv[2] ?? 2);
const client = await new Client({ token }).init();

let info = (await client.tracksFileInfo(trackId, { quality: 'lossless' }))?.downloadInfo;
if (!info) {
  info = (await client.tracksFileInfo(trackId, { quality: 'hq' }))?.downloadInfo;
}
if (!info) {
  console.log('No downloadable variant.');
  process.exit(0);
}

console.log(`quality=${info.quality} codec=${info.codec} bitrate=${info.bitrate} encrypted=${info.isEncrypted}`);
const filename = `track-${trackId}.${info.isLossless ? 'flac' : 'm4a'}`;
// `download` streams to disk and decrypts on the fly when the stream is encrypted.
await info.download(filename);
console.log(`Saved ${filename}.`);
