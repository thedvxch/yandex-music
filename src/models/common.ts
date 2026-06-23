/**
 * Small value objects shared across multiple domains.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/**
 * Colors derived from a cover image, used to theme players and cards.
 */
export class CoverDerivedColors extends YandexMusicModel {
  /** Average color of the cover. */
  average?: string;
  /** Color suited for text drawn over the wave/animation. */
  waveText?: string;
  /** Background color for the mini player. */
  miniPlayer?: string;
  /** Accent color. */
  accent?: string;

  /**
   * Deserialize a {@link CoverDerivedColors}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): CoverDerivedColors | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CoverDerivedColors(client);
    assign(model, raw, ['average', 'waveText', 'miniPlayer', 'accent']);
    reportUnknown(client, 'CoverDerivedColors', raw, model);
    return model;
  }
}

/**
 * Cover art descriptor.
 *
 * A cover can either reference a single `uri` template or a list of `itemsUri`
 * tiles (mosaic covers, typically for playlists). Replace the `%%` placeholder in
 * a URI with a size such as `400x400` to obtain a concrete image URL.
 */
export class Cover extends YandexMusicModel {
  /** Cover kind, for example `mosaic` or `pic`. */
  type?: string;
  /** URI template of a single image. */
  uri?: string;
  /** URI templates of the tiles composing a mosaic cover. */
  itemsUri?: string[];
  /** Storage directory of the cover. */
  dir?: string;
  /** Version tag of the cover. */
  version?: string;
  /** Whether the cover is custom (legacy flag). */
  custom?: boolean;
  /** Whether the cover is custom. */
  isCustom?: boolean;
  /** Copyright holder name. */
  copyrightName?: string;
  /** Copyright C-line. */
  copyrightCline?: string;
  /** URI prefix. */
  prefix?: string;
  /** Error code when the cover could not be resolved. */
  error?: string;
  /** Dominant color. */
  color?: string;
  /** Colors derived from the cover image. */
  derivedColors?: CoverDerivedColors;
  /** URL of an animated/video cover. */
  videoUrl?: string;

  /**
   * Deserialize a {@link Cover}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): Cover | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Cover(client);
    assign(model, raw, [
      'type',
      'uri',
      'itemsUri',
      'dir',
      'version',
      'custom',
      'isCustom',
      'copyrightName',
      'copyrightCline',
      'prefix',
      'error',
      'color',
      'videoUrl',
    ]);
    model.derivedColors = CoverDerivedColors.deJson(raw['derivedColors'], client) ?? undefined;
    reportUnknown(client, 'Cover', raw, model);
    return model;
  }
}

/**
 * A square icon with a background color (used by genres, tags, etc.).
 */
export class Icon extends YandexMusicModel {
  /** Background color in hex. */
  backgroundColor?: string;
  /** URI template of the icon image. */
  imageUrl?: string;

  /**
   * Deserialize an {@link Icon}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): Icon | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Icon(client);
    assign(model, raw, ['backgroundColor', 'imageUrl']);
    reportUnknown(client, 'Icon', raw, model);
    return model;
  }
}

/**
 * An external link (social network, website) attached to an artist or label.
 */
export class Link extends YandexMusicModel {
  /** Display title of the link. */
  title?: string;
  /** Target URL (artist/album external links). */
  href?: string;
  /** Target URL (alternative key used by some link endpoints). */
  url?: string;
  /** Image URL accompanying the link. */
  imgUrl?: string;
  /** Secondary line of text. */
  subtitle?: string;
  /** Link kind, for example `official` or `social`. */
  type?: string;
  /** Social network name, when `type` is `social`. */
  socialNetwork?: string;

  /**
   * Deserialize a {@link Link}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): Link | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Link(client);
    assign(model, raw, ['title', 'href', 'url', 'imgUrl', 'subtitle', 'type', 'socialNetwork']);
    reportUnknown(client, 'Link', raw, model);
    return model;
  }
}

/**
 * Content availability restrictions and disclaimers for an entity.
 */
export class ContentRestrictions extends YandexMusicModel {
  /** Whether the content is available. */
  available?: boolean;
  /** Human-readable disclaimers. */
  disclaimers?: string[];

  /**
   * Deserialize a {@link ContentRestrictions}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): ContentRestrictions | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ContentRestrictions(client);
    assign(model, raw, ['available', 'disclaimers']);
    reportUnknown(client, 'ContentRestrictions', raw, model);
    return model;
  }
}
