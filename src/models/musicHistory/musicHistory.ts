/**
 * Listening-history models (`/music-history`).
 *
 * @remarks
 * The polymorphic `fullModel` of a history item (either a {@link Track} or a
 * context model) is exposed as raw JSON; the structural path used in practice —
 * {@link MusicHistory.historyTabs} → groups → items → {@link MusicHistoryItemId} —
 * is fully typed.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** Identifiers carried by a history item. */
export class MusicHistoryItemId extends YandexMusicModel {
  /** Generic id. */
  id?: string;
  /** Track id. */
  trackId?: string;
  /** Album id. */
  albumId?: string;
  /** Owner uid (for playlists/waves). */
  uid?: string | number;
  /** Playlist kind. */
  kind?: string | number;
  /** Wave seeds. */
  seeds?: string[];

  /** @see {@link MusicHistoryItemId} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryItemId | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryItemId(client);
    assign(model, raw, ['id', 'trackId', 'albumId', 'uid', 'kind', 'seeds']);
    return model;
  }
}

/** The payload of a single history item. */
export class MusicHistoryItemData extends YandexMusicModel {
  /** The item identifiers. */
  itemId?: MusicHistoryItemId;
  /** The full entity (a {@link Track} or context model) as raw JSON. */
  fullModel?: JSONValue;

  /** @see {@link MusicHistoryItemData} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryItemData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryItemData(client);
    assign(model, raw, ['fullModel']);
    model.itemId = MusicHistoryItemId.deJson(raw['itemId'], client) ?? undefined;
    return model;
  }
}

/** A typed entry within a history group (a context or a track). */
export class MusicHistoryItem extends YandexMusicModel {
  /** Entry type, for example `track` or a context kind. */
  type?: string;
  /** The entry payload. */
  data?: MusicHistoryItemData;

  /** @see {@link MusicHistoryItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryItem(client);
    assign(model, raw, ['type']);
    model.data = MusicHistoryItemData.deJson(raw['data'], client) ?? undefined;
    return model;
  }
}

/** A context together with the tracks played in it. */
export class MusicHistoryGroup extends YandexMusicModel {
  /** The playback context. */
  context?: MusicHistoryItem;
  /** Tracks played within the context. */
  tracks?: MusicHistoryItem[];

  /** @see {@link MusicHistoryGroup} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryGroup | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryGroup(client);
    model.context = MusicHistoryItem.deJson(raw['context'], client) ?? undefined;
    model.tracks = deList(MusicHistoryItem.deJson, raw['tracks'], client);
    return model;
  }
}

/** A day's worth of listening history. */
export class MusicHistoryTab extends YandexMusicModel {
  /** Date of the tab. */
  date?: string;
  /** History groups for the day. */
  items?: MusicHistoryGroup[];

  /** @see {@link MusicHistoryTab} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryTab | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryTab(client);
    assign(model, raw, ['date']);
    model.items = deList(MusicHistoryGroup.deJson, raw['items'], client);
    return model;
  }
}

/** The full listening history grouped by day. */
export class MusicHistory extends YandexMusicModel {
  /** History tabs (one per day). */
  historyTabs?: MusicHistoryTab[];

  /** @see {@link MusicHistory} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistory | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistory(client);
    model.historyTabs = deList(MusicHistoryTab.deJson, raw['historyTabs'], client);
    return model;
  }
}

/** The result of resolving specific history items. */
export class MusicHistoryItems extends YandexMusicModel {
  /** The resolved items. */
  items?: MusicHistoryItem[];

  /** @see {@link MusicHistoryItems} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryItems | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryItems(client);
    model.items = deList(MusicHistoryItem.deJson, raw['items'], client);
    return model;
  }
}
