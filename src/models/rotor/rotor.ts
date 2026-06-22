/**
 * Rotor (radio) models.
 *
 * @remarks
 * Station settings, restrictions and ad params are exposed as raw JSON for now;
 * the structural models needed to browse stations and stream their tracks
 * ({@link Dashboard}, {@link StationResult}, {@link StationTracksResult}) are typed.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { Icon } from '../common.js';
import { Track } from '../track/track.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A typed identifier of a rotor station (`{type}:{tag}`). */
export class Id extends YandexMusicModel {
  /** Station type, for example `genre` or `user`. */
  type?: string;
  /** Station tag within the type. */
  tag?: string;

  /** @see {@link Id} */
  static deJson(raw: JSONValue | undefined, client?: Client): Id | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Id(client);
    assign(model, raw, ['type', 'tag']);
    return model;
  }
}

/** A rotor station descriptor. */
export class Station extends YandexMusicModel {
  /** Station id. */
  id?: Id;
  /** Station name. */
  name?: string;
  /** Station icon. */
  icon?: Icon;
  /** MTS-branded icon. */
  mtsIcon?: Icon;
  /** Geocell icon. */
  geocellIcon?: Icon;
  /** Origin tag used in `from` parameters. */
  idForFrom?: string;
  /** Playback restrictions (raw JSON, pending a typed model). */
  restrictions?: JSONValue;
  /** Full image URL. */
  fullImageUrl?: string;
  /** MTS full image URL. */
  mtsFullImageUrl?: string;
  /** Parent station id. */
  parentId?: Id;

  /** @see {@link Station} */
  static deJson(raw: JSONValue | undefined, client?: Client): Station | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Station(client);
    assign(model, raw, ['name', 'idForFrom', 'restrictions', 'fullImageUrl', 'mtsFullImageUrl']);
    model.id = Id.deJson(raw['id'], client) ?? undefined;
    model.icon = Icon.deJson(raw['icon'], client) ?? undefined;
    model.mtsIcon = Icon.deJson(raw['mtsIcon'], client) ?? undefined;
    model.geocellIcon = Icon.deJson(raw['geocellIcon'], client) ?? undefined;
    model.parentId = Id.deJson(raw['parentId'], client) ?? undefined;
    return model;
  }
}

/** A station together with its settings and ad parameters. */
export class StationResult extends YandexMusicModel {
  /** The station. */
  station?: Station;
  /** Station settings (raw JSON, pending a typed model). */
  settings?: JSONValue;
  /** Ad parameters (raw JSON, pending a typed model). */
  adParams?: JSONValue;
  /** Explanation text. */
  explanation?: string;
  /** Prerolls (raw JSON). */
  prerolls?: JSONValue;
  /** "Rup" title. */
  rupTitle?: string;
  /** "Rup" description. */
  rupDescription?: string;
  /** Custom display name. */
  customName?: string;

  /** @see {@link StationResult} */
  static deJson(raw: JSONValue | undefined, client?: Client): StationResult | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new StationResult(client);
    assign(model, raw, ['settings', 'adParams', 'explanation', 'prerolls', 'rupTitle', 'rupDescription', 'customName']);
    model.station = Station.deJson(raw['station'], client) ?? undefined;
    return model;
  }
}

/** The personalized list of rotor stations. */
export class Dashboard extends YandexMusicModel {
  /** Dashboard id. */
  dashboardId?: string;
  /** The available stations. */
  stations?: StationResult[];
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;

  /** @see {@link Dashboard} */
  static deJson(raw: JSONValue | undefined, client?: Client): Dashboard | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Dashboard(client);
    assign(model, raw, ['dashboardId', 'pumpkin']);
    model.stations = deList(StationResult.deJson, raw['stations'], client);
    return model;
  }
}

/** One track in a station's playback sequence. */
export class Sequence extends YandexMusicModel {
  /** Sequence item type, for example `track`. */
  type?: string;
  /** The track. */
  track?: Track;
  /** Whether the user has liked the track. */
  liked?: boolean;

  /** @see {@link Sequence} */
  static deJson(raw: JSONValue | undefined, client?: Client): Sequence | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Sequence(client);
    assign(model, raw, ['type', 'liked']);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    return model;
  }
}

/** A batch of tracks streamed from a rotor station. */
export class StationTracksResult extends YandexMusicModel {
  /** Station id. */
  id?: Id;
  /** The track sequence. */
  sequence?: Sequence[];
  /** Batch id (echoed back as `queue` when requesting the next batch). */
  batchId?: string;
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;

  /** @see {@link StationTracksResult} */
  static deJson(raw: JSONValue | undefined, client?: Client): StationTracksResult | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new StationTracksResult(client);
    assign(model, raw, ['batchId', 'pumpkin']);
    model.id = Id.deJson(raw['id'], client) ?? undefined;
    model.sequence = deList(Sequence.deJson, raw['sequence'], client);
    return model;
  }
}
