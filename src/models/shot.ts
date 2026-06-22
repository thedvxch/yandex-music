/**
 * Alice "shot" models played between tracks.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** The type/category of an Alice shot. */
export class ShotType extends YandexMusicModel {
  /** Type id. */
  id?: string;
  /** Type title. */
  title?: string;

  /** @see {@link ShotType} */
  static deJson(raw: JSONValue | undefined, client?: Client): ShotType | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ShotType(client);
    assign(model, raw, ['id', 'title']);
    return model;
  }
}

/** The payload of an Alice shot (cover, audio and text). */
export class ShotData extends YandexMusicModel {
  /** Cover URI template. */
  coverUri?: string;
  /** Audio URL. */
  mdsUrl?: string;
  /** Spoken text. */
  shotText?: string;
  /** Shot type. */
  shotType?: ShotType;

  /** @see {@link ShotData} */
  static deJson(raw: JSONValue | undefined, client?: Client): ShotData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ShotData(client);
    assign(model, raw, ['coverUri', 'mdsUrl', 'shotText']);
    model.shotType = ShotType.deJson(raw['shotType'], client) ?? undefined;
    return model;
  }
}

/** An Alice shot (a short spoken segment between tracks). */
export class Shot extends YandexMusicModel {
  /** Playback order. */
  order?: number;
  /** Whether already played. */
  played?: boolean;
  /** Shot payload. */
  shotData?: ShotData;
  /** Shot id. */
  shotId?: string;
  /** Shot status. */
  status?: string;

  /** @see {@link Shot} */
  static deJson(raw: JSONValue | undefined, client?: Client): Shot | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Shot(client);
    assign(model, raw, ['order', 'played', 'shotId', 'status']);
    model.shotData = ShotData.deJson(raw['shotData'], client) ?? undefined;
    return model;
  }
}

/** An event carrying Alice shots to play after a track. */
export class ShotEvent extends YandexMusicModel {
  /** Event id. */
  eventId?: string;
  /** The shots to play. */
  shots?: Shot[];

  /** @see {@link ShotEvent} */
  static deJson(raw: JSONValue | undefined, client?: Client): ShotEvent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ShotEvent(client);
    assign(model, raw, ['eventId']);
    model.shots = deList(Shot.deJson, raw['shots'], client);
    return model;
  }
}
