/**
 * Discover music: the chart, new releases, new playlists and the genre list.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/08-charts-and-new.ts
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = await new Client({ token }).init();

// The global chart is a playlist whose track list is already inlined.
const chart = await client.chart();
console.log('Top of the chart:');
for (const item of chart?.chart?.tracks?.slice(0, 5) ?? []) {
  console.log(`  ${item.track?.title} — ${item.track?.artists?.[0]?.name}`);
}

// New releases come back as album-id references — fetch the albums to get titles.
const releases = await client.newReleases();
const ids = releases?.newReleases?.slice(0, 5) ?? [];
const albums = ids.length ? await client.albums(ids) : [];
console.log('\nNew releases:');
for (const a of albums) {
  console.log(`  ${a.title} — ${a.artists?.[0]?.name}`);
}

// The genre tree (each genre may have sub-genres).
const genres = await client.genres();
console.log(`\n${genres.length} genres, e.g.:`, genres.slice(0, 8).map((g) => g.title).join(', '));
