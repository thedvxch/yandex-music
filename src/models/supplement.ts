/**
 * Track supplement models: {@link Lyrics}, {@link VideoSupplement}, {@link Supplement}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/**
 * Track lyrics embedded in the supplement.
 *
 * @deprecated Fetching lyrics via the supplement is legacy; prefer
 * {@link Client.tracksLyrics}.
 */
export class Lyrics extends YandexMusicModel {
  /** Lyric id. */
  id?: number;
  /** Lyrics, possibly truncated. */
  lyrics?: string;
  /** Full lyrics. */
  fullLyrics?: string;
  /** Whether the lyrics are rights-cleared. */
  hasRights?: boolean;
  /** Whether a translation is shown. */
  showTranslation?: boolean;
  /** Lyrics language. */
  textLanguage?: string;
  /** Source URL. */
  url?: string;

  /** @see {@link Lyrics} */
  static deJson(raw: JSONValue | undefined, client?: Client): Lyrics | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Lyrics(client);
    assign(model, raw, ['id', 'lyrics', 'fullLyrics', 'hasRights', 'showTranslation', 'textLanguage', 'url']);
    return model;
  }
}

/** A video associated with a track. */
export class VideoSupplement extends YandexMusicModel {
  /** Cover URL. */
  cover?: string;
  /** Hosting provider. */
  provider?: string;
  /** Title. */
  title?: string;
  /** Provider video id. */
  providerVideoId?: string;
  /** Direct URL. */
  url?: string;
  /** Embeddable URL. */
  embedUrl?: string;
  /** Embed markup. */
  embed?: string;

  /** @see {@link VideoSupplement} */
  static deJson(raw: JSONValue | undefined, client?: Client): VideoSupplement | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new VideoSupplement(client);
    assign(model, raw, ['cover', 'provider', 'title', 'providerVideoId', 'url', 'embedUrl', 'embed']);
    return model;
  }
}

/** Supplementary information about a track (lyrics, videos, radio availability). */
export class Supplement extends YandexMusicModel {
  /** Supplement id. */
  id?: number;
  /** Embedded lyrics. */
  lyrics?: Lyrics;
  /** Associated videos. */
  videos?: VideoSupplement[];
  /** Whether a radio is available for the track. */
  radioIsAvailable?: boolean;
  /** Description. */
  description?: string;

  /** @see {@link Supplement} */
  static deJson(raw: JSONValue | undefined, client?: Client): Supplement | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Supplement(client);
    assign(model, raw, ['id', 'radioIsAvailable', 'description']);
    model.lyrics = Lyrics.deJson(raw['lyrics'], client) ?? undefined;
    model.videos = deList(VideoSupplement.deJson, raw['videos'], client);
    return model;
  }
}
