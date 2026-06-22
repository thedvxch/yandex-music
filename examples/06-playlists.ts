/**
 * Full playlist lifecycle: create, rename, add and remove a track, then delete.
 *
 * The example cleans up after itself (the playlist is deleted at the end), so it
 * is safe to run against a real account.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/06-playlists.ts
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = await new Client({ token }).init();

// List the playlists you already own.
const mine = await client.usersPlaylistsList();
console.log(`You own ${mine.length} playlists.`);

// Create a fresh playlist.
const created = await client.usersPlaylistsCreate(`example-${Date.now()}`, 'private');
const kind = created!.kind!;
console.log(`Created playlist kind=${kind}.`);

// Rename it and give it a description.
await client.usersPlaylistsName(kind, 'My example playlist');
await client.usersPlaylistsDescription(kind, 'Created by the @dvxch/yandex-music example.');

// Insert a track (trackId, albumId) at position 0, then read the revision back.
const TRACK = 2;
const ALBUM = 3;
const afterInsert = await client.usersPlaylistsInsertTrack(kind, TRACK, ALBUM, 0, 1);
console.log(`Added a track; playlist now has ${afterInsert?.trackCount} track(s).`);

// Remove the track we just added (range [0, 1)).
await client.usersPlaylistsDeleteTrack(kind, 0, 1, afterInsert?.revision ?? 2);
console.log('Removed the track again.');

// Clean up.
await client.usersPlaylistsDelete(kind);
console.log('Deleted the example playlist.');
