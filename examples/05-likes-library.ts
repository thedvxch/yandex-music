/**
 * Browse and edit your library: liked tracks/artists/albums, likes and dislikes.
 *
 * Mutations here are reversible — the example likes a track and immediately
 * removes the like, so it leaves your library as it found it.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/05-likes-library.ts
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = await new Client({ token }).init();

// Read the library. `usersLikesTracks` returns a TracksList of references;
// fetch the full tracks in one batched call.
const liked = await client.usersLikesTracks();
const refs = (liked?.tracks ?? []).slice(0, 5).map((t) => t.id).filter((id): id is string | number => id != null);
console.log(`You like ${liked?.tracks?.length ?? 0} tracks. First few:`);
const tracks = refs.length ? await client.tracks(refs) : [];
for (const t of tracks) {
  console.log(`  ${t.title} — ${t.artists?.[0]?.name}`);
}

// Liked artists and albums come back as `Like` wrappers around the entity.
const artists = await client.usersLikesArtists();
console.log(`Liked artists: ${artists.length}`, artists[0]?.artist?.name ? `(e.g. ${artists[0].artist.name})` : '');
const albums = await client.usersLikesAlbums();
console.log(`Liked albums: ${albums.length}`);

// Like → unlike round-trip on a single track id.
const TRACK = 2;
await client.usersLikesTracksAdd(TRACK);
console.log(`Liked track ${TRACK}.`);
await client.usersLikesTracksRemove(TRACK);
console.log(`Removed the like again.`);
