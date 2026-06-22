/**
 * Rotor (radio) models.
 *
 * @remarks
 * Station {@link Restrictions} and {@link AdParams} are typed; per-station free-form
 * settings remain raw JSON.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { Icon } from '../common.js';
import { Track } from '../track/track.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A single possible value of a station {@link Enum} restriction. */
export class Value extends YandexMusicModel {
  /** Value key. */
  value?: string;
  /** Human-readable name. */
  name?: string;

  /** @see {@link Value} */
  static deJson(raw: JSONValue | undefined, client?: Client): Value | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Value(client);
    assign(model, raw, ['value', 'name']);
    return model;
  }
}

/** An enumerated station restriction (a fixed set of possible values). */
export class Enum extends YandexMusicModel {
  /** Restriction type (`enum`). */
  type?: string;
  /** Restriction name. */
  name?: string;
  /** The possible values. */
  possibleValues?: Value[];

  /** @see {@link Enum} */
  static deJson(raw: JSONValue | undefined, client?: Client): Enum | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Enum(client);
    assign(model, raw, ['type', 'name']);
    model.possibleValues = deList(Value.deJson, raw['possibleValues'], client);
    return model;
  }
}

/** A discrete-scale station restriction (a min/max range). */
export class DiscreteScale extends YandexMusicModel {
  /** Restriction type (`discrete-scale`). */
  type?: string;
  /** Restriction name. */
  name?: string;
  /** Minimum value. */
  min?: Value;
  /** Maximum value. */
  max?: Value;

  /** @see {@link DiscreteScale} */
  static deJson(raw: JSONValue | undefined, client?: Client): DiscreteScale | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new DiscreteScale(client);
    assign(model, raw, ['type', 'name']);
    model.min = Value.deJson(raw['min'], client) ?? undefined;
    model.max = Value.deJson(raw['max'], client) ?? undefined;
    return model;
  }
}

/** The settings a station exposes for personalization. */
export class Restrictions extends YandexMusicModel {
  /** Language restriction. */
  language?: Enum;
  /** Diversity restriction. */
  diversity?: Enum;
  /** Mood restriction. */
  mood?: DiscreteScale;
  /** Energy restriction. */
  energy?: DiscreteScale;
  /** Combined mood/energy restriction. */
  moodEnergy?: Enum;

  /** @see {@link Restrictions} */
  static deJson(raw: JSONValue | undefined, client?: Client): Restrictions | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Restrictions(client);
    model.language = Enum.deJson(raw['language'], client) ?? undefined;
    model.diversity = Enum.deJson(raw['diversity'], client) ?? undefined;
    model.mood = DiscreteScale.deJson(raw['mood'], client) ?? undefined;
    model.energy = DiscreteScale.deJson(raw['energy'], client) ?? undefined;
    model.moodEnergy = Enum.deJson(raw['moodEnergy'], client) ?? undefined;
    return model;
  }
}

/** Advertisement parameters attached to a station result. */
export class AdParams extends YandexMusicModel {
  /** Partner id. */
  partnerId?: string | number;
  /** Category id. */
  categoryId?: string | number;
  /** Page reference. */
  pageRef?: string;
  /** Target reference. */
  targetRef?: string;
  /** Extra parameters (for example `user:{ID}`). */
  otherParams?: string;
  /** Ad volume. */
  adVolume?: number;
  /** Genre id. */
  genreId?: string;
  /** Genre name. */
  genreName?: string;

  /** @see {@link AdParams} */
  static deJson(raw: JSONValue | undefined, client?: Client): AdParams | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AdParams(client);
    assign(model, raw, [
      'partnerId',
      'categoryId',
      'pageRef',
      'targetRef',
      'otherParams',
      'adVolume',
      'genreId',
      'genreName',
    ]);
    return model;
  }
}

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
  /** Playback restrictions (personalization options). */
  restrictions?: Restrictions;
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
    assign(model, raw, ['name', 'idForFrom', 'fullImageUrl', 'mtsFullImageUrl']);
    model.restrictions = Restrictions.deJson(raw['restrictions'], client) ?? undefined;
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
  /** Station settings (free-form raw JSON). */
  settings?: JSONValue;
  /** Ad parameters. */
  adParams?: AdParams;
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
    assign(model, raw, ['settings', 'explanation', 'prerolls', 'rupTitle', 'rupDescription', 'customName']);
    model.station = Station.deJson(raw['station'], client) ?? undefined;
    model.adParams = AdParams.deJson(raw['adParams'], client) ?? undefined;
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
