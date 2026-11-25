/**
 * Generative stream models (AI-generated radio streams).
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../../base.js';
import { CoverDerivedColors } from '../common.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** The playable stream of a {@link GenerativeStream}. */
export class GenerativeStreamInfo extends YandexMusicModel {
  /** Stream id. */
  id?: string;
  /** Stream URL. */
  url?: string;

  /** @see {@link GenerativeStreamInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): GenerativeStreamInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new GenerativeStreamInfo(client);
    assign(model, raw, ['id', 'url']);
    reportUnknown(client, 'GenerativeStreamInfo', raw, model);
    return model;
  }
}

/** The presentation (title, artwork, colors) of a {@link GenerativeStream}. */
export class GenerativeStreamData extends YandexMusicModel {
  /** Station title. */
  title?: string;
  /** Station subtitle. */
  subtitle?: string;
  /** Background color (hex). */
  backgroundColor?: string;
  /** Colors derived from the artwork. */
  derivedColors?: CoverDerivedColors;
  /** Image URL. */
  imageUrl?: string;
  /** Video cover URI. */
  videoCoverUri?: string;
  /** Station description. */
  explanations?: string;

  /** @see {@link GenerativeStreamData} */
  static deJson(raw: JSONValue | undefined, client?: Client): GenerativeStreamData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new GenerativeStreamData(client);
    assign(model, raw, ['title', 'subtitle', 'backgroundColor', 'imageUrl', 'videoCoverUri', 'explanations']);
    model.derivedColors = CoverDerivedColors.deJson(raw['derivedColors'], client) ?? undefined;
    reportUnknown(client, 'GenerativeStreamData', raw, model);
    return model;
  }
}

/** A generative stream: presentation data plus the stream to play. */
export class GenerativeStream extends YandexMusicModel {
  /** Presentation data. */
  data?: GenerativeStreamData;
  /** Generative model version. */
  version?: string;
  /** The stream to play. */
  stream?: GenerativeStreamInfo;

  /** @see {@link GenerativeStream} */
  static deJson(raw: JSONValue | undefined, client?: Client): GenerativeStream | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new GenerativeStream(client);
    assign(model, raw, ['version']);
    model.data = GenerativeStreamData.deJson(raw['data'], client) ?? undefined;
    model.stream = GenerativeStreamInfo.deJson(raw['stream'], client) ?? undefined;
    reportUnknown(client, 'GenerativeStream', raw, model);
    return model;
  }
}

/** Feedback payload for a generative stream. */
export class GenerativeStreamFeedback extends YandexMusicModel {
  /** Whether the stream should be reloaded. */
  reloadStream?: boolean;
  /** Whether playback was not paused. */
  notPaused?: boolean;

  /** @see {@link GenerativeStreamFeedback} */
  static deJson(raw: JSONValue | undefined, client?: Client): GenerativeStreamFeedback | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new GenerativeStreamFeedback(client);
    assign(model, raw, ['reloadStream', 'notPaused']);
    reportUnknown(client, 'GenerativeStreamFeedback', raw, model);
    return model;
  }
}
