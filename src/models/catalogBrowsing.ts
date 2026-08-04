/**
 * Shared id-list catalogue browsing models used by both the podcasts/books
 * (`non-music/*`) and kids (`children-landing/*`) catalogues.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../base.js';
import { PlaylistId } from './playlist/playlistId.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A titled list of album ids. */
export class AlbumIds extends YandexMusicModel {
  /** List title. */
  title?: string;
  /** Album ids. */
  albums?: string[];

  /** @see {@link AlbumIds} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumIds | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumIds(client);
    assign(model, raw, ['title', 'albums']);
    reportUnknown(client, 'AlbumIds', raw, model);
    return model;
  }
}

/** A titled list of album ids (`entities` key variant of {@link AlbumIds}). */
export class AlbumEntitiesIds extends YandexMusicModel {
  /** List title. */
  title?: string;
  /** Album ids. */
  albums?: string[];

  /** @see {@link AlbumEntitiesIds} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumEntitiesIds | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumEntitiesIds(client);
    assign(model, raw, ['title']);
    model.albums = Array.isArray(raw['entities']) ? (raw['entities'] as string[]) : undefined;
    reportUnknown(client, 'AlbumEntitiesIds', raw, model);
    return model;
  }
}

/** A titled list of playlist ids. */
export class PlaylistEntitiesIds extends YandexMusicModel {
  /** List title. */
  title?: string;
  /** Playlist ids. */
  playlists?: PlaylistId[];

  /** @see {@link PlaylistEntitiesIds} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistEntitiesIds | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistEntitiesIds(client);
    assign(model, raw, ['title']);
    model.playlists = deList(PlaylistId.deJson, raw['entities'], client);
    reportUnknown(client, 'PlaylistEntitiesIds', raw, model);
    return model;
  }
}
