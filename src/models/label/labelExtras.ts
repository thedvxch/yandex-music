/**
 * Paginated album/artist listings for a record label.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, deList, isJsonObject } from '../../base.js';
import { Album } from '../album/album.js';
import { Artist } from '../artist/artist.js';
import { Pager } from '../pager.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A page of a label's albums. */
export class LabelAlbums extends YandexMusicModel {
  /** The albums on this page. */
  albums?: Album[];
  /** Pagination metadata. */
  pager?: Pager;

  /** @see {@link LabelAlbums} */
  static deJson(raw: JSONValue | undefined, client?: Client): LabelAlbums | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LabelAlbums(client);
    model.albums = deList(Album.deJson, raw['albums'], client);
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    return model;
  }
}

/** A page of a label's artists. */
export class LabelArtists extends YandexMusicModel {
  /** The artists on this page. */
  artists?: Artist[];
  /** Pagination metadata. */
  pager?: Pager;

  /** @see {@link LabelArtists} */
  static deJson(raw: JSONValue | undefined, client?: Client): LabelArtists | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LabelArtists(client);
    model.artists = deList(Artist.deJson, raw['artists'], client);
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    return model;
  }
}
