/**
 * The {@link PlaylistId} reference model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject } from '../../base.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A lightweight reference to a playlist by its owner uid and kind. */
export class PlaylistId extends YandexMusicModel {
  /** Owner user id. */
  uid?: number;
  /** Playlist kind (per-owner ordinal). */
  kind?: number;

  /** The canonical `uid:kind` playlist identifier. */
  get playlistId(): string {
    return `${this.uid}:${this.kind}`;
  }

  /** @see {@link PlaylistId} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistId | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistId(client);
    assign(model, raw, ['uid', 'kind']);
    return model;
  }
}
