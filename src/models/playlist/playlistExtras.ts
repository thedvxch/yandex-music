/**
 * Playlist-adjacent models returned by the dedicated playlist endpoints:
 * {@link PlaylistRecommendations}, {@link PlaylistSimilarEntities},
 * {@link PlaylistsList}, {@link PlaylistTrailer} and {@link GeneratedPlaylist}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Track } from '../track/track.js';
import { TrailerInfo } from '../trailerInfo.js';
import { Playlist } from './playlist.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** Track recommendations generated for a playlist. */
export class PlaylistRecommendations extends YandexMusicModel {
  /** The recommended tracks. */
  tracks?: Track[];
  /** Identifier of the recommendation batch. */
  batchId?: string;

  /** @see {@link PlaylistRecommendations} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistRecommendations | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistRecommendations(client);
    assign(model, raw, ['batchId']);
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    reportUnknown(client, 'PlaylistRecommendations', raw, model);
    return model;
  }
}

/** Entities similar to a playlist. */
export class PlaylistSimilarEntities extends YandexMusicModel {
  /** Similar entity items (raw JSON, pending a typed `SimilarEntityItem` model). */
  items?: JSONValue[];

  /** @see {@link PlaylistSimilarEntities} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistSimilarEntities | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistSimilarEntities(client);
    model.items = Array.isArray(raw['items']) ? (raw['items'] as JSONValue[]) : undefined;
    reportUnknown(client, 'PlaylistSimilarEntities', raw, model);
    return model;
  }
}

/** A list of playlists returned by the bulk `playlists` endpoint. */
export class PlaylistsList extends YandexMusicModel {
  /** The playlists. */
  playlists?: Playlist[];

  /** @see {@link PlaylistsList} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistsList | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistsList(client);
    model.playlists = deList(Playlist.deJson, raw['playlists'], client);
    reportUnknown(client, 'PlaylistsList', raw, model);
    return model;
  }
}

/** A playlist together with its trailer. */
export class PlaylistTrailer extends YandexMusicModel {
  /** The playlist. */
  playlist?: Playlist;
  /** The trailer. */
  trailer?: TrailerInfo;
  /** Whether the trailer is shareable. */
  shareable?: boolean;

  /** @see {@link PlaylistTrailer} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistTrailer | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistTrailer(client);
    assign(model, raw, ['shareable']);
    model.playlist = Playlist.deJson(raw['playlist'], client) ?? undefined;
    model.trailer = TrailerInfo.deJson(raw['trailer'], client) ?? undefined;
    reportUnknown(client, 'PlaylistTrailer', raw, model);
    return model;
  }
}

/** An automatically generated personal playlist (e.g. "Playlist of the day"). */
export class GeneratedPlaylist extends YandexMusicModel {
  /**
   * The generator type.
   *
   * @remarks
   * Known values: `playlistOfTheDay`, `origin`, `recentTracks`, `neverHeard`,
   * `podcasts`, `missedLikes`.
   */
  type?: string;
  /** Whether the playlist has been generated and is ready. */
  ready?: boolean;
  /** Whether the user should be notified about the playlist. */
  notify?: boolean;
  /** The underlying playlist. */
  data?: Playlist;
  /** Rich description blocks (raw JSON, pending a typed model). */
  description?: JSONValue[];
  /** Plain-text preview description. */
  previewDescription?: string;

  /** @see {@link GeneratedPlaylist} */
  static deJson(raw: JSONValue | undefined, client?: Client): GeneratedPlaylist | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new GeneratedPlaylist(client);
    assign(model, raw, ['type', 'ready', 'notify', 'previewDescription']);
    model.description = Array.isArray(raw['description']) ? (raw['description'] as JSONValue[]) : undefined;
    model.data = Playlist.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'GeneratedPlaylist', raw, model);
    return model;
  }
}
