/**
 * The {@link Album} model and its value objects.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Cover, CoverDerivedColors, Link } from '../common.js';
import { Pager } from '../pager.js';
import { CustomWave } from '../playlist/promo.js';
import { Artist } from '../artist/artist.js';
import { Track } from '../track/track.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A record label. */
export class Label extends YandexMusicModel {
  /** Label identifier. */
  id?: number;
  /** Label name. */
  name?: string;
  /** Plain description. */
  description?: string;
  /** Formatted (HTML) description. */
  descriptionFormatted?: string;
  /** Image URI template. */
  image?: string;
  /** External links. */
  links?: Link[];
  /** Label kind. */
  type?: string;

  /** @see {@link Label} */
  static deJson(raw: JSONValue | undefined, client?: Client): Label | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Label(client);
    assign(model, raw, ['id', 'name', 'description', 'descriptionFormatted', 'image', 'type']);
    model.links = raw['links'] ? deList(Link.deJson, raw['links'], client) : undefined;
    return model;
  }
}

/** Position of a track within an album (disc and index). */
export class TrackPosition extends YandexMusicModel {
  /** Volume (disc) number, 1-based. */
  volume?: number;
  /** Track index within the volume, 1-based. */
  index?: number;

  /** @see {@link TrackPosition} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackPosition | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackPosition(client);
    assign(model, raw, ['volume', 'index']);
    return model;
  }
}

/** Information about an album that has been deprecated/replaced. */
export class Deprecation extends YandexMusicModel {
  /** Identifier of the album that supersedes this one. */
  targetAlbumId?: number;
  /** Deprecation status. */
  status?: string;
  /** Whether deprecation is complete. */
  done?: boolean;

  /** @see {@link Deprecation} */
  static deJson(raw: JSONValue | undefined, client?: Client): Deprecation | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Deprecation(client);
    assign(model, raw, ['targetAlbumId', 'status', 'done']);
    return model;
  }
}

/** A call-to-action button shown on an album page. */
export class AlbumActionButton extends YandexMusicModel {
  /** Button caption. */
  text?: string;
  /** Target URL. */
  url?: string;
  /** Button color. */
  color?: string;

  /** @see {@link AlbumActionButton} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumActionButton | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumActionButton(client);
    assign(model, raw, ['text', 'url', 'color']);
    return model;
  }
}

/**
 * A music album (also used to represent podcasts and audiobooks).
 */
export class Album extends YandexMusicModel {
  /** Unique album identifier. */
  id?: number;
  /** Error code, present when the album could not be resolved. */
  error?: string;
  /** Album title. */
  title?: string;
  /** Number of tracks. */
  trackCount?: number;
  /** Album artists. */
  artists?: Artist[];
  /** Record labels (objects or bare names depending on endpoint). */
  labels?: Array<Label | string>;
  /** Whether the album is available. */
  available?: boolean;
  /** Whether the album is available to premium users. */
  availableForPremiumUsers?: boolean;
  /** Version (for example "Deluxe Edition"). */
  version?: string;
  /** Cover URI template. */
  coverUri?: string;
  /** Structured cover descriptor. */
  cover?: Cover;
  /** Whether the album has a trailer. */
  hasTrailer?: boolean;
  /** Options the album is available for. */
  availableForOptions?: string[];
  /** Whether the user finished listening (audiobooks/podcasts). */
  listeningFinished?: boolean;
  /** Regions where the album is available. */
  availableRegions?: string[];
  /** Metatag id the album is grouped under. */
  metaTagId?: string;
  /** Sort order applied to the track list (with-tracks endpoint). */
  sortOrder?: string;
  /** Background image URI template. */
  backgroundImageUrl?: string;
  /** Whether the album is child-friendly content. */
  childContent?: boolean;
  /** Colors derived from the cover image. */
  derivedColors?: CoverDerivedColors;
  /** Custom wave (radio) descriptor. */
  customWave?: CustomWave;
  /** Duplicate albums (other editions of the same release). */
  duplicates?: Album[];
  /** Pagination metadata for the track list (with-tracks endpoint). */
  pager?: Pager;
  /** Album trailer (free-form raw JSON, pending a typed model). */
  trailer?: JSONValue;
  /** Explicit/content warning marker. */
  contentWarning?: string;
  /** Genre. */
  genre?: string;
  /** Text color suited for the cover. */
  textColor?: string;
  /** Short description. */
  shortDescription?: string;
  /** Full description. */
  description?: string;
  /** Whether the album is a premiere. */
  isPremiere?: boolean;
  /** Whether the album is a banner feature. */
  isBanner?: boolean;
  /** Meta type, for example `music` or `podcast`. */
  metaType?: string;
  /** Storage directory. */
  storageDir?: string;
  /** Open Graph image URI template. */
  ogImage?: string;
  /** Whether the album is recent. */
  recent?: boolean;
  /** Whether the album is flagged very important. */
  veryImportant?: boolean;
  /** Whether available on mobile. */
  availableForMobile?: boolean;
  /** Whether only partially available. */
  availablePartially?: boolean;
  /** Identifiers of the "best" tracks. */
  bests?: number[];
  /** Tracks grouped by volume (disc). Present on the with-tracks endpoint. */
  volumes?: Track[][];
  /** Release year. */
  year?: number;
  /** Release date (ISO 8601). */
  releaseDate?: string;
  /** Album kind, for example `single` or `compilation`. */
  type?: string;
  /** Position of a single track within the album (contextual). */
  trackPosition?: TrackPosition;
  /** Regions where available. */
  regions?: string[];
  /** Whether lyrics are available. */
  lyricsAvailable?: boolean;
  /** Total duration in milliseconds. */
  durationMs?: number;
  /** Explicit marker. */
  explicit?: boolean;
  /** Start date of availability. */
  startDate?: string;
  /** Number of likes. */
  likesCount?: number;
  /** Deprecation/replacement info. */
  deprecation?: Deprecation;
  /** Disclaimers. */
  disclaimers?: string[];
  /** Call-to-action button. */
  actionButton?: AlbumActionButton;

  /**
   * Deserialize an {@link Album}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): Album | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Album(client);
    assign(model, raw, [
      'id',
      'error',
      'title',
      'trackCount',
      'available',
      'availableForPremiumUsers',
      'version',
      'coverUri',
      'contentWarning',
      'genre',
      'textColor',
      'shortDescription',
      'description',
      'isPremiere',
      'isBanner',
      'metaType',
      'storageDir',
      'ogImage',
      'recent',
      'veryImportant',
      'availableForMobile',
      'availablePartially',
      'bests',
      'year',
      'releaseDate',
      'type',
      'regions',
      'lyricsAvailable',
      'durationMs',
      'explicit',
      'startDate',
      'likesCount',
      'disclaimers',
      'hasTrailer',
      'availableForOptions',
      'listeningFinished',
      'availableRegions',
      'metaTagId',
      'sortOrder',
      'backgroundImageUrl',
      'childContent',
      'trailer',
    ]);
    model.artists = deList(Artist.deJson, raw['artists'], client);
    model.labels = Album.deLabels(raw['labels'], client);
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.derivedColors = CoverDerivedColors.deJson(raw['derivedColors'], client) ?? undefined;
    model.customWave = CustomWave.deJson(raw['customWave'], client) ?? undefined;
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    model.duplicates = raw['duplicates'] ? deList(Album.deJson, raw['duplicates'], client) : undefined;
    model.trackPosition = TrackPosition.deJson(raw['trackPosition'], client) ?? undefined;
    model.deprecation = Deprecation.deJson(raw['deprecation'], client) ?? undefined;
    model.actionButton = AlbumActionButton.deJson(raw['actionButton'], client) ?? undefined;
    if (Array.isArray(raw['volumes'])) {
      model.volumes = raw['volumes'].map((volume) => deList(Track.deJson, volume, client));
    }
    reportUnknown(client, 'Album', raw, model);
    return model;
  }

  private static deLabels(raw: JSONValue | undefined, client?: Client): Array<Label | string> | undefined {
    if (!Array.isArray(raw)) {
      return undefined;
    }
    return raw.map((entry) => (isJsonObject(entry) ? (Label.deJson(entry, client) ?? entry) : entry)) as Array<
      Label | string
    >;
  }
}
