/**
 * The {@link Stats} model: an artist's listening statistics.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../../base.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** An artist's recent listening statistics. */
export class Stats extends YandexMusicModel {
  /** Number of listeners over the last month. */
  lastMonthListeners?: number;
  /** Change in monthly listeners since the previous period. */
  lastMonthListenersDelta?: number;

  /** @see {@link Stats} */
  static deJson(raw: JSONValue | undefined, client?: Client): Stats | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Stats(client);
    assign(model, raw, ['lastMonthListeners', 'lastMonthListenersDelta']);
    reportUnknown(client, 'Stats', raw, model);
    return model;
  }
}
