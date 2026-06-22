/**
 * Explore an artist: brief info, popular tracks, discography and similar artists.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/11-artist.ts [artistId]
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const artistId = Number(process.argv[2] ?? 36825); // 36825 = Radiohead
const client = await new Client({ token }).init();

// One call returns the artist plus aggregated counts and highlights.
const brief = await client.artistsBriefInfo(artistId);
const artist = brief?.artist;
console.log(`${artist?.name} — ${artist?.counts?.tracks ?? 0} tracks, ${artist?.counts?.directAlbums ?? 0} albums`);

// Popular tracks (paginated).
const popular = await client.artistsTracks(artistId, 0, 5);
console.log('\nPopular tracks:');
for (const t of popular?.tracks?.slice(0, 5) ?? []) {
  console.log(`  ${t.title}`);
}

// Discography (the artist's own albums).
const albums = await client.artistsDirectAlbums(artistId, 0, 5);
console.log('\nAlbums:');
for (const a of albums?.albums?.slice(0, 5) ?? []) {
  console.log(`  ${a.year ?? '????'} — ${a.title}`);
}

// Similar artists.
const similar = await client.artistsSimilar(artistId);
console.log('\nSimilar:', similar?.similarArtists?.slice(0, 5).map((a) => a.name).join(', '));
