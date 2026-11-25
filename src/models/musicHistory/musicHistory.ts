/**
 * Listening-history models (`/music-history`).
 *
 * @remarks
 * The polymorphic `fullModel` of a history item is a {@link Track} for `track`
 * items and a {@link MusicHistoryContextFullModel} for every other type.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Track } from '../track/track.js';
import { Album } from '../album/album.js';
import { Artist } from '../artist/artist.js';
import { Playlist } from '../playlist/playlist.js';
import { Wave } from '../wave.js';
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
    reportUnknown(client, 'MusicHistoryItemId', raw, model);
    return model;
  }
}

/** The full context model of a non-track history item (album, artist, playlist or wave). */
export class MusicHistoryContextFullModel extends YandexMusicModel {
  /** The album, for album contexts. */
  album?: Album;
  /** The artist, for artist contexts. */
  artist?: Artist;
  /** The playlist, for playlist contexts. */
  playlist?: Playlist;
  /** The wave, for wave contexts. */
  wave?: Wave;
  /** The artists of the context. */
  artists?: Artist[];
  /** Whether the context is available. */
  available?: boolean;
  /** Number of tracks in the context. */
  tracksCount?: number;
  /** Foreground image URL of a simple wave. */
  simpleWaveForegroundImageUrl?: string;
  /** Background color of a simple wave. */
  simpleWaveBackgroundColor?: string;

  /** @see {@link MusicHistoryContextFullModel} */
  static deJson(raw: JSONValue | undefined, client?: Client): MusicHistoryContextFullModel | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryContextFullModel(client);
    assign(model, raw, ['available', 'tracksCount', 'simpleWaveForegroundImageUrl', 'simpleWaveBackgroundColor']);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.playlist = Playlist.deJson(raw['playlist'], client) ?? undefined;
    model.wave = Wave.deJson(raw['wave'], client) ?? undefined;
    model.artists = deList(Artist.deJson, raw['artists'], client);
    reportUnknown(client, 'MusicHistoryContextFullModel', raw, model);
    return model;
  }
}

/** The payload of a single history item. */
export class MusicHistoryItemData extends YandexMusicModel {
  /** The item identifiers. */
  itemId?: MusicHistoryItemId;
  /** The full entity: a {@link Track} for `track` items, otherwise a {@link MusicHistoryContextFullModel}. */
  fullModel?: Track | MusicHistoryContextFullModel;

  /** @see {@link MusicHistoryItemData} */
  static deJson(raw: JSONValue | undefined, client?: Client, itemType?: string): MusicHistoryItemData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MusicHistoryItemData(client);
    model.fullModel =
      (itemType === 'track'
        ? Track.deJson(raw['fullModel'], client)
        : MusicHistoryContextFullModel.deJson(raw['fullModel'], client)) ?? undefined;
    model.itemId = MusicHistoryItemId.deJson(raw['itemId'], client) ?? undefined;
    reportUnknown(client, 'MusicHistoryItemData', raw, model);
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
    model.data = MusicHistoryItemData.deJson(raw['data'], client, model.type) ?? undefined;
    reportUnknown(client, 'MusicHistoryItem', raw, model);
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
    reportUnknown(client, 'MusicHistoryGroup', raw, model);
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
    reportUnknown(client, 'MusicHistoryTab', raw, model);
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
    reportUnknown(client, 'MusicHistory', raw, model);
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
    reportUnknown(client, 'MusicHistoryItems', raw, model);
    return model;
  }
}
