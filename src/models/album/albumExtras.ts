/**
 * Album-adjacent models: {@link AlbumTrailer} and {@link AlbumSimilarEntities}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, deList, isJsonObject } from '../../base.js';
import { Artist } from '../artist/artist.js';
import { Album } from './album.js';
import { TrailerInfo } from '../trailerInfo.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** An album together with its trailer. */
export class AlbumTrailer extends YandexMusicModel {
  /** The album. */
  album?: Album;
  /** Related artists. */
  artists?: Artist[];
  /** The trailer. */
  trailer?: TrailerInfo;

  /** @see {@link AlbumTrailer} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumTrailer | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumTrailer(client);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.artists = raw['artists'] ? deList(Artist.deJson, raw['artists'], client) : undefined;
    model.trailer = TrailerInfo.deJson(raw['trailer'], client) ?? undefined;
    return model;
  }
}

/** Entities similar to an album (used for curated coloring/recommendations). */
export class AlbumSimilarEntities extends YandexMusicModel {
  /** Similar entity items (raw JSON, pending a typed `SimilarEntityItem` model). */
  items?: JSONValue[];

  /** @see {@link AlbumSimilarEntities} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumSimilarEntities | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumSimilarEntities(client);
    model.items = Array.isArray(raw['items']) ? (raw['items'] as JSONValue[]) : undefined;
    return model;
  }
}
