/**
 * A "My Wave" session loop: start a session, pull a batch of tracks and report
 * feedback for each one (started -> finished or skipped).
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/13-wave-session.ts
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = await new Client({ token }).init();

// POST /rotor/session/new with the seeds in the JSON body.
const session = await client.rotorSessionNew('user:onyourwave', { includeTracksInResponse: false });
const sessionId = session?.radioSessionId;
if (!sessionId) {
  throw new Error('The server did not return a session id.');
}
console.log(`Session: ${sessionId}`);

const played: string[] = [];
let batchId: string | undefined;

for (let round = 0; round < 2; round++) {
  // Report what was already played so the next batch does not repeat it.
  const batch = await client.rotorSessionTracks(sessionId, { queue: played });
  batchId = batch?.batchId ?? batchId;
  const items = batch?.sequence ?? [];
  console.log(`Batch ${batchId}: ${items.length} tracks`);

  for (const item of items.slice(0, 2)) {
    const track = item.track;
    if (!track?.id) continue;
    console.log(`  ${track.title} — ${track.artists?.[0]?.name}`);

    await client.rotorSessionFeedbackTrackStarted(sessionId, track.id, batchId);
    // Pretend we listened for 30 seconds, then moved on.
    await client.rotorSessionFeedbackSkip(sessionId, track.id, 30, batchId);
    played.push(String(track.id));
  }
}
