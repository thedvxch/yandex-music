/**
 * A page of an artist's tracks.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Track } from '../track/track.js';
import { Pager } from '../pager.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A single page of tracks belonging to an artist. */
export class ArtistTracks extends YandexMusicModel {
  /** The tracks on this page. */
  tracks?: Track[];
  /** Pagination metadata. */
  pager?: Pager;

  /** @see {@link ArtistTracks} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistTracks | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistTracks(client);
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    reportUnknown(client, 'ArtistTracks', raw, model);
    return model;
  }
}
