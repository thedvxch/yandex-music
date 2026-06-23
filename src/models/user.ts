/**
 * The {@link User} model (playlist owner / search result).
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A Yandex Music user (for example a playlist owner). */
export class User extends YandexMusicModel {
  /** User uid. */
  uid?: number;
  /** Login. */
  login?: string;
  /** Account name. */
  name?: string;
  /** Display name. */
  displayName?: string;
  /** Full name. */
  fullName?: string;
  /** Reported sex. */
  sex?: string;
  /** Whether the user is verified. */
  verified?: boolean;
  /** Region codes. */
  regions?: number[];

  /** @see {@link User} */
  static deJson(raw: JSONValue | undefined, client?: Client): User | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new User(client);
    assign(model, raw, ['uid', 'login', 'name', 'displayName', 'fullName', 'sex', 'verified', 'regions']);
    reportUnknown(client, 'User', raw, model);
    return model;
  }
}
