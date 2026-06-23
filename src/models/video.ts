/**
 * The {@link Video} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A music video (typically hosted on an external provider). */
export class Video extends YandexMusicModel {
  /** Video title. */
  title?: string;
  /** Cover image URL. */
  cover?: string;
  /** Embeddable player URL. */
  embedUrl?: string;
  /** Hosting provider, for example `youtube`. */
  provider?: string;
  /** Provider-specific video id. */
  providerVideoId?: number | string;
  /** YouTube URL, when applicable. */
  youtubeUrl?: string;
  /** Thumbnail URL. */
  thumbnailUrl?: string;
  /** Duration in seconds. */
  duration?: number;
  /** Free-form text. */
  text?: string;
  /** Auto-playing HTML5 player markup. */
  htmlAutoPlayVideoPlayer?: string;
  /** Regions where available. */
  regions?: string[];

  /** @see {@link Video} */
  static deJson(raw: JSONValue | undefined, client?: Client): Video | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Video(client);
    assign(model, raw, [
      'title',
      'cover',
      'embedUrl',
      'provider',
      'providerVideoId',
      'youtubeUrl',
      'thumbnailUrl',
      'duration',
      'text',
      'htmlAutoPlayVideoPlayer',
      'regions',
    ]);
    reportUnknown(client, 'Video', raw, model);
    return model;
  }
}
