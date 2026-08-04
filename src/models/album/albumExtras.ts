/**
 * Album-adjacent models: {@link AlbumTrailer}, {@link AlbumSimilarEntities} and {@link AlbumDonations}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
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
    reportUnknown(client, 'AlbumTrailer', raw, model);
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
    reportUnknown(client, 'AlbumSimilarEntities', raw, model);
    return model;
  }
}

/** A single block of {@link AlbumRelatedContent}. */
export class AlbumRelatedContentBlock extends YandexMusicModel {
  /** Block id. */
  id?: string;
  /**
   * Block type, which drives the shape of the rest of the block's fields.
   *
   * @remarks The API's `AlbumRelatedContentBlockDto` is a polymorphic base class with
   * only `id`/`type` in the base — per-type fields remain unmapped raw JSON.
   */
  type?: string;

  /** @see {@link AlbumRelatedContentBlock} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumRelatedContentBlock | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumRelatedContentBlock(client);
    assign(model, raw, ['id', 'type']);
    reportUnknown(client, 'AlbumRelatedContentBlock', raw, model);
    return model;
  }
}

/** Content related to an album (`albums/{albumId}/related-content`). */
export class AlbumRelatedContent extends YandexMusicModel {
  /** The related-content blocks. */
  blocks?: AlbumRelatedContentBlock[];

  /** @see {@link AlbumRelatedContent} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumRelatedContent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumRelatedContent(client);
    model.blocks = deList(AlbumRelatedContentBlock.deJson, raw['blocks'], client);
    reportUnknown(client, 'AlbumRelatedContent', raw, model);
    return model;
  }
}

/** An album's (or artist donation page's) donations (`donation/albums/{albumId}`). */
export class AlbumDonations extends YandexMusicModel {
  /** Donations (raw JSON, pending a typed model — empty for albums without any). */
  donations?: JSONValue;

  /** @see {@link AlbumDonations} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumDonations | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumDonations(client);
    assign(model, raw, ['donations']);
    reportUnknown(client, 'AlbumDonations', raw, model);
    return model;
  }
}
