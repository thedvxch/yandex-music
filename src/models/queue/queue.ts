/**
 * Playback-queue models.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { TrackId } from '../trackShort.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** The context a queue was started from (album, playlist, radio, …). */
export class Context extends YandexMusicModel {
  /** Context type. */
  type?: string;
  /** Context id. */
  id?: string;
  /** Context description. */
  description?: string;

  /** @see {@link Context} */
  static deJson(raw: JSONValue | undefined, client?: Client): Context | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Context(client);
    assign(model, raw, ['type', 'id', 'description']);
    reportUnknown(client, 'Context', raw, model);
    return model;
  }
}

/** A summary entry in the list of a user's queues. */
export class QueueItem extends YandexMusicModel {
  /** Queue id. */
  id?: string;
  /** Queue context. */
  context?: Context;
  /** Last modification timestamp. */
  modified?: string;

  /** @see {@link QueueItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): QueueItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new QueueItem(client);
    assign(model, raw, ['id', 'modified']);
    model.context = Context.deJson(raw['context'], client) ?? undefined;
    reportUnknown(client, 'QueueItem', raw, model);
    return model;
  }
}

/** A full playback queue with its tracks and current position. */
export class Queue extends YandexMusicModel {
  /** The context the queue was started from. */
  context?: Context;
  /** Track references in the queue. */
  tracks?: TrackId[];
  /** Index of the currently playing track. */
  currentIndex?: number;
  /** Last modification timestamp. */
  modified?: string;
  /** Queue id. */
  id?: string;
  /** Origin tag used in `from` parameters. */
  from?: string;

  /** @see {@link Queue} */
  static deJson(raw: JSONValue | undefined, client?: Client): Queue | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Queue(client);
    assign(model, raw, ['currentIndex', 'modified', 'id', 'from']);
    model.context = Context.deJson(raw['context'], client) ?? undefined;
    model.tracks = deList(TrackId.deJson, raw['tracks'], client);
    reportUnknown(client, 'Queue', raw, model);
    return model;
  }
}
