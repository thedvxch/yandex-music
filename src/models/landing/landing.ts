/**
 * Landing-page models.
 *
 * @remarks
 * The landing blocks carry heterogeneous payloads. The polymorphic `data` of a
 * {@link BlockEntity} is deserialized into the matching model based on its
 * `type` (see {@link BlockEntityData}); a few block-level menu sub-objects remain
 * raw JSON.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Track } from '../track/track.js';
import { TrackId } from '../trackShort.js';
import { Playlist } from '../playlist/playlist.js';
import { Album } from '../album/album.js';
import { GeneratedPlaylist } from '../playlist/playlistExtras.js';
import { Promotion, PlayContext, MixLink } from './entities.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** The possible shapes of a {@link BlockEntity}'s `data`, keyed by entity type. */
export type BlockEntityData =
  | GeneratedPlaylist
  | Promotion
  | Album
  | Playlist
  | ChartItem
  | PlayContext
  | MixLink
  | JSONValue;

/** A single item inside a landing block (album, playlist, promotion, …). */
export class BlockEntity extends YandexMusicModel {
  /** Entity id. */
  id?: string;
  /**
   * Entity type, which drives the shape of {@link data}.
   *
   * @remarks
   * Known values: `personal-playlist`, `promotion`, `album`, `playlist`,
   * `chart-item`, `play-context`, `mix-link`.
   */
  type?: string;
  /**
   * The polymorphic entity payload, deserialized according to {@link type}.
   * Unknown types fall back to the raw JSON value.
   */
  data?: BlockEntityData;
  /** Entity description. */
  description?: string;
  /** Formatted (HTML) entity description. */
  descriptionFormatted?: string;
  /** Last-updated timestamp (ISO 8601). */
  lastUpdated?: string;

  /** @see {@link BlockEntity} */
  static deJson(raw: JSONValue | undefined, client?: Client): BlockEntity | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new BlockEntity(client);
    assign(model, raw, ['id', 'type', 'description', 'descriptionFormatted', 'lastUpdated']);
    const data = raw['data'];
    switch (model.type) {
      case 'personal-playlist':
        model.data = GeneratedPlaylist.deJson(data, client) ?? undefined;
        break;
      case 'promotion':
        model.data = Promotion.deJson(data, client) ?? undefined;
        break;
      case 'album':
        model.data = Album.deJson(data, client) ?? undefined;
        break;
      case 'playlist':
        model.data = Playlist.deJson(data, client) ?? undefined;
        break;
      case 'chart-item':
        model.data = ChartItem.deJson(data, client) ?? undefined;
        break;
      case 'play-context':
        model.data = PlayContext.deJson(data, client) ?? undefined;
        break;
      case 'mix-link':
        model.data = MixLink.deJson(data, client) ?? undefined;
        break;
      default:
        model.data = data;
    }
    reportUnknown(client, 'BlockEntity', raw, model);
    return model;
  }
}

/** A block of a landing page (a titled row of entities). */
export class Block extends YandexMusicModel {
  /** Block id. */
  id?: string;
  /** Block type. */
  type?: string;
  /** Origin tag used in `from` parameters. */
  typeForFrom?: string;
  /** Block title. */
  title?: string;
  /** Items in the block. */
  entities?: BlockEntity[];
  /** Block description. */
  description?: string;
  /** Block-level data (raw JSON, pending typed variants). */
  data?: JSONValue;
  /** Background image URI template. */
  backgroundImageUrl?: string;
  /** Background video identifier. */
  backgroundVideoId?: string;
  /** Background video URL. */
  backgroundVideoUrl?: string;
  /**
   * Play-context reference driving the block's playback (`{kind, uid,
   * playlistUuid}`); free-form raw JSON, distinct from the landing-entity
   * {@link PlayContext}.
   */
  playContext?: JSONValue;

  /** @see {@link Block} */
  static deJson(raw: JSONValue | undefined, client?: Client): Block | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Block(client);
    assign(model, raw, [
      'id',
      'type',
      'typeForFrom',
      'title',
      'description',
      'data',
      'backgroundImageUrl',
      'backgroundVideoId',
      'backgroundVideoUrl',
      'playContext',
    ]);
    model.entities = deList(BlockEntity.deJson, raw['entities'], client);
    reportUnknown(client, 'Block', raw, model);
    return model;
  }
}

/** A landing page: an ordered list of blocks. */
export class Landing extends YandexMusicModel {
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;
  /** Content id of the landing. */
  contentId?: string | number;
  /** Page title (present on `non-music/*` landings, absent on `/landing3`). */
  title?: string;
  /** The page blocks. */
  blocks?: Block[];

  /** @see {@link Landing} */
  static deJson(raw: JSONValue | undefined, client?: Client): Landing | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Landing(client);
    assign(model, raw, ['pumpkin', 'contentId', 'title']);
    model.blocks = deList(Block.deJson, raw['blocks'], client);
    reportUnknown(client, 'Landing', raw, model);
    return model;
  }
}

/** A landing list of ids (new releases / new playlists / podcasts). */
export class LandingList extends YandexMusicModel {
  /** List type. */
  type?: string;
  /** Origin tag used in `from` parameters. */
  typeForFrom?: string;
  /** List title. */
  title?: string;
  /** List id. */
  id?: string;
  /** New release album ids. */
  newReleases?: number[];
  /** New playlist references (raw JSON, pending a typed model). */
  newPlaylists?: JSONValue[];
  /** Podcast album ids. */
  podcasts?: number[];

  /** @see {@link LandingList} */
  static deJson(raw: JSONValue | undefined, client?: Client): LandingList | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LandingList(client);
    assign(model, raw, ['type', 'typeForFrom', 'title', 'id', 'newReleases', 'newPlaylists', 'podcasts']);
    reportUnknown(client, 'LandingList', raw, model);
    return model;
  }
}

/** A track's standing within a chart. */
export class Chart extends YandexMusicModel {
  /** Current position. */
  position?: number;
  /** Movement description. */
  progress?: string;
  /** Listener count. */
  listeners?: number;
  /** Position shift since the previous chart. */
  shift?: number;
  /** Background color. */
  bgColor?: string;
  /** Reference to the track. */
  trackId?: TrackId;

  /** @see {@link Chart} */
  static deJson(raw: JSONValue | undefined, client?: Client): Chart | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Chart(client);
    assign(model, raw, ['position', 'progress', 'listeners', 'shift', 'bgColor']);
    model.trackId = TrackId.deJson(raw['trackId'], client) ?? undefined;
    reportUnknown(client, 'Chart', raw, model);
    return model;
  }
}

/** A track together with its chart standing. */
export class ChartItem extends YandexMusicModel {
  /** The track. */
  track?: Track;
  /** Its chart standing. */
  chart?: Chart;

  /** @see {@link ChartItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): ChartItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ChartItem(client);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    model.chart = Chart.deJson(raw['chart'], client) ?? undefined;
    reportUnknown(client, 'ChartItem', raw, model);
    return model;
  }
}

/** A single position in an {@link EntityChart} (`chart/albums`, `chart/podcasts`). */
export class EntityChartPosition extends YandexMusicModel {
  /** The charted album (podcasts are modeled as albums too). */
  album?: Album;

  /** @see {@link EntityChartPosition} */
  static deJson(raw: JSONValue | undefined, client?: Client): EntityChartPosition | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new EntityChartPosition(client);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    reportUnknown(client, 'EntityChartPosition', raw, model);
    return model;
  }
}

/** An album/podcast chart (`chart/albums`, `chart/podcasts`) — distinct from the
 * track-based {@link ChartInfo} returned by `/landing3/chart`. */
export class EntityChart extends YandexMusicModel {
  /** Chart kind (`albums` or `podcasts`). */
  chartType?: string;
  /** Origin tag used in `from` parameters. */
  typeForFrom?: string;
  /** Chart title. */
  title?: string;
  /** Chart description. */
  description?: string;
  /** The ranked positions. */
  chartPositions?: EntityChartPosition[];

  /** @see {@link EntityChart} */
  static deJson(raw: JSONValue | undefined, client?: Client): EntityChart | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new EntityChart(client);
    assign(model, raw, ['chartType', 'typeForFrom', 'title', 'description']);
    model.chartPositions = deList(EntityChartPosition.deJson, raw['chartPositions'], client);
    reportUnknown(client, 'EntityChart', raw, model);
    return model;
  }
}

/** A single item of `landing-blocks/recently-played`. */
export class RecentlyPlayedItem extends YandexMusicModel {
  /** Item type (for example `album_item`). */
  type?: string;
  /** The item payload (raw JSON — shape varies by {@link type}). */
  data?: JSONValue;

  /** @see {@link RecentlyPlayedItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): RecentlyPlayedItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RecentlyPlayedItem(client);
    assign(model, raw, ['type', 'data']);
    reportUnknown(client, 'RecentlyPlayedItem', raw, model);
    return model;
  }
}

/** The user's recently-played items (`landing-blocks/recently-played`). */
export class RecentlyPlayed extends YandexMusicModel {
  /** The items. */
  items?: RecentlyPlayedItem[];

  /** @see {@link RecentlyPlayed} */
  static deJson(raw: JSONValue | undefined, client?: Client): RecentlyPlayed | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RecentlyPlayed(client);
    model.items = deList(RecentlyPlayedItem.deJson, raw['items'], client);
    reportUnknown(client, 'RecentlyPlayed', raw, model);
    return model;
  }
}

/** The payload of a {@link MixEntity} (`landing/block/mixes`). */
export class MixEntityData extends YandexMusicModel {
  /** Mix id. */
  id?: string;
  /** Mix title. */
  title?: string;
  /** Tap action (raw JSON, pending a typed model). */
  action?: JSONValue;
  /** Visual style (raw JSON, pending a typed model). */
  style?: JSONValue;
  /** Cover image URIs. */
  covers?: string[];

  /** @see {@link MixEntityData} */
  static deJson(raw: JSONValue | undefined, client?: Client): MixEntityData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MixEntityData(client);
    assign(model, raw, ['id', 'title', 'action', 'style', 'covers']);
    reportUnknown(client, 'MixEntityData', raw, model);
    return model;
  }
}

/** A single personalized mix card. */
export class MixEntity extends YandexMusicModel {
  /** Entity type. */
  type?: string;
  /** The mix payload. */
  data?: MixEntityData;

  /** @see {@link MixEntity} */
  static deJson(raw: JSONValue | undefined, client?: Client): MixEntity | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MixEntity(client);
    assign(model, raw, ['type']);
    model.data = MixEntityData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'MixEntity', raw, model);
    return model;
  }
}

/** The "mixes" landing block (`landing/block/mixes`). */
export class Mixes extends YandexMusicModel {
  /** The mix cards. */
  items?: MixEntity[];

  /** @see {@link Mixes} */
  static deJson(raw: JSONValue | undefined, client?: Client): Mixes | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Mixes(client);
    model.items = deList(MixEntity.deJson, raw['items'], client);
    reportUnknown(client, 'Mixes', raw, model);
    return model;
  }
}

/** A single item of {@link UniversalScreenEntitiesPage}. */
export class UniversalEntity extends YandexMusicModel {
  /**
   * Entity type.
   *
   * @remarks The API's `UniversalEntityDto` is a polymorphic base class with only
   * `type` in the base — per-type fields remain unmapped raw JSON.
   */
  type?: string;

  /** @see {@link UniversalEntity} */
  static deJson(raw: JSONValue | undefined, client?: Client): UniversalEntity | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new UniversalEntity(client);
    assign(model, raw, ['type']);
    reportUnknown(client, 'UniversalEntity', raw, model);
    return model;
  }
}

/** A page of generic landing-block entities (`landing/block/{blockId}/entities`,
 * `landing-blocks/entities/tag/{metaTagId}/block/{metaTagType}`). */
export class UniversalScreenEntitiesPage extends YandexMusicModel {
  /** Page title. */
  title?: string;
  /** The page items. */
  items?: UniversalEntity[];

  /** @see {@link UniversalScreenEntitiesPage} */
  static deJson(raw: JSONValue | undefined, client?: Client): UniversalScreenEntitiesPage | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new UniversalScreenEntitiesPage(client);
    assign(model, raw, ['title']);
    model.items = deList(UniversalEntity.deJson, raw['items'], client);
    reportUnknown(client, 'UniversalScreenEntitiesPage', raw, model);
    return model;
  }
}

/** The combined "continue listening" block (`landing-blocks/non-music/continue-listen`). */
export class ContinueListenBlock extends YandexMusicModel {
  /** Bookshelf entity (raw JSON, pending a typed model). */
  bookshelf?: JSONValue;
  /** New-episodes entity (raw JSON, pending a typed model). */
  newEpisodes?: JSONValue;
  /** Last-played entity (raw JSON, pending a typed model). */
  lastPlayed?: JSONValue;

  /** @see {@link ContinueListenBlock} */
  static deJson(raw: JSONValue | undefined, client?: Client): ContinueListenBlock | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ContinueListenBlock(client);
    assign(model, raw, ['bookshelf', 'newEpisodes', 'lastPlayed']);
    reportUnknown(client, 'ContinueListenBlock', raw, model);
    return model;
  }
}

/** A personalized recap slideshow (`recap-slides/user`, `/kids`, `/artist/{id}`). */
export class RecapSlides extends YandexMusicModel {
  /** Logo image URI. */
  logo?: string;
  /** The slides (raw JSON — each has `id`, `background`, `content`, `trailer`, `meta`; presentation-only payload). */
  slides?: JSONValue;

  /** @see {@link RecapSlides} */
  static deJson(raw: JSONValue | undefined, client?: Client): RecapSlides | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RecapSlides(client);
    assign(model, raw, ['logo', 'slides']);
    reportUnknown(client, 'RecapSlides', raw, model);
    return model;
  }
}

/** A chart page (backed by a playlist of ranked tracks). */
export class ChartInfo extends YandexMusicModel {
  /** Chart id. */
  id?: string;
  /** Chart type. */
  type?: string;
  /** Origin tag used in `from` parameters. */
  typeForFrom?: string;
  /** Chart title. */
  title?: string;
  /** Chart menu (raw JSON, pending a typed model). */
  menu?: JSONValue;
  /** The playlist backing the chart. */
  chart?: Playlist;
  /** Chart description. */
  chartDescription?: string;

  /** @see {@link ChartInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): ChartInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ChartInfo(client);
    assign(model, raw, ['id', 'type', 'typeForFrom', 'title', 'menu', 'chartDescription']);
    model.chart = Playlist.deJson(raw['chart'], client) ?? undefined;
    reportUnknown(client, 'ChartInfo', raw, model);
    return model;
  }
}
