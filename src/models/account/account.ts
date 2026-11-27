/**
 * Account status models.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Artist } from '../artist/artist.js';
import { Permissions, Plus, Subscription } from './subscription.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A phone number attached to a Yandex passport account. */
export class PassportPhone extends YandexMusicModel {
  /** The phone number. */
  phone?: string;

  /** @see {@link PassportPhone} */
  static deJson(raw: JSONValue | undefined, client?: Client): PassportPhone | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PassportPhone(client);
    assign(model, raw, ['phone']);
    reportUnknown(client, 'PassportPhone', raw, model);
    return model;
  }
}

/** Information about the authenticated account. */
export class Account extends YandexMusicModel {
  /** Server timestamp of the response. */
  now?: string;
  /** Whether the music service is available for the account. */
  serviceAvailable?: boolean;
  /** Region code. */
  region?: number;
  /** Account uid. */
  uid?: number;
  /** Login. */
  login?: string;
  /** Full name. */
  fullName?: string;
  /** Second name. */
  secondName?: string;
  /** First name. */
  firstName?: string;
  /** Display name. */
  displayName?: string;
  /** Whether this is a hosted (organization) user. */
  hostedUser?: boolean;
  /** Birthday (ISO date). */
  birthday?: string;
  /** Phone numbers on the passport. */
  passportPhones?: PassportPhone[];
  /** Registration timestamp. */
  registeredAt?: string;
  /** Whether AppMetrica info is available. */
  hasInfoForAppMetrica?: boolean;
  /** Whether this is a child account. */
  child?: boolean;
  /** Region code. */
  regionCode?: string;
  /** Whether the account is a non-owner family-plan member. */
  nonOwnerFamilyMember?: boolean;

  /** @see {@link Account} */
  static deJson(raw: JSONValue | undefined, client?: Client): Account | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Account(client);
    assign(model, raw, [
      'now',
      'serviceAvailable',
      'region',
      'uid',
      'login',
      'fullName',
      'secondName',
      'firstName',
      'displayName',
      'hostedUser',
      'birthday',
      'registeredAt',
      'hasInfoForAppMetrica',
      'child',
      'regionCode',
      'nonOwnerFamilyMember',
    ]);
    model.passportPhones = deList(PassportPhone.deJson, raw['passportPhones'], client);
    reportUnknown(client, 'Account', raw, model);
    return model;
  }
}

/** Subscription overview returned by `account/about`. */
export class About extends YandexMusicModel {
  /** Whether the account has Yandex Plus. */
  hasPlus?: boolean;
  /** Whether the account has a Music subscription. */
  hasMusicSubscription?: boolean;
  /** Whether this is a child account. */
  isChild?: boolean;
  /** Available purchase options (raw JSON, pending a typed model). */
  options?: JSONValue;
  /** Whether the music service is available for the account. */
  serviceAvailable?: boolean;
  /** ISO 3166 code of the region the request was geolocated to (for example `RU`). */
  geoRegionIso?: string;
  /** ISO 3166 code of the region of the user's session. */
  userSessionRegionIso?: string;

  /** @see {@link About} */
  static deJson(raw: JSONValue | undefined, client?: Client): About | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new About(client);
    assign(model, raw, ['hasPlus', 'hasMusicSubscription', 'isChild', 'options', 'serviceAvailable', 'geoRegionIso', 'userSessionRegionIso']);
    reportUnknown(client, 'About', raw, model);
    return model;
  }
}

/** An artist's standing within {@link TopArtistsMonth} (`personal/top/artists/month`). */
export class TopPosition extends YandexMusicModel {
  /** Rank (1-based). */
  position?: number;
  /** Movement description (for example `same`). */
  progress?: string;

  /** @see {@link TopPosition} */
  static deJson(raw: JSONValue | undefined, client?: Client): TopPosition | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TopPosition(client);
    assign(model, raw, ['position', 'progress']);
    reportUnknown(client, 'TopPosition', raw, model);
    return model;
  }
}

/** One artist's monthly listening stats within {@link TopArtistsMonth}. */
export class TopArtistEntry extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** Total seconds listened this month. */
  listenTimeSeconds?: number;
  /** The artist's rank. */
  top?: TopPosition;

  /** @see {@link TopArtistEntry} */
  static deJson(raw: JSONValue | undefined, client?: Client): TopArtistEntry | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TopArtistEntry(client);
    assign(model, raw, ['listenTimeSeconds']);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.top = TopPosition.deJson(raw['top'], client) ?? undefined;
    reportUnknown(client, 'TopArtistEntry', raw, model);
    return model;
  }
}

/** The user's most-listened artists this month (`personal/top/artists/month`). */
export class TopArtistsMonth extends YandexMusicModel {
  /** The ranked artists. */
  artists?: TopArtistEntry[];

  /** @see {@link TopArtistsMonth} */
  static deJson(raw: JSONValue | undefined, client?: Client): TopArtistsMonth | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TopArtistsMonth(client);
    model.artists = deList(TopArtistEntry.deJson, raw['artists'], client);
    reportUnknown(client, 'TopArtistsMonth', raw, model);
    return model;
  }
}

/** The result of a library sync (`collection/sync`). */
export class CollectionSync extends YandexMusicModel {
  /** Synced values (raw JSON, pending a typed model). */
  values?: JSONValue;

  /** @see {@link CollectionSync} */
  static deJson(raw: JSONValue | undefined, client?: Client): CollectionSync | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CollectionSync(client);
    assign(model, raw, ['values']);
    reportUnknown(client, 'CollectionSync', raw, model);
    return model;
  }
}

/** A button inside an {@link Alert}. */
export class AlertButton extends YandexMusicModel {
  /** Button text. */
  text?: string;
  /** Background colour. */
  bgColor?: string;
  /** Text colour. */
  textColor?: string;
  /** Link the button leads to. */
  uri?: string;

  /** @see {@link AlertButton} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlertButton | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlertButton(client);
    assign(model, raw, ['text', 'bgColor', 'textColor', 'uri']);
    reportUnknown(client, 'AlertButton', raw, model);
    return model;
  }
}

/** A warning block (subscription ending, gifts) shown below the player bar. */
export class Alert extends YandexMusicModel {
  /** Unique id. */
  alertId?: string;
  /** Alert text. */
  text?: string;
  /** Background colour. */
  bgColor?: string;
  /** Text colour. */
  textColor?: string;
  /** Alert type. */
  alertType?: string;
  /** Link button. */
  button?: AlertButton;
  /** Whether a "Close" button is shown. */
  closeButton?: boolean;

  /** @see {@link Alert} */
  static deJson(raw: JSONValue | undefined, client?: Client): Alert | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Alert(client);
    assign(model, raw, ['alertId', 'text', 'bgColor', 'textColor', 'alertType', 'closeButton']);
    model.button = AlertButton.deJson(raw['button'], client) ?? undefined;
    reportUnknown(client, 'Alert', raw, model);
    return model;
  }
}

/** Information about the personal station. */
export class StationData extends YandexMusicModel {
  /** Station name. */
  name?: string;

  /** @see {@link StationData} */
  static deJson(raw: JSONValue | undefined, client?: Client): StationData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new StationData(client);
    assign(model, raw, ['name']);
    reportUnknown(client, 'StationData', raw, model);
    return model;
  }
}

/**
 * Aggregated account status returned by `account/status`.
 *
 * @remarks
 * `masterhub` remains raw JSON; `permissions`, `subscription`, `plus`,
 * `stationData` and `barBelow` are typed.
 */
export class Status extends YandexMusicModel {
  /** Account info. */
  account?: Account;
  /** Granted permissions. */
  permissions?: Permissions;
  /** Advertisement payload. */
  advertisement?: string;
  /** Subscription state. */
  subscription?: Subscription;
  /** Offline cache track limit. */
  cacheLimit?: number;
  /** Whether the user is a sub-editor. */
  subeditor?: boolean;
  /** Sub-editor level. */
  subeditorLevel?: number;
  /** Yandex Plus status. */
  plus?: Plus;
  /** Default email. */
  defaultEmail?: string;
  /** Allowed skips per hour. */
  skipsPerHour?: number;
  /** Whether a personal station exists. */
  stationExists?: boolean;
  /** Personal station data. */
  stationData?: StationData;
  /** Bar-below alert. */
  barBelow?: Alert;
  /** Premium region. */
  premiumRegion?: number;
  /** Experiment bucket. */
  experiment?: number;
  /** Whether a pre-trial is active. */
  pretrialActive?: boolean;
  /** User hash. */
  userhash?: string;
  /** Masterhub payload (raw JSON, pending a typed model). */
  masterhub?: JSONValue;
  /** Whether the account has purchase options. */
  hasOptions?: boolean;

  /** @see {@link Status} */
  static deJson(raw: JSONValue | undefined, client?: Client): Status | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Status(client);
    assign(model, raw, [
      'advertisement',
      'cacheLimit',
      'subeditor',
      'subeditorLevel',
      'defaultEmail',
      'skipsPerHour',
      'stationExists',
      'premiumRegion',
      'experiment',
      'pretrialActive',
      'userhash',
      'masterhub',
      'hasOptions',
    ]);
    model.account = Account.deJson(raw['account'], client) ?? undefined;
    model.permissions = Permissions.deJson(raw['permissions'], client) ?? undefined;
    model.subscription = Subscription.deJson(raw['subscription'], client) ?? undefined;
    model.plus = Plus.deJson(raw['plus'], client) ?? undefined;
    model.stationData = StationData.deJson(raw['stationData'], client) ?? undefined;
    model.barBelow = Alert.deJson(raw['barBelow'], client) ?? undefined;
    reportUnknown(client, 'Status', raw, model);
    return model;
  }
}
