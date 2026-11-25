/**
 * Like models: {@link Like} and {@link TracksList}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../base.js';
import { Album } from './album/album.js';
import { Artist } from './artist/artist.js';
import { Playlist } from './playlist/playlist.js';
import { TrackShort } from './trackShort.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A liked entity (artist, album or playlist) together with when it was liked. */
export class Like extends YandexMusicModel {
  /** Liked entity type. */
  type?: string;
  /** Entity id. */
  id?: string;
  /** When the like was added. */
  timestamp?: string;
  /** Liked album, when `type` is `album`. */
  album?: Album;
  /** Liked artist, when `type` is `artist`. */
  artist?: Artist;
  /** Liked playlist, when `type` is `playlist`. */
  playlist?: Playlist;
  /** Short description. */
  shortDescription?: string;
  /** Description. */
  description?: string;
  /** Whether a premiere. */
  isPremiere?: boolean;
  /** Whether shown as a banner. */
  isBanner?: boolean;

  /** @see {@link Like} */
  static deJson(raw: JSONValue | undefined, client?: Client): Like | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Like(client);
    assign(model, raw, ['type', 'timestamp', 'shortDescription', 'description', 'isPremiere', 'isBanner']);
    model.id = raw['id'] === undefined || raw['id'] === null ? undefined : String(raw['id']);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.playlist = Playlist.deJson(raw['playlist'], client) ?? undefined;
    reportUnknown(client, 'Like', raw, model);
    return model;
  }

  /**
   * Deserialize a list of likes of a known entity type (reference `Like.de_list`).
   *
   * For `type === 'artist'` an item without an `artist` key is itself the artist.
   * Every resulting {@link Like} carries `type`.
   *
   * @param raw - Raw JSON array.
   * @param client - The owning client.
   * @param type - Liked entity type (`artist`, `album` or `playlist`).
   */
  static deListTyped(raw: JSONValue | undefined, client: Client | undefined, type: string): Like[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const result: Like[] = [];
    for (const item of raw) {
      if (!isJsonObject(item)) {
        continue;
      }
      let like: Like | null;
      if (type === 'artist' && !('artist' in item)) {
        like = new Like(client);
        like.artist = Artist.deJson(item, client) ?? undefined;
        const id = item['id'];
        like.id = id === undefined || id === null ? undefined : String(id);
      } else {
        like = Like.deJson(item, client);
      }
      if (like === null) {
        continue;
      }
      like.type = type;
      result.push(like);
    }
    return result;
  }
}

/** A revisioned list of track references (the user's liked/disliked library). */
export class TracksList extends YandexMusicModel {
  /** Owner uid. */
  uid?: number;
  /** Library revision. */
  revision?: number;
  /** Stable UUID of the backing playlist (the "Liked tracks" playlist). */
  playlistUuid?: string;
  /** The track references. */
  tracks?: TrackShort[];

  /** @see {@link TracksList} */
  static deJson(raw: JSONValue | undefined, client?: Client): TracksList | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TracksList(client);
    assign(model, raw, ['uid', 'revision', 'playlistUuid']);
    model.tracks = deList(TrackShort.deJson, raw['tracks'], client);
    reportUnknown(client, 'TracksList', raw, model);
    return model;
  }
}
