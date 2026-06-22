/**
 * Personal radio ("My Wave"): list stations, pull a batch of tracks for a
 * station and inspect the recommendation settings.
 *
 * Run with:
 *   YM_TOKEN=... npx tsx examples/07-radio.ts
 */
import { Client } from '../src/index.js';

const token = process.env.YM_TOKEN;
if (!token) {
  throw new Error('Set YM_TOKEN to an OAuth token.');
}

const client = await new Client({ token }).init();

// The dashboard groups the stations recommended to you.
const dashboard = await client.rotorStationsDashboard();
console.log(`Dashboard has ${dashboard?.stations?.length ?? 0} stations.`);

// "My Wave" is the personal infinite station.
const STATION = 'user:onyourwave';
const info = await client.rotorStationInfo(STATION);
console.log('Station:', info?.[0]?.station?.name ?? STATION);

// Pull the next batch of tracks the station wants to play.
const sequence = await client.rotorStationTracks(STATION);
console.log(`Next ${sequence?.sequence?.length ?? 0} tracks:`);
for (const item of sequence?.sequence?.slice(0, 5) ?? []) {
  console.log(`  ${item.track?.title} — ${item.track?.artists?.[0]?.name}`);
}

// Report "track started" so the station keeps the stream personalized.
const first = sequence?.sequence?.[0]?.track?.id;
if (first !== undefined && sequence?.batchId) {
  try {
    await client.rotorStationFeedbackTrackStarted(STATION, first, sequence.batchId);
    console.log('Sent trackStarted feedback.');
  } catch (e) {
    // Some endpoints are gated server-side for certain accounts; the error is typed.
    console.log('Feedback rejected by the server:', (e as Error).constructor.name);
  }
}
