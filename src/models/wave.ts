/**
 * Wave (personal station) models shared across landing and rotor responses.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';
import { Cover } from './common.js';

/** A wave (personal radio station) descriptor. */
export class Wave extends YandexMusicModel {
  /** Display name. */
  name?: string;
  /** Description. */
  description?: string;
  /** Seed ids the wave was started from (for example `album:12345`). */
  seeds?: string[];
  /** Station id in `type:tag` form (for example `user:onyourwave`). */
  stationId?: string;
  /** Origin tag used in `from` parameters. */
  idForFrom?: string;
  /** Wave type (for example `DEFAULT`). */
  type?: string;

  /** @see {@link Wave} */
  static deJson(raw: JSONValue | undefined, client?: Client): Wave | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Wave(client);
    assign(model, raw, ['name', 'description', 'seeds', 'stationId', 'idForFrom', 'type']);
    reportUnknown(client, 'Wave', raw, model);
    return model;
  }
}

/** The entity a wave agent represents. */
export class WaveAgentEntity extends YandexMusicModel {
  /** Entity type. */
  type?: string;

  /** @see {@link WaveAgentEntity} */
  static deJson(raw: JSONValue | undefined, client?: Client): WaveAgentEntity | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new WaveAgentEntity(client);
    assign(model, raw, ['type']);
    reportUnknown(client, 'WaveAgentEntity', raw, model);
    return model;
  }
}

/** An animated agent shown with a wave. */
export class WaveAgent extends YandexMusicModel {
  /** Animation URI. */
  animationUri?: string;
  /** Agent cover. */
  cover?: Cover;
  /** The entity the agent represents. */
  entity?: WaveAgentEntity;

  /** @see {@link WaveAgent} */
  static deJson(raw: JSONValue | undefined, client?: Client): WaveAgent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new WaveAgent(client);
    assign(model, raw, ['animationUri']);
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.entity = WaveAgentEntity.deJson(raw['entity'], client) ?? undefined;
    reportUnknown(client, 'WaveAgent', raw, model);
    return model;
  }
}

/** A wave together with its agent. */
export class SimilarEntityData extends YandexMusicModel {
  /** The wave. */
  wave?: Wave;
  /** The wave agent. */
  agent?: WaveAgent;

  /** @see {@link SimilarEntityData} */
  static deJson(raw: JSONValue | undefined, client?: Client): SimilarEntityData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SimilarEntityData(client);
    model.wave = Wave.deJson(raw['wave'], client) ?? undefined;
    model.agent = WaveAgent.deJson(raw['agent'], client) ?? undefined;
    reportUnknown(client, 'SimilarEntityData', raw, model);
    return model;
  }
}

/** An entry of a "similar" wave list. */
export class SimilarEntityItem extends YandexMusicModel {
  /** Item type. */
  type?: string;
  /** Item payload. */
  data?: SimilarEntityData;

  /** @see {@link SimilarEntityItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): SimilarEntityItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SimilarEntityItem(client);
    assign(model, raw, ['type']);
    model.data = SimilarEntityData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'SimilarEntityItem', raw, model);
    return model;
  }
}
