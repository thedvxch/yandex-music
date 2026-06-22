/**
 * Landing-page models.
 *
 * @remarks
 * The landing blocks carry heterogeneous payloads. The strongly-typed entry
 * points ({@link Landing}, {@link ChartInfo}, {@link LandingList}) are modeled
 * here; the polymorphic `data` of a {@link BlockEntity} and a few menu/promo
 * sub-objects are exposed as raw JSON for now.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { Track } from '../track/track.js';
import { TrackId } from '../trackShort.js';
import { Playlist } from '../playlist/playlist.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A single item inside a landing block (album, playlist, promotion, …). */
export class BlockEntity extends YandexMusicModel {
  /** Entity id. */
  id?: string;
  /** Entity type (drives the shape of `data`). */
  type?: string;
  /** The polymorphic entity payload (raw JSON, pending typed variants). */
  data?: JSONValue;

  /** @see {@link BlockEntity} */
  static deJson(raw: JSONValue | undefined, client?: Client): BlockEntity | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new BlockEntity(client);
    assign(model, raw, ['id', 'type', 'data']);
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

  /** @see {@link Block} */
  static deJson(raw: JSONValue | undefined, client?: Client): Block | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Block(client);
    assign(model, raw, ['id', 'type', 'typeForFrom', 'title', 'description', 'data']);
    model.entities = deList(BlockEntity.deJson, raw['entities'], client);
    return model;
  }
}

/** A landing page: an ordered list of blocks. */
export class Landing extends YandexMusicModel {
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;
  /** Content id of the landing. */
  contentId?: string | number;
  /** The page blocks. */
  blocks?: Block[];

  /** @see {@link Landing} */
  static deJson(raw: JSONValue | undefined, client?: Client): Landing | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Landing(client);
    assign(model, raw, ['pumpkin', 'contentId']);
    model.blocks = deList(Block.deJson, raw['blocks'], client);
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
    return model;
  }
}
