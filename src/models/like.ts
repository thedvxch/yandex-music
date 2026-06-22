/**
 * Like models: {@link Like} and {@link TracksList}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../base.js';
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
    assign(model, raw, ['type', 'id', 'timestamp', 'shortDescription', 'description', 'isPremiere', 'isBanner']);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.playlist = Playlist.deJson(raw['playlist'], client) ?? undefined;
    return model;
  }
}

/** A revisioned list of track references (the user's liked/disliked library). */
export class TracksList extends YandexMusicModel {
  /** Owner uid. */
  uid?: number;
  /** Library revision. */
  revision?: number;
  /** The track references. */
  tracks?: TrackShort[];

  /** @see {@link TracksList} */
  static deJson(raw: JSONValue | undefined, client?: Client): TracksList | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TracksList(client);
    assign(model, raw, ['uid', 'revision']);
    model.tracks = deList(TrackShort.deJson, raw['tracks'], client);
    return model;
  }
}
