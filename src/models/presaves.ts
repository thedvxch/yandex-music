/**
 * The {@link Presaves} model: a user's pre-saved albums.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, deList, isJsonObject } from '../base.js';
import { Album } from './album/album.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A user's pre-saved albums, split into upcoming and already-released. */
export class Presaves extends YandexMusicModel {
  /** Albums not yet released. */
  upcomingAlbums?: Album[];
  /** Albums that have since been released. */
  releasedAlbums?: Album[];

  /** @see {@link Presaves} */
  static deJson(raw: JSONValue | undefined, client?: Client): Presaves | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Presaves(client);
    model.upcomingAlbums = deList(Album.deJson, raw['upcomingAlbums'], client);
    model.releasedAlbums = deList(Album.deJson, raw['releasedAlbums'], client);
    return model;
  }
}
