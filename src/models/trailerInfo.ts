/**
 * The {@link TrailerInfo} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../base.js';
import { Track } from './track/track.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A trailer: a titled selection of tracks. */
export class TrailerInfo extends YandexMusicModel {
  /** Trailer title. */
  title?: string;
  /** Trailer tracks. */
  tracks?: Track[];

  /** @see {@link TrailerInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrailerInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrailerInfo(client);
    assign(model, raw, ['title']);
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    return model;
  }
}
