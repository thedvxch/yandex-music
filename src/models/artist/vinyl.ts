/**
 * The {@link Vinyl} model: a purchasable vinyl record.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject } from '../../base.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A vinyl record offered for an artist. */
export class Vinyl extends YandexMusicModel {
  /** Store URL of the offer. */
  url?: string;
  /** Record title. */
  title?: string;
  /** Release year. */
  year?: number;
  /** Price in the store's currency. */
  price?: number;
  /** Media format. */
  media?: string;
  /** Offer identifier. */
  offerId?: number;
  /** Ids of the artists featured on the record. */
  artistIds?: number[];
  /** Cover picture URI template. */
  picture?: string;

  /** @see {@link Vinyl} */
  static deJson(raw: JSONValue | undefined, client?: Client): Vinyl | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Vinyl(client);
    assign(model, raw, ['url', 'title', 'year', 'price', 'media', 'offerId', 'artistIds', 'picture']);
    return model;
  }
}
