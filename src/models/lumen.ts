/**
 * The {@link Lumen} ambient-theme model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** Ambient theme/color state for the currently playing track (`/lumen`). */
export class Lumen extends YandexMusicModel {
  /** Status (server-defined, free-form). */
  status?: string;
  /** Theme data (raw JSON, pending a typed model). */
  themes?: JSONValue;

  /** @see {@link Lumen} */
  static deJson(raw: JSONValue | undefined, client?: Client): Lumen | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Lumen(client);
    assign(model, raw, ['status', 'themes']);
    reportUnknown(client, 'Lumen', raw, model);
    return model;
  }
}
