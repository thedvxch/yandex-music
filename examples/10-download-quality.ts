/**
 * Pick a download variant by quality and codec — including lossless (FLAC) when
 * your subscription allows it — and save the file.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/10-download-quality.ts [trackId]
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const trackId = Number(process.argv[2] ?? 2);
const client = await new Client({ token }).init();

// Each variant describes a codec + bitrate; lossless variants report `codec: 'flac'`.
const variants = await client.tracksDownloadInfo(trackId);
console.log('Available variants:');
for (const v of variants) {
  console.log(`  ${v.codec} ${v.bitrateInKbps}kbps ${v.preview ? '(preview)' : ''}`);
}

// Prefer lossless; otherwise the highest available bitrate.
const lossless = variants.find((v) => v.codec === 'flac');
const best = lossless ?? [...variants].sort((a, b) => (b.bitrateInKbps ?? 0) - (a.bitrateInKbps ?? 0))[0];
if (!best) {
  console.log('No downloadable variant.');
  process.exit(0);
}

const ext = best.codec === 'flac' ? 'flac' : 'mp3';
await best.download(`track.${ext}`);
console.log(`Saved track.${ext} (${best.codec} ${best.bitrateInKbps}kbps).`);
