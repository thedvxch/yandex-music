/**
 * The {@link Pin} model (pinned items) and its container {@link PinsList}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../base.js';
import { ContentRestrictions, Cover } from './common.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** The payload of a {@link Pin} (an album, artist or playlist reference). */
export class PinData extends YandexMusicModel {
  /** Entity id (albums/artists). */
  id?: number;
  /** Owner uid (playlists). */
  uid?: number;
  /** Playlist kind (playlists). */
  kind?: number;
  /** Playlist UUID (playlists only). */
  playlistUuid?: string;
  /** Entity name (artists). */
  name?: string;
  /** Entity title (albums, playlists). */
  title?: string;
  /** Cover art. */
  cover?: Cover;
  /** Content availability restrictions. */
  contentRestrictions?: ContentRestrictions;

  /** @see {@link PinData} */
  static deJson(raw: JSONValue | undefined, client?: Client): PinData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PinData(client);
    assign(model, raw, ['id', 'uid', 'kind', 'playlistUuid', 'name', 'title']);
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.contentRestrictions = ContentRestrictions.deJson(raw['contentRestrictions'], client) ?? undefined;
    return model;
  }
}

/** A pinned item on a user's profile. */
export class Pin extends YandexMusicModel {
  /** Pin type (`artist_item`, `album_item`, `playlist_item`, `wave_item`). */
  type?: string;
  /** The pinned entity. */
  data?: PinData;

  /** @see {@link Pin} */
  static deJson(raw: JSONValue | undefined, client?: Client): Pin | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Pin(client);
    assign(model, raw, ['type']);
    model.data = PinData.deJson(raw['data'], client) ?? undefined;
    return model;
  }
}

/** The list of a user's pinned items. */
export class PinsList extends YandexMusicModel {
  /** The pinned items. */
  pins?: Pin[];

  /** @see {@link PinsList} */
  static deJson(raw: JSONValue | undefined, client?: Client): PinsList | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PinsList(client);
    model.pins = deList(Pin.deJson, raw['pins'], client);
    return model;
  }
}
