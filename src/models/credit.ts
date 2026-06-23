/**
 * The {@link Credits} model: production credits of a track or clip.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A single production credit (a role and its value). */
export class Credit extends YandexMusicModel {
  /** Credit title (the role, for example "Producer"). */
  title?: string;
  /** Credit value (the person or entity). */
  value?: string;

  /** @see {@link Credit} */
  static deJson(raw: JSONValue | undefined, client?: Client): Credit | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Credit(client);
    assign(model, raw, ['title', 'value']);
    reportUnknown(client, 'Credit', raw, model);
    return model;
  }
}

/** The collection of production credits for an entity. */
export class Credits extends YandexMusicModel {
  /** The individual credits. */
  credits?: Credit[];

  /** @see {@link Credits} */
  static deJson(raw: JSONValue | undefined, client?: Client): Credits | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Credits(client);
    model.credits = deList(Credit.deJson, raw['credits'], client);
    reportUnknown(client, 'Credits', raw, model);
    return model;
  }
}
