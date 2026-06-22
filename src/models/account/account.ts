/**
 * Account status models.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
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
    ]);
    model.passportPhones = deList(PassportPhone.deJson, raw['passportPhones'], client);
    return model;
  }
}

/**
 * Aggregated account status returned by `account/status`.
 *
 * @remarks
 * Some sub-objects (`permissions`, `subscription`, `plus`, `stationData`,
 * `barBelow`) are exposed as raw JSON for now and will be promoted to typed
 * models in a later release. The typed {@link Status.account} is sufficient to
 * drive {@link Client.init}.
 */
export class Status extends YandexMusicModel {
  /** Account info. */
  account?: Account;
  /** Permissions (raw JSON, pending a typed model). */
  permissions?: JSONValue;
  /** Advertisement payload. */
  advertisement?: string;
  /** Subscription info (raw JSON, pending a typed model). */
  subscription?: JSONValue;
  /** Offline cache track limit. */
  cacheLimit?: number;
  /** Whether the user is a sub-editor. */
  subeditor?: boolean;
  /** Sub-editor level. */
  subeditorLevel?: number;
  /** Yandex Plus info (raw JSON, pending a typed model). */
  plus?: JSONValue;
  /** Default email. */
  defaultEmail?: string;
  /** Allowed skips per hour. */
  skipsPerHour?: number;
  /** Whether a personal station exists. */
  stationExists?: boolean;
  /** Station data (raw JSON, pending a typed model). */
  stationData?: JSONValue;
  /** Bar-below alert (raw JSON, pending a typed model). */
  barBelow?: JSONValue;
  /** Premium region. */
  premiumRegion?: number;
  /** Experiment bucket. */
  experiment?: number;
  /** Whether a pre-trial is active. */
  pretrialActive?: boolean;
  /** User hash. */
  userhash?: string;

  /** @see {@link Status} */
  static deJson(raw: JSONValue | undefined, client?: Client): Status | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Status(client);
    assign(model, raw, [
      'permissions',
      'advertisement',
      'subscription',
      'cacheLimit',
      'subeditor',
      'subeditorLevel',
      'plus',
      'defaultEmail',
      'skipsPerHour',
      'stationExists',
      'stationData',
      'barBelow',
      'premiumRegion',
      'experiment',
      'pretrialActive',
      'userhash',
    ]);
    model.account = Account.deJson(raw['account'], client) ?? undefined;
    return model;
  }
}
