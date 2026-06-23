/**
 * Polymorphic payloads carried by a landing {@link BlockEntity}.
 *
 * A block entity's `data` shape is chosen by its `type`: {@link Promotion},
 * {@link PlayContext} (with {@link TrackShortOld} items) and {@link MixLink},
 * alongside the reused `GeneratedPlaylist`, `Album`, `Playlist` and `ChartItem`
 * models.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { TrackId } from '../trackShort.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A promotional banner shown on the landing page. */
export class Promotion extends YandexMusicModel {
  /** Promotion id. */
  promoId?: string;
  /** Title. */
  title?: string;
  /** Subtitle. */
  subtitle?: string;
  /** Heading. */
  heading?: string;
  /** Web URL. */
  url?: string;
  /** Deep-link URL scheme. */
  urlScheme?: string;
  /** Text color. */
  textColor?: string;
  /** Background gradient. */
  gradient?: string;
  /** Image URI template. */
  image?: string;

  /** @see {@link Promotion} */
  static deJson(raw: JSONValue | undefined, client?: Client): Promotion | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Promotion(client);
    assign(model, raw, ['promoId', 'title', 'subtitle', 'heading', 'url', 'urlScheme', 'textColor', 'gradient', 'image']);
    reportUnknown(client, 'Promotion', raw, model);
    return model;
  }
}

/** A track reference plus the time it was added, as used inside a play context. */
export class TrackShortOld extends YandexMusicModel {
  /** Reference to the track. */
  trackId?: TrackId;
  /** When the track was added. */
  timestamp?: string;

  /** @see {@link TrackShortOld} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackShortOld | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackShortOld(client);
    assign(model, raw, ['timestamp']);
    model.trackId = TrackId.deJson(raw['trackId'], client) ?? undefined;
    reportUnknown(client, 'TrackShortOld', raw, model);
    return model;
  }
}

/** A "continue listening" context (where playback last happened). */
export class PlayContext extends YandexMusicModel {
  /** Context kind (for example `playlist`, `album`, `radio`). */
  context?: string;
  /** Identifier of the context item. */
  contextItem?: string;
  /** Tracks recently played in this context. */
  tracks?: TrackShortOld[];
  /** Context payload (free-form raw JSON, pending a typed model). */
  payload?: JSONValue;

  /** @see {@link PlayContext} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlayContext | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlayContext(client);
    assign(model, raw, ['context', 'contextItem', 'payload']);
    model.tracks = deList(TrackShortOld.deJson, raw['tracks'], client);
    reportUnknown(client, 'PlayContext', raw, model);
    return model;
  }
}

/** A link to a themed mix (a colored tile on the landing page). */
export class MixLink extends YandexMusicModel {
  /** Title. */
  title?: string;
  /** Web URL. */
  url?: string;
  /** Deep-link URL scheme. */
  urlScheme?: string;
  /** Text color. */
  textColor?: string;
  /** Background color. */
  backgroundColor?: string;
  /** Background image URI template. */
  backgroundImageUri?: string;
  /** White cover variant. */
  coverWhite?: string;
  /** Cover URI template. */
  coverUri?: string;

  /** @see {@link MixLink} */
  static deJson(raw: JSONValue | undefined, client?: Client): MixLink | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MixLink(client);
    assign(model, raw, ['title', 'url', 'urlScheme', 'textColor', 'backgroundColor', 'backgroundImageUri', 'coverWhite', 'coverUri']);
    reportUnknown(client, 'MixLink', raw, model);
    return model;
  }
}
