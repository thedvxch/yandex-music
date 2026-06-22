/**
 * Fetch time-synced lyrics (LRC) for a track and print the first lines with
 * their timestamps. Falls back to plain text when no synced lyrics exist.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/09-lyrics.ts [trackId]
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const trackId = Number(process.argv[2] ?? 2);
const client = await new Client({ token }).init();

const [track] = await client.tracks(trackId);
console.log(`Lyrics for: ${track?.title} — ${track?.artists?.[0]?.name}\n`);

// Ask for synced (LRC) lyrics; the result exposes both metadata and a fetcher
// for the actual text (the API serves the body from a signed URL).
const lyrics = await client.tracksLyrics(trackId, 'LRC');
if (!lyrics) {
  console.log('No lyrics available for this track.');
  process.exit(0);
}

console.log(`major: ${lyrics.major?.prettyName ?? 'unknown source'}`);
const text = await lyrics.fetchLyrics();
console.log(text?.split('\n').slice(0, 8).join('\n'));
