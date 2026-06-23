/**
 * Search models: {@link Search}, {@link SearchResult}, {@link Best}, {@link Suggestions}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Album } from '../album/album.js';
import { Artist } from '../artist/artist.js';
import { Track } from '../track/track.js';
import { Video } from '../video.js';
import { User } from '../user.js';
import { Playlist } from '../playlist/playlist.js';
import { Clip } from '../clip.js';
import type { Client } from '../../client.js';
import type { DeJson, JSONValue } from '../../types.js';

/** Any entity that can be a search result or a "best match". */
export type SearchEntity = Track | Artist | Album | Playlist | Video | User | Clip;

/** Maps an API result `type` to the model deserializer that handles it. */
const TYPE_TO_DEJSON: Record<string, DeJson<SearchEntity>> = {
  track: Track.deJson,
  artist: Artist.deJson,
  album: Album.deJson,
  playlist: Playlist.deJson,
  video: Video.deJson,
  user: User.deJson,
  podcast: Album.deJson,
  podcast_episode: Track.deJson,
  clip: Clip.deJson,
};

/**
 * One typed block of search results (for example all matching tracks).
 *
 * @typeParam T - The entity type contained in {@link SearchResult.results}.
 */
export class SearchResult<T extends SearchEntity = SearchEntity> extends YandexMusicModel {
  /** Result type (`track`, `artist`, `album`, `playlist`, `video`, `user`). */
  type?: string;
  /** Total number of matches. */
  total?: number;
  /** Maximum results per page. */
  perPage?: number;
  /** Display order of this block. */
  order?: number;
  /** The matched entities. */
  results?: T[];

  /**
   * Deserialize a {@link SearchResult} using a specific entity deserializer.
   *
   * @typeParam T - The entity type produced.
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @param deJson - Deserializer for the entity stored in `results`.
   * @param type - Result type to record when the payload omits it.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson<T extends SearchEntity>(
    raw: JSONValue | undefined,
    client: Client | undefined,
    deJson: DeJson<T>,
    type?: string,
  ): SearchResult<T> | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SearchResult<T>(client);
    assign(model, raw, ['type', 'total', 'perPage', 'order']);
    if (type && model.type === undefined) {
      model.type = type;
    }
    model.results = deList(deJson, raw['results'], client);
    reportUnknown(client, 'SearchResult', raw, model);
    return model;
  }
}

/** The single best match for a query, with its resolved entity. */
export class Best extends YandexMusicModel {
  /** Entity type of the best match. */
  type?: string;
  /** The resolved entity. */
  result?: SearchEntity;
  /** Echoed query text. */
  text?: string;

  /** @see {@link Best} */
  static deJson(raw: JSONValue | undefined, client?: Client): Best | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Best(client);
    assign(model, raw, ['type', 'text']);
    const deJson = typeof model.type === 'string' ? TYPE_TO_DEJSON[model.type] : undefined;
    model.result = deJson ? (deJson(raw['result'], client) ?? undefined) : undefined;
    reportUnknown(client, 'Best', raw, model);
    return model;
  }
}

/** Search suggestions for a partial query. */
export class Suggestions extends YandexMusicModel {
  /** The best matching entity for the partial query. */
  best?: Best;
  /** Suggested completion strings. */
  suggestions?: string[];

  /** @see {@link Suggestions} */
  static deJson(raw: JSONValue | undefined, client?: Client): Suggestions | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Suggestions(client);
    assign(model, raw, ['suggestions']);
    model.best = Best.deJson(raw['best'], client) ?? undefined;
    reportUnknown(client, 'Suggestions', raw, model);
    return model;
  }
}

/** Full search response across all entity types. */
export class Search extends YandexMusicModel {
  /** Unique id of the search request. */
  searchRequestId?: string;
  /** Echoed query text. */
  text?: string;
  /** The single best match. */
  best?: Best;
  /** Matching albums. */
  albums?: SearchResult<Album>;
  /** Matching artists. */
  artists?: SearchResult<Artist>;
  /** Matching playlists. */
  playlists?: SearchResult<Playlist>;
  /** Matching tracks. */
  tracks?: SearchResult<Track>;
  /** Matching videos. */
  videos?: SearchResult<Video>;
  /** Matching users. */
  users?: SearchResult<User>;
  /** Matching podcasts (modeled as albums). */
  podcasts?: SearchResult<Album>;
  /** Matching podcast episodes (modeled as tracks). */
  podcastEpisodes?: SearchResult<Track>;
  /** Matching clips (short videos). */
  clips?: SearchResult<Clip>;
  /** Result type filter that was applied. */
  type?: string;
  /** Page index. */
  page?: number;
  /** Results per page. */
  perPage?: number;
  /** Corrected query text, when a misspelling was detected. */
  misspellResult?: string;
  /** Original (mis-spelled) query text. */
  misspellOriginal?: string;
  /** Whether the query was auto-corrected. */
  misspellCorrected?: boolean;
  /** Whether correction was disabled. */
  nocorrect?: boolean;

  /** @see {@link Search} */
  static deJson(raw: JSONValue | undefined, client?: Client): Search | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Search(client);
    assign(model, raw, [
      'searchRequestId',
      'text',
      'type',
      'page',
      'perPage',
      'misspellResult',
      'misspellOriginal',
      'misspellCorrected',
      'nocorrect',
    ]);
    model.best = Best.deJson(raw['best'], client) ?? undefined;
    model.albums = SearchResult.deJson(raw['albums'], client, Album.deJson, 'album') ?? undefined;
    model.artists = SearchResult.deJson(raw['artists'], client, Artist.deJson, 'artist') ?? undefined;
    model.playlists = SearchResult.deJson(raw['playlists'], client, Playlist.deJson, 'playlist') ?? undefined;
    model.tracks = SearchResult.deJson(raw['tracks'], client, Track.deJson, 'track') ?? undefined;
    model.videos = SearchResult.deJson(raw['videos'], client, Video.deJson, 'video') ?? undefined;
    model.users = SearchResult.deJson(raw['users'], client, User.deJson, 'user') ?? undefined;
    model.podcasts = SearchResult.deJson(raw['podcasts'], client, Album.deJson, 'podcast') ?? undefined;
    // API key is snake_case here (`podcast_episodes`), unlike the rest of the response.
    model.podcastEpisodes =
      SearchResult.deJson(raw['podcast_episodes'], client, Track.deJson, 'podcast_episode') ?? undefined;
    model.clips = SearchResult.deJson(raw['clips'], client, Clip.deJson, 'clip') ?? undefined;
    reportUnknown(client, 'Search', raw, model, ['podcast_episodes']);
    return model;
  }
}
