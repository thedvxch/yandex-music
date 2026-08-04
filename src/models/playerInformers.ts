/**
 * The {@link PlayerInformers} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A batch of player informer banners (`player-informers`). */
export class PlayerInformers extends YandexMusicModel {
  /** The informers (raw JSON, pending a typed model). */
  informers?: JSONValue[];

  /** @see {@link PlayerInformers} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlayerInformers | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlayerInformers(client);
    model.informers = Array.isArray(raw['informers']) ? (raw['informers'] as JSONValue[]) : undefined;
    reportUnknown(client, 'PlayerInformers', raw, model);
    return model;
  }
}
