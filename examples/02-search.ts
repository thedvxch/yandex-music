/**
 * Search across the catalog and read the typed result blocks.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/02-search.ts "daft punk"
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const query = process.argv[2] ?? 'daft punk';
const client = new Client({ token });

const result = await client.search(query);
if (!result) {
  console.log('Nothing found.');
  process.exit(0);
}

// The "best" match is a single typed entity (Track | Artist | Album | …).
console.log('Best match:', result.best?.type, '→', JSON.stringify(result.best?.result).slice(0, 80));

// Each block is paginated and strongly typed.
for (const track of result.tracks?.results?.slice(0, 5) ?? []) {
  console.log(`  track: ${track.title} — ${track.artists?.[0]?.name}`);
}
for (const artist of result.artists?.results?.slice(0, 3) ?? []) {
  console.log(`  artist: ${artist.name}`);
}

// Typo correction lives in a dedicated, cheaper endpoint.
const suggestion = await client.searchSuggest(query);
console.log('Did you mean:', suggestion?.best?.text ?? '(no suggestion)');
