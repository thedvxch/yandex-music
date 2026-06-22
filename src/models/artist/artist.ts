/**
 * The {@link Artist} model and its value objects.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { ContentRestrictions, Cover, Link } from '../common.js';
import { Track } from '../track/track.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** Aggregate counts of an artist's content. */
export class Counts extends YandexMusicModel {
  /** Number of tracks. */
  tracks?: number;
  /** Number of albums where the artist is the primary author. */
  directAlbums?: number;
  /** Number of albums the artist also appears on. */
  alsoAlbums?: number;
  /** Number of tracks the artist also appears on. */
  alsoTracks?: number;

  /** @see {@link Counts} */
  static deJson(raw: JSONValue | undefined, client?: Client): Counts | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Counts(client);
    assign(model, raw, ['tracks', 'directAlbums', 'alsoAlbums', 'alsoTracks']);
    return model;
  }
}

/** Popularity ratings of an artist over time windows. */
export class Ratings extends YandexMusicModel {
  /** Monthly rank. */
  month?: number;
  /** Weekly rank. */
  week?: number;
  /** Daily rank. */
  day?: number;

  /** @see {@link Ratings} */
  static deJson(raw: JSONValue | undefined, client?: Client): Ratings | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Ratings(client);
    assign(model, raw, ['month', 'week', 'day']);
    return model;
  }
}

/** A textual description with an optional source URI. */
export class Description extends YandexMusicModel {
  /** Description text. */
  text?: string;
  /** Source URI of the description. */
  uri?: string;

  /** @see {@link Description} */
  static deJson(raw: JSONValue | undefined, client?: Client): Description | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Description(client);
    assign(model, raw, ['text', 'uri']);
    return model;
  }
}

/**
 * A music artist.
 */
export class Artist extends YandexMusicModel {
  /** Unique artist identifier. */
  id?: number;
  /** Error code, present when the artist could not be resolved. */
  error?: string;
  /** Reason the artist is unavailable. */
  reason?: string;
  /** Artist name. */
  name?: string;
  /** Artist cover art. */
  cover?: Cover;
  /** Whether this represents "Various Artists". */
  various?: boolean;
  /** Whether the artist is a composer. */
  composer?: boolean;
  /** Genres associated with the artist. */
  genres?: string[];
  /** Open Graph image URI template. */
  ogImage?: string;
  /** Alternative image URI template. */
  opImage?: string;
  /** Aggregate content counts. */
  counts?: Counts;
  /** Whether the artist is available. */
  available?: boolean;
  /** Popularity ratings. */
  ratings?: Ratings;
  /** External links (official site, socials). */
  links?: Link[];
  /** Whether concert tickets are available. */
  ticketsAvailable?: boolean;
  /** Number of likes. */
  likesCount?: number;
  /** A selection of the artist's popular tracks. */
  popularTracks?: Track[];
  /** Regions where the artist is available. */
  regions?: string[];
  /** Hand-written description. */
  handMadeDescription?: string;
  /** Structured description. */
  description?: Description;
  /** Countries associated with the artist. */
  countries?: string[];
  /** English Wikipedia link. */
  enWikipediaLink?: string;
  /** Database aliases. */
  dbAliases?: string[];
  /** Career start date. */
  initDate?: string;
  /** Career end date. */
  endDate?: string;
  /** YooMoney identifier (donations). */
  yaMoneyId?: string;
  /** Disclaimers. */
  disclaimers?: string[];
  /** Content availability restrictions. */
  contentRestrictions?: ContentRestrictions;
  /** Cut-out (transparent) cover art. */
  cutoutCover?: Cover;

  /**
   * Deserialize an {@link Artist}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): Artist | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Artist(client);
    assign(model, raw, [
      'id',
      'error',
      'reason',
      'name',
      'various',
      'composer',
      'genres',
      'ogImage',
      'opImage',
      'available',
      'ticketsAvailable',
      'likesCount',
      'regions',
      'handMadeDescription',
      'countries',
      'enWikipediaLink',
      'dbAliases',
      'initDate',
      'endDate',
      'yaMoneyId',
      'disclaimers',
    ]);
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.counts = Counts.deJson(raw['counts'], client) ?? undefined;
    model.ratings = Ratings.deJson(raw['ratings'], client) ?? undefined;
    model.links = raw['links'] ? deList(Link.deJson, raw['links'], client) : undefined;
    model.popularTracks = raw['popularTracks'] ? deList(Track.deJson, raw['popularTracks'], client) : undefined;
    model.description = Description.deJson(raw['description'], client) ?? undefined;
    model.contentRestrictions = ContentRestrictions.deJson(raw['contentRestrictions'], client) ?? undefined;
    model.cutoutCover = Cover.deJson(raw['cutoutCover'], client) ?? undefined;
    return model;
  }
}
