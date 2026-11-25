/**
 * Rotor session models: combined-session items and landing, session events and
 * feedback, and personalization settings.
 *
 * @remarks
 * {@link RotorSeed} is defined in `seed.ts` and re-exported here;
 * `RotorSessionTracks` lives in `rotor.ts` next to its base class.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Clip } from '../clip.js';
import { Track } from '../track/track.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

export { RotorSeed } from './seed.js';

/** The track or clip a session event refers to. */
export class SessionPlayable extends YandexMusicModel {
  /** Object type: `track` or `clip`. */
  type?: string;
  /** Track id. */
  trackId?: string;
  /** Clip id. */
  id?: string;

  /** @see {@link SessionPlayable} */
  static deJson(raw: JSONValue | undefined, client?: Client): SessionPlayable | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SessionPlayable(client);
    assign(model, raw, ['type', 'trackId', 'id']);
    reportUnknown(client, 'SessionPlayable', raw, model);
    return model;
  }
}

/** A playback event reported to a rotor session. */
export class SessionEvent extends YandexMusicModel {
  /** Event type. */
  type?: string;
  /** Event timestamp (ISO string or epoch number). */
  timestamp?: string | number;
  /** Track id. */
  trackId?: string;
  /** Seconds of the track played so far. */
  totalPlayedSeconds?: number;
  /** The object the event refers to. */
  playable?: SessionPlayable;

  /** @see {@link SessionEvent} */
  static deJson(raw: JSONValue | undefined, client?: Client): SessionEvent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SessionEvent(client);
    assign(model, raw, ['type', 'timestamp', 'trackId', 'totalPlayedSeconds']);
    model.playable = SessionPlayable.deJson(raw['playable'], client) ?? undefined;
    reportUnknown(client, 'SessionEvent', raw, model);
    return model;
  }
}

/** One feedback entry of a rotor session. */
export class SessionFeedback extends YandexMusicModel {
  /** The event. */
  event?: SessionEvent;
  /** Batch id the event belongs to. */
  batchId?: string;
  /** Origin tag (`from` parameter). */
  from?: string;

  /** @see {@link SessionFeedback} */
  static deJson(raw: JSONValue | undefined, client?: Client): SessionFeedback | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SessionFeedback(client);
    assign(model, raw, ['batchId', 'from']);
    model.event = SessionEvent.deJson(raw['event'], client) ?? undefined;
    reportUnknown(client, 'SessionFeedback', raw, model);
    return model;
  }
}

/** The feedback entries sent for one rotor session. */
export class SessionFeedbacks extends YandexMusicModel {
  /** Session id. */
  sessionId?: string;
  /** The feedback entries. */
  feedbacks?: SessionFeedback[];

  /** @see {@link SessionFeedbacks} */
  static deJson(raw: JSONValue | undefined, client?: Client): SessionFeedbacks | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SessionFeedbacks(client);
    assign(model, raw, ['sessionId']);
    model.feedbacks = deList(SessionFeedback.deJson, raw['feedbacks'], client);
    reportUnknown(client, 'SessionFeedbacks', raw, model);
    return model;
  }
}

/** A queue entry of a combined session: a track or clip id. */
export class CombinedSessionQueueItem extends YandexMusicModel {
  /** Item type: `CLIP` or `TRACK`. */
  type?: string;
  /** Track or clip id. */
  id?: string;

  /** @see {@link CombinedSessionQueueItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): CombinedSessionQueueItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CombinedSessionQueueItem(client);
    assign(model, raw, ['type', 'id']);
    reportUnknown(client, 'CombinedSessionQueueItem', raw, model);
    return model;
  }
}

/** An item of a combined session: a {@link Track}, a {@link Clip}, or raw JSON for an unknown type. */
export class CombinedSessionItem extends YandexMusicModel {
  /** Item type: `TRACK` or `CLIP` (other values keep `data` raw). */
  type?: string;
  /** The track or clip; raw JSON when the type is not recognized. */
  data?: Track | Clip | JSONValue;

  /** @see {@link CombinedSessionItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): CombinedSessionItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CombinedSessionItem(client);
    assign(model, raw, ['type']);
    const type = typeof raw['type'] === 'string' ? raw['type'].toUpperCase() : undefined;
    if (type === 'TRACK') {
      model.data = Track.deJson(raw['data'], client) ?? undefined;
    } else if (type === 'CLIP') {
      model.data = Clip.deJson(raw['data'], client) ?? undefined;
    } else {
      model.data = raw['data'];
    }
    reportUnknown(client, 'CombinedSessionItem', raw, model);
    return model;
  }
}

/** The landing shown for a combined session. */
export class CombinedSessionLanding extends YandexMusicModel {
  /** Title. */
  title?: string;
  /** Description. */
  description?: string;
  /** Button text. */
  button?: string;
  /** The items. */
  list?: CombinedSessionItem[];

  /** @see {@link CombinedSessionLanding} */
  static deJson(raw: JSONValue | undefined, client?: Client): CombinedSessionLanding | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CombinedSessionLanding(client);
    assign(model, raw, ['title', 'description', 'button']);
    model.list = deList(CombinedSessionItem.deJson, raw['list'], client);
    reportUnknown(client, 'CombinedSessionLanding', raw, model);
    return model;
  }
}

/** Personalization settings of a rotor station (language, diversity, mood, energy). */
export class RotorSettings extends YandexMusicModel {
  /** Language filter. */
  language?: string;
  /** Diversity. */
  diversity?: string;
  /** Mood (legacy numeric scale). */
  mood?: number;
  /** Energy (legacy numeric scale). */
  energy?: number;
  /** Mood/energy preset. */
  moodEnergy?: string;

  /** @see {@link RotorSettings} */
  static deJson(raw: JSONValue | undefined, client?: Client): RotorSettings | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RotorSettings(client);
    assign(model, raw, ['language', 'diversity', 'mood', 'energy', 'moodEnergy']);
    reportUnknown(client, 'RotorSettings', raw, model);
    return model;
  }
}
