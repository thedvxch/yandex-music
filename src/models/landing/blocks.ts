/**
 * Models of the `landing-blocks/*` home-screen blocks and the landing skeleton.
 *
 * @remarks
 * Shapes verified against the live API on 2026-11-27. These blocks use the
 * compact entity form (an album or artist with `id`, `title`/`name` and
 * `cover`), which the regular models parse fine with most fields absent.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Album, AlbumTrailerStatus } from '../album/album.js';
import { Artist } from '../artist/artist.js';
import { Playlist } from '../playlist/playlist.js';
import { Concert } from '../concert/concert.js';
import { Cover, CoverDerivedColors } from '../common.js';
import { WaveAgent } from '../wave.js';
import { SkeletonBlock } from '../skeleton.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** One startable wave of `landing-blocks/waves` (by activity, artist, genre, language, …). */
export class LandingWaveItem extends YandexMusicModel {
  /** Wave title (for example an artist name or `Русский рэп`). */
  title?: string;
  /** Header shown above the title (for example `Моя волна по жанру`). */
  header?: string;
  /** Station id to start, in `type:tag` form (for example `genre:rusrap`). */
  stationId?: string;
  /** Rotor seeds for the wave. */
  seeds?: string[];
  /** Animation URL. */
  animationUrl?: string;
  /** Background image URI template (no scheme, `%%` size placeholder). */
  backgroundImageUrl?: string;
  /** Compact image URI template. */
  compactImageUrl?: string;
  /** Colors (`average`, `waveText`). */
  colors?: CoverDerivedColors;
  /** The animated agent. */
  agent?: WaveAgent;

  /** @see {@link LandingWaveItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingWaveItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingWaveItem(client);
    assign(model, raw, ['title', 'header', 'stationId', 'seeds', 'animationUrl', 'backgroundImageUrl', 'compactImageUrl']);
    model.colors = CoverDerivedColors.deJson(raw['colors'], client) ?? undefined;
    model.agent = WaveAgent.deJson(raw['agent'], client) ?? undefined;
    reportUnknown(client, 'LandingWaveItem', raw, model);
    return model;
  }
}

/** A titled group of waves (for example `mix` / `топ`, `language` / `по языку`). */
export class LandingWaveGroup extends YandexMusicModel {
  /** Group id. */
  id?: string;
  /** Group title. */
  title?: string;
  /** The waves. */
  items?: LandingWaveItem[];

  /** @see {@link LandingWaveGroup} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingWaveGroup | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingWaveGroup(client);
    assign(model, raw, ['id', 'title']);
    model.items = deList(LandingWaveItem.deJson, raw['items'], client);
    reportUnknown(client, 'LandingWaveGroup', raw, model);
    return model;
  }
}

/** Result of `landing-blocks/waves`. */
export class LandingWaves extends YandexMusicModel {
  /** Wave groups. */
  waves?: LandingWaveGroup[];

  /** @see {@link LandingWaves} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingWaves | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingWaves(client);
    model.waves = deList(LandingWaveGroup.deJson, raw['waves'], client);
    reportUnknown(client, 'LandingWaves', raw, model);
    return model;
  }
}

/**
 * Payload of a {@link LandingBlockItem}. Which fields are set depends on the
 * item `type`: `artist_item` carries {@link artist}; `liked_playlist_item`
 * carries {@link playlist}, {@link likesCount} and {@link trackCount};
 * `personal_playlist_item` carries {@link playlist}, {@link playlistType},
 * {@link description}, {@link notify} and {@link idForFrom}.
 */
export class LandingBlockItemData extends YandexMusicModel {
  /** The artist (`artist_item`). */
  artist?: Artist;
  /** The playlist (playlist items). */
  playlist?: Playlist;
  /** The album, when the item is an album. */
  album?: Album;
  /** Likes of the playlist. */
  likesCount?: number;
  /** Tracks in the playlist. */
  trackCount?: number;
  /** Personal playlist kind (for example `playlistOfTheDay`, `neverHeard`, `recentTracks`). */
  playlistType?: string;
  /** Description. */
  description?: string;
  /** Whether the item is highlighted as updated. */
  notify?: boolean;
  /** Origin tag used in `from` parameters. */
  idForFrom?: string;
  /** Whether a trailer is available. */
  trailer?: AlbumTrailerStatus;

  /** @see {@link LandingBlockItemData} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingBlockItemData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingBlockItemData(client);
    assign(model, raw, ['likesCount', 'trackCount', 'playlistType', 'description', 'notify', 'idForFrom']);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.playlist = Playlist.deJson(raw['playlist'], client) ?? undefined;
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.trailer = AlbumTrailerStatus.deJson(raw['trailer'], client) ?? undefined;
    reportUnknown(client, 'LandingBlockItemData', raw, model);
    return model;
  }
}

/** One item of an `items` landing block. */
export class LandingBlockItem extends YandexMusicModel {
  /** Item type (`artist_item`, `liked_playlist_item`, `personal_playlist_item`, …). */
  type?: string;
  /** The payload. */
  data?: LandingBlockItemData;

  /** @see {@link LandingBlockItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingBlockItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingBlockItem(client);
    assign(model, raw, ['type']);
    model.data = LandingBlockItemData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'LandingBlockItem', raw, model);
    return model;
  }
}

/** Result of `landing-blocks/artists`, `new-playlists` and `personal-playlists`. */
export class LandingBlockItems extends YandexMusicModel {
  /** The items. */
  items?: LandingBlockItem[];

  /** @see {@link LandingBlockItems} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingBlockItems | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingBlockItems(client);
    model.items = deList(LandingBlockItem.deJson, raw['items'], client);
    reportUnknown(client, 'LandingBlockItems', raw, model);
    return model;
  }
}

/** An album entry of `landing-blocks/new-releases` and `in-style`. */
export class LandingAlbumItem extends YandexMusicModel {
  /** The album (compact form). */
  album?: Album;
  /** Album artists. */
  artists?: Artist[];
  /** Cover of the entry. */
  cover?: Cover;
  /** Release date (ISO 8601). */
  releaseDate?: string;
  /** Whether a trailer is available. */
  trailer?: AlbumTrailerStatus;

  /** @see {@link LandingAlbumItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingAlbumItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingAlbumItem(client);
    assign(model, raw, ['releaseDate']);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.artists = raw['artists'] ? deList(Artist.deJson, raw['artists'], client) : undefined;
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.trailer = AlbumTrailerStatus.deJson(raw['trailer'], client) ?? undefined;
    reportUnknown(client, 'LandingAlbumItem', raw, model);
    return model;
  }
}

/** Result of `landing-blocks/new-releases`. */
export class LandingNewReleases extends YandexMusicModel {
  /** New releases. */
  newReleases?: LandingAlbumItem[];

  /** @see {@link LandingNewReleases} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingNewReleases | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingNewReleases(client);
    model.newReleases = deList(LandingAlbumItem.deJson, raw['newReleases'], client);
    reportUnknown(client, 'LandingNewReleases', raw, model);
    return model;
  }
}

/** A tab of `landing-blocks/in-style`: albums in the style of one artist. */
export class InStyleTab extends YandexMusicModel {
  /** Tab id (an artist id). */
  id?: number;
  /** Tab title (the artist name). */
  title?: string;
  /** Tab cover. */
  cover?: Cover;
  /** The albums. */
  items?: LandingAlbumItem[];

  /** @see {@link InStyleTab} */
  static deJson(raw: JSONValue | undefined, client?: Client): InStyleTab | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new InStyleTab(client);
    assign(model, raw, ['id', 'title']);
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.items = deList(LandingAlbumItem.deJson, raw['items'], client);
    reportUnknown(client, 'InStyleTab', raw, model);
    return model;
  }
}

/** Result of `landing-blocks/in-style`. */
export class LandingInStyle extends YandexMusicModel {
  /** Tabs. */
  inStyleTabs?: InStyleTab[];

  /** @see {@link LandingInStyle} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingInStyle | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingInStyle(client);
    model.inStyleTabs = deList(InStyleTab.deJson, raw['inStyleTabs'], client);
    reportUnknown(client, 'LandingInStyle', raw, model);
    return model;
  }
}

/**
 * A server-driven page layout from `landing/skeleton/{id}` (`main`, `web_main`,
 * `Search`, `kids`, `non_music`, …). Each block names a `data.source.uri` whose
 * content is loaded with `Client.landingBlockSource`.
 */
export class LandingSkeleton extends YandexMusicModel {
  /** Skeleton id. */
  id?: string;
  /** Page title. */
  title?: string;
  /** Blocks (a `TABS` block nests further blocks in `data.tabs[].blocks`). */
  blocks?: SkeletonBlock[];

  /** @see {@link LandingSkeleton} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingSkeleton | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingSkeleton(client);
    assign(model, raw, ['id', 'title']);
    model.blocks = deList(SkeletonBlock.deJson, raw['blocks'], client);
    reportUnknown(client, 'LandingSkeleton', raw, model);
    return model;
  }
}

/** Result of `concerts/landing/personal`: concerts recommended for the user. */
export class PersonalConcerts extends YandexMusicModel {
  /** The concerts. */
  concerts?: Concert[];

  /** @see {@link PersonalConcerts} */
  static deJson(raw: JSONValue | undefined, client?: Client): PersonalConcerts | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PersonalConcerts(client);
    model.concerts = deList(Concert.deJson, raw['concerts'], client);
    reportUnknown(client, 'PersonalConcerts', raw, model);
    return model;
  }
}
