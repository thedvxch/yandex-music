/**
 * Account settings, purchase offers, alerts and experiment models.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject } from '../../base.js';
import { Status } from './account.js';
import type { Client } from '../../client.js';
import type { JSONObject, JSONValue } from '../../types.js';

/** A user's playback and library preferences. */
export class UserSettings extends YandexMusicModel {
  /** Owner uid. */
  uid?: number;
  /** Whether Last.fm scrobbling is enabled. */
  lastFmScrobblingEnabled?: boolean;
  /** Whether shuffle is enabled. */
  shuffleEnabled?: boolean;
  /** Default playback volume (percent). */
  volumePercents?: number;
  /** Last modification timestamp. */
  modified?: string;
  /** Whether Facebook scrobbling is enabled. */
  facebookScrobblingEnabled?: boolean;
  /** Whether newly added tracks go to the top of playlists. */
  addNewTrackOnPlaylistTop?: boolean;
  /** Visibility of the user's music. */
  userMusicVisibility?: string;
  /** Visibility of the user's social activity. */
  userSocialVisibility?: string;
  /** Whether ringback tones are disabled. */
  rbtDisabled?: boolean;
  /** UI theme. */
  theme?: string;
  /** Whether promos are disabled. */
  promosDisabled?: boolean;
  /** Whether radio auto-plays. */
  autoPlayRadio?: boolean;
  /** Whether queue sync is enabled. */
  syncQueueEnabled?: boolean;
  /** Whether ads are disabled. */
  adsDisabled?: boolean;
  /** Whether Yandex Disk integration is enabled. */
  diskEnabled?: boolean;
  /** Whether Disk tracks appear in the library. */
  showDiskTracksInLibrary?: boolean;

  /** @see {@link UserSettings} */
  static deJson(raw: JSONValue | undefined, client?: Client): UserSettings | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new UserSettings(client);
    assign(model, raw, [
      'uid',
      'lastFmScrobblingEnabled',
      'shuffleEnabled',
      'volumePercents',
      'modified',
      'facebookScrobblingEnabled',
      'addNewTrackOnPlaylistTop',
      'userMusicVisibility',
      'userSocialVisibility',
      'rbtDisabled',
      'theme',
      'promosDisabled',
      'autoPlayRadio',
      'syncQueueEnabled',
      'adsDisabled',
      'diskEnabled',
      'showDiskTracksInLibrary',
    ]);
    return model;
  }
}

/** Purchase offers and payment configuration. */
export class Settings extends YandexMusicModel {
  /** In-app subscription products (raw JSON, pending a typed `Product` model). */
  inAppProducts?: JSONValue;
  /** Native subscription products (raw JSON, pending a typed `Product` model). */
  nativeProducts?: JSONValue;
  /** Web payment URL. */
  webPaymentUrl?: string;
  /** Whether promo codes are enabled. */
  promoCodesEnabled?: boolean;
  /** Monthly web payment price (raw JSON, pending a typed `Price` model). */
  webPaymentMonthProductPrice?: JSONValue;

  /** @see {@link Settings} */
  static deJson(raw: JSONValue | undefined, client?: Client): Settings | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Settings(client);
    assign(model, raw, [
      'inAppProducts',
      'nativeProducts',
      'webPaymentUrl',
      'promoCodesEnabled',
      'webPaymentMonthProductPrice',
    ]);
    return model;
  }
}

/** Permission alert messages. */
export class PermissionAlerts extends YandexMusicModel {
  /** Alert messages. */
  alerts?: string[];

  /** @see {@link PermissionAlerts} */
  static deJson(raw: JSONValue | undefined, client?: Client): PermissionAlerts | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PermissionAlerts(client);
    assign(model, raw, ['alerts']);
    return model;
  }
}

/** Result of activating a promo code. */
export class PromoCodeStatus extends YandexMusicModel {
  /** Activation status. */
  status?: string;
  /** Human-readable status description. */
  statusDesc?: string;
  /** Updated account status. */
  accountStatus?: Status;

  /** @see {@link PromoCodeStatus} */
  static deJson(raw: JSONValue | undefined, client?: Client): PromoCodeStatus | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PromoCodeStatus(client);
    assign(model, raw, ['status', 'statusDesc']);
    model.accountStatus = Status.deJson(raw['accountStatus'], client) ?? undefined;
    return model;
  }
}

/**
 * A/B experiment buckets for the account.
 *
 * The API returns a free-form map of experiment names to values, so the payload
 * is preserved verbatim in {@link Experiments.values}.
 */
export class Experiments extends YandexMusicModel {
  /** The raw experiment map (experiment name → value). */
  values?: JSONObject;

  /** @see {@link Experiments} */
  static deJson(raw: JSONValue | undefined, client?: Client): Experiments | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Experiments(client);
    model.values = raw;
    return model;
  }
}

/** Detailed A/B experiment configuration for the account. */
export class ExperimentsDetails extends YandexMusicModel {
  /** The raw detailed experiment map. */
  values?: JSONObject;

  /** @see {@link ExperimentsDetails} */
  static deJson(raw: JSONValue | undefined, client?: Client): ExperimentsDetails | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ExperimentsDetails(client);
    model.values = raw;
    return model;
  }
}
