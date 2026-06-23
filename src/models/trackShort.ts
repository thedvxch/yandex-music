/**
 * Lightweight track references: {@link TrackShort} and {@link TrackId}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import { Track } from './track/track.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/**
 * A compact reference to a track inside a playlist.
 *
 * Holds the ids needed to fetch the full {@link Track}; the `track` field is only
 * populated by endpoints that inline the full object.
 */
export class TrackShort extends YandexMusicModel {
  /** Track id. */
  id?: string | number;
  /** Timestamp the track was added at. */
  timestamp?: string;
  /** Album id the track is referenced from. */
  albumId?: string;
  /** Play counter. */
  playCount?: number;
  /** Whether recently added. */
  recent?: boolean;
  /** Chart placement (raw JSON, pending a typed model). */
  chart?: JSONValue;
  /** The full track, when inlined by the endpoint. */
  track?: Track;
  /** Original index within the source list. */
  originalIndex?: number;
  /** Original index within the shuffled source list. */
  originalShuffleIndex?: number;

  /** @see {@link TrackShort} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackShort | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackShort(client);
    assign(model, raw, [
      'id',
      'timestamp',
      'albumId',
      'playCount',
      'recent',
      'chart',
      'originalIndex',
      'originalShuffleIndex',
    ]);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    reportUnknown(client, 'TrackShort', raw, model);
    return model;
  }
}

/** A bare track/album id pair, used by landing blocks and playlists. */
export class TrackId extends YandexMusicModel {
  /** Id of the reference. */
  id?: number;
  /** Track id. */
  trackId?: number;
  /** Album id. */
  albumId?: number;
  /** Origin context tag. */
  from?: string;

  /** @see {@link TrackId} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackId | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackId(client);
    assign(model, raw, ['id', 'trackId', 'albumId', 'from']);
    reportUnknown(client, 'TrackId', raw, model);
    return model;
  }
}
