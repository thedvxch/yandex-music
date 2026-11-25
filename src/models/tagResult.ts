/**
 * The {@link TagResult} model (`/tags/{tagId}/playlist-ids`).
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import { Tag } from './common.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** The playlists grouped under a tag. */
export class TagResult extends YandexMusicModel {
  /** The tag descriptor. */
  tag?: Tag;
  /** Ids of the tagged playlists (`{uid}:{kind}` strings). */
  ids?: string[];

  /** @see {@link TagResult} */
  static deJson(raw: JSONValue | undefined, client?: Client): TagResult | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TagResult(client);
    assign(model, raw, ['ids']);
    model.tag = Tag.deJson(raw['tag'], client) ?? undefined;
    reportUnknown(client, 'TagResult', raw, model);
    return model;
  }
}
