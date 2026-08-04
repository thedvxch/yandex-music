/**
 * Rotor (radio) models.
 *
 * @remarks
 * Station {@link Restrictions} and {@link AdParams} are typed; per-station free-form
 * settings remain raw JSON.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
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
  /** Image URL (rich restriction values: moods, activities). */
  imageUrl?: string;
  /** Serialized seed used to start a wave from this value. */
  serializedSeed?: string;
  /** Whether this value represents the "unspecified" option. */
  unspecified?: boolean;

  /** @see {@link Value} */
  static deJson(raw: JSONValue | undefined, client?: Client): Value | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Value(client);
    assign(model, raw, ['value', 'name', 'imageUrl', 'serializedSeed', 'unspecified']);
    reportUnknown(client, 'Value', raw, model);
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
    reportUnknown(client, 'Enum', raw, model);
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
    reportUnknown(client, 'DiscreteScale', raw, model);
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
    reportUnknown(client, 'Restrictions', raw, model);
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
    reportUnknown(client, 'AdParams', raw, model);
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
    reportUnknown(client, 'Id', raw, model);
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
  /** Newer playback restrictions (enum-typed personalization options). */
  restrictions2?: Restrictions;
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
    model.restrictions2 = Restrictions.deJson(raw['restrictions2'], client) ?? undefined;
    model.id = Id.deJson(raw['id'], client) ?? undefined;
    model.icon = Icon.deJson(raw['icon'], client) ?? undefined;
    model.mtsIcon = Icon.deJson(raw['mtsIcon'], client) ?? undefined;
    model.geocellIcon = Icon.deJson(raw['geocellIcon'], client) ?? undefined;
    model.parentId = Id.deJson(raw['parentId'], client) ?? undefined;
    reportUnknown(client, 'Station', raw, model);
    return model;
  }
}

/** The selected personalization settings of a station (the `settings` /
 * `settings2` payloads share these fields). */
export class StationSettings extends YandexMusicModel {
  /** Selected language filter (for example `any`). */
  language?: string;
  /** Selected mood (legacy numeric scale, `settings`). */
  mood?: number;
  /** Selected energy (legacy numeric scale, `settings`). */
  energy?: number;
  /** Selected mood/energy preset (`settings2`, for example `all`). */
  moodEnergy?: string;
  /** Selected diversity (for example `default`). */
  diversity?: string;

  /** @see {@link StationSettings} */
  static deJson(raw: JSONValue | undefined, client?: Client): StationSettings | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new StationSettings(client);
    assign(model, raw, ['language', 'mood', 'energy', 'moodEnergy', 'diversity']);
    reportUnknown(client, 'StationSettings', raw, model);
    return model;
  }
}

/** A station together with its settings and ad parameters. */
export class StationResult extends YandexMusicModel {
  /** The station. */
  station?: Station;
  /** Station personalization settings. */
  settings?: StationSettings;
  /** Newer station personalization settings payload. */
  settings2?: StationSettings;
  /** Ad parameters. */
  adParams?: AdParams;
  /** Explanation text. */
  explanation?: string;
  /** Prerolls (free-form raw JSON, ad payload). */
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
    assign(model, raw, ['explanation', 'prerolls', 'rupTitle', 'rupDescription', 'customName']);
    model.station = Station.deJson(raw['station'], client) ?? undefined;
    model.settings = StationSettings.deJson(raw['settings'], client) ?? undefined;
    model.settings2 = StationSettings.deJson(raw['settings2'], client) ?? undefined;
    model.adParams = AdParams.deJson(raw['adParams'], client) ?? undefined;
    reportUnknown(client, 'StationResult', raw, model);
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
    reportUnknown(client, 'Dashboard', raw, model);
    return model;
  }
}

/** One track in a station's playback sequence. */
/** Acoustic parameters of a track within a radio sequence. */
export class TrackParameters extends YandexMusicModel {
  /** Beats per minute. */
  bpm?: number;
  /** Cover-derived hue. */
  hue?: number;
  /** Energy level. */
  energy?: number;

  /** @see {@link TrackParameters} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackParameters | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackParameters(client);
    assign(model, raw, ['bpm', 'hue', 'energy']);
    reportUnknown(client, 'TrackParameters', raw, model);
    return model;
  }
}

export class Sequence extends YandexMusicModel {
  /** Sequence item type, for example `track`. */
  type?: string;
  /** The track. */
  track?: Track;
  /** Whether the user has liked the track. */
  liked?: boolean;
  /** Acoustic parameters of the track in this sequence. */
  trackParameters?: TrackParameters;

  /** @see {@link Sequence} */
  static deJson(raw: JSONValue | undefined, client?: Client): Sequence | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Sequence(client);
    assign(model, raw, ['type', 'liked']);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    model.trackParameters = TrackParameters.deJson(raw['trackParameters'], client) ?? undefined;
    reportUnknown(client, 'Sequence', raw, model);
    return model;
  }
}

/** The default ("My Wave") station returned by `rotor/wave/settings`. */
export class WaveDefaultStation extends YandexMusicModel {
  /** Station id, in `type:tag` string form (for example `user:12345`). */
  stationId?: string;
  /** Display title. */
  title?: string;
  /** "Rup" title. */
  rupTitle?: string;
  /** "Rup" description. */
  rupDescription?: string;

  /** @see {@link WaveDefaultStation} */
  static deJson(raw: JSONValue | undefined, client?: Client): WaveDefaultStation | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new WaveDefaultStation(client);
    assign(model, raw, ['stationId', 'title', 'rupTitle', 'rupDescription']);
    reportUnknown(client, 'WaveDefaultStation', raw, model);
    return model;
  }
}

/** The personalization restrictions exposed for the "My Wave" station. */
export class WaveSettingRestrictions extends YandexMusicModel {
  /** Track diversity options. */
  diversity?: Enum;
  /** Mood/energy options. */
  moodEnergy?: Enum;
  /** Language options. */
  language?: Enum;

  /** @see {@link WaveSettingRestrictions} */
  static deJson(raw: JSONValue | undefined, client?: Client): WaveSettingRestrictions | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new WaveSettingRestrictions(client);
    model.diversity = Enum.deJson(raw['diversity'], client) ?? undefined;
    model.moodEnergy = Enum.deJson(raw['moodEnergy'], client) ?? undefined;
    model.language = Enum.deJson(raw['language'], client) ?? undefined;
    reportUnknown(client, 'WaveSettingRestrictions', raw, model);
    return model;
  }
}

/** Settings and personalization options for the "My Wave" station (`rotor/wave/settings`). */
export class WaveSettings extends YandexMusicModel {
  /** The default station to start when the user opens "My Wave". */
  defaultStation?: WaveDefaultStation;
  /** Landing blocks shown above the settings (raw JSON, pending a typed model). */
  blocks?: JSONValue;
  /** The available personalization restrictions. */
  settingRestrictions?: WaveSettingRestrictions;

  /** @see {@link WaveSettings} */
  static deJson(raw: JSONValue | undefined, client?: Client): WaveSettings | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new WaveSettings(client);
    assign(model, raw, ['blocks']);
    model.defaultStation = WaveDefaultStation.deJson(raw['defaultStation'], client) ?? undefined;
    model.settingRestrictions = WaveSettingRestrictions.deJson(raw['settingRestrictions'], client) ?? undefined;
    reportUnknown(client, 'WaveSettings', raw, model);
    return model;
  }
}

/** A "Wave" station descriptor (`rotor/wave/last`, and nested in {@link RotorSession}). */
export class WaveInfo extends YandexMusicModel {
  /** Display name. */
  name?: string;
  /** Station id, in `type:tag` string form (for example `user:onyourwave`). */
  stationId?: string;
  /** Seed ids the wave was started from. */
  seeds?: string[];
  /** Origin tag used in `from` parameters. */
  idForFrom?: string;
  /** Description. */
  description?: string;
  /** Promo payload (raw JSON, pending a typed model). */
  promo?: JSONValue;
  /** Wave type (for example `DEFAULT`). */
  type?: string;

  /** @see {@link WaveInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): WaveInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new WaveInfo(client);
    assign(model, raw, ['name', 'stationId', 'seeds', 'idForFrom', 'description', 'promo', 'type']);
    reportUnknown(client, 'WaveInfo', raw, model);
    return model;
  }
}

/** A rotor listening session (`rotor/session/new`). */
export class RotorSession extends YandexMusicModel {
  /** Session id. */
  id?: string;
  /** Seeds accepted so far. */
  acceptedSeeds?: string[];
  /** Seeds the session was originally started with. */
  originalSeeds?: string[];
  /** Whether explicit content is allowed. */
  allowExplicit?: boolean;
  /** Whether this is a child-safe session. */
  child?: boolean;
  /** Creation timestamp (ISO 8601). */
  createdAt?: string;
  /** Last access timestamp (ISO 8601). */
  lastAccess?: string;
  /** Seed description (for example `user:onyourwave`). */
  descriptionSeed?: string;
  /** Whether the session is incognito. */
  incognito?: boolean;
  /** Session type (for example `track`). */
  sessionType?: string;
  /** Whether the session has been terminated. */
  terminated?: boolean;
  /** The wave the session is playing. */
  wave?: WaveInfo;

  /** @see {@link RotorSession} */
  static deJson(raw: JSONValue | undefined, client?: Client): RotorSession | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RotorSession(client);
    assign(model, raw, [
      'id',
      'acceptedSeeds',
      'originalSeeds',
      'allowExplicit',
      'child',
      'createdAt',
      'lastAccess',
      'descriptionSeed',
      'incognito',
      'sessionType',
      'terminated',
    ]);
    model.wave = WaveInfo.deJson(raw['wave'], client) ?? undefined;
    reportUnknown(client, 'RotorSession', raw, model);
    return model;
  }
}

/** A batch of tracks from a combined rotor session (`rotor/combined/session/new`). */
export class CombinedSession extends YandexMusicModel {
  /** Session id. */
  sessionId?: string;
  /** Batch id (echoed back when requesting the next batch). */
  batchId?: string;
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;
  /** The track batch (raw JSON, pending a typed model). */
  list?: JSONValue;

  /** @see {@link CombinedSession} */
  static deJson(raw: JSONValue | undefined, client?: Client): CombinedSession | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CombinedSession(client);
    assign(model, raw, ['sessionId', 'batchId', 'pumpkin', 'list']);
    reportUnknown(client, 'CombinedSession', raw, model);
    return model;
  }
}

/** The offline recommendation source list (`rotor/get-offline-recommender`). */
export class OfflineRecommender extends YandexMusicModel {
  /** Recommender sources (raw JSON, pending a typed model). */
  offlineRecommenderSource?: JSONValue;

  /** @see {@link OfflineRecommender} */
  static deJson(raw: JSONValue | undefined, client?: Client): OfflineRecommender | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new OfflineRecommender(client);
    assign(model, raw, ['offlineRecommenderSource']);
    reportUnknown(client, 'OfflineRecommender', raw, model);
    return model;
  }
}

/** A cloned rotor session together with its first track batch (`rotor/session/{id}/clone`). */
export class ClonedSession extends YandexMusicModel {
  /** New session id, used for subsequent `rotor/*` calls. */
  radioSessionId?: string;
  /** Batch id (echoed back when requesting the next batch). */
  batchId?: string;
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;
  /** Seeds accepted so far (raw JSON — object shape differs from {@link RotorSession.acceptedSeeds}). */
  acceptedSeeds?: JSONValue;
  /** Seed description (raw JSON — object shape differs from {@link RotorSession.descriptionSeed}). */
  descriptionSeed?: JSONValue;
  /** The first track batch. */
  sequence?: Sequence[];

  /** @see {@link ClonedSession} */
  static deJson(raw: JSONValue | undefined, client?: Client): ClonedSession | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ClonedSession(client);
    assign(model, raw, ['radioSessionId', 'batchId', 'pumpkin', 'acceptedSeeds', 'descriptionSeed']);
    model.sequence = deList(Sequence.deJson, raw['sequence'], client);
    reportUnknown(client, 'ClonedSession', raw, model);
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
  /** Radio session id, used for rotor feedback. */
  radioSessionId?: string;

  /** @see {@link StationTracksResult} */
  static deJson(raw: JSONValue | undefined, client?: Client): StationTracksResult | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new StationTracksResult(client);
    assign(model, raw, ['batchId', 'pumpkin', 'radioSessionId']);
    model.id = Id.deJson(raw['id'], client) ?? undefined;
    model.sequence = deList(Sequence.deJson, raw['sequence'], client);
    reportUnknown(client, 'StationTracksResult', raw, model);
    return model;
  }
}
