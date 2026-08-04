/**
 * The {@link Disclaimer} model and its {@link ForeignAgent} sub-object.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
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
    reportUnknown(client, 'ForeignAgent', raw, model);
    return model;
  }
}

/**
 * A global disclaimer template entry (`disclaimers`).
 *
 * @remarks Distinct from {@link Disclaimer} — this is the flat, top-level template
 * shape (`id`/`type`/`title`/`description`), not the per-entity `foreignAgent`/`modal`
 * wrapper attached to tracks, clips, albums and artists.
 */
export class DisclaimerEntry extends YandexMusicModel {
  /** Disclaimer id. */
  id?: string;
  /** Disclaimer type. */
  type?: string;
  /** Reason (known value: `policy`). */
  reason?: string;
  /** Title. */
  title?: string;
  /** Description. */
  description?: string;
  /** Extra details (raw JSON, pending a typed model). */
  details?: JSONValue;

  /** @see {@link DisclaimerEntry} */
  static deJson(raw: JSONValue | undefined, client?: Client): DisclaimerEntry | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new DisclaimerEntry(client);
    assign(model, raw, ['id', 'type', 'reason', 'title', 'description', 'details']);
    reportUnknown(client, 'DisclaimerEntry', raw, model);
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
    reportUnknown(client, 'Disclaimer', raw, model);
    return model;
  }
}
