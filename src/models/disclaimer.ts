/**
 * The {@link Disclaimer} model and its {@link ForeignAgent} sub-object.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A "foreign agent" notice attached to a disclaimer. */
export class ForeignAgent extends YandexMusicModel {
  /** Reason for the notice (known value: `policy`). */
  reason?: string;
  /** Notice title. */
  title?: string;

  /** @see {@link ForeignAgent} */
  static deJson(raw: JSONValue | undefined, client?: Client): ForeignAgent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ForeignAgent(client);
    assign(model, raw, ['reason', 'title']);
    return model;
  }
}

/** A legal disclaimer attached to a track, clip, album or artist. */
export class Disclaimer extends YandexMusicModel {
  /** The foreign-agent notice, when present. */
  foreignAgent?: ForeignAgent;

  /** @see {@link Disclaimer} */
  static deJson(raw: JSONValue | undefined, client?: Client): Disclaimer | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Disclaimer(client);
    model.foreignAgent = ForeignAgent.deJson(raw['foreignAgent'], client) ?? undefined;
    return model;
  }
}
