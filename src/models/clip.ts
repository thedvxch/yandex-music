/**
 * The {@link Clip} model (short music videos) and {@link ClipsWillLike}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../base.js';
import { ContentRestrictions, Cover } from './common.js';
import { Artist } from './artist/artist.js';
import { Pager } from './pager.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A short music video ("clip"). */
export class Clip extends YandexMusicModel {
  /** Clip identifier. */
  clipId?: number;
  /** Clip title. */
  title?: string;
  /** Version label (for example "Official Video"). */
  version?: string;
  /** Player identifier. */
  playerId?: string;
  /** Stable UUID. */
  uuid?: string;
  /** Thumbnail URI. */
  thumbnail?: string;
  /** Preview stream URL. */
  previewUrl?: string;
  /** Duration in seconds. */
  duration?: number;
  /** Ids of the tracks the clip is associated with. */
  trackIds?: number[];
  /** Performing artists. */
  artists?: Artist[];
  /** Disclaimers. */
  disclaimers?: string[];
  /** Whether the clip is explicit. */
  explicit?: boolean;
  /** Cover art. */
  cover?: Cover;
  /** Content availability restrictions. */
  contentRestrictions?: ContentRestrictions;

  /** @see {@link Clip} */
  static deJson(raw: JSONValue | undefined, client?: Client): Clip | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Clip(client);
    assign(model, raw, [
      'clipId',
      'title',
      'version',
      'playerId',
      'uuid',
      'thumbnail',
      'previewUrl',
      'duration',
      'trackIds',
      'disclaimers',
      'explicit',
    ]);
    model.artists = deList(Artist.deJson, raw['artists'], client);
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.contentRestrictions = ContentRestrictions.deJson(raw['contentRestrictions'], client) ?? undefined;
    reportUnknown(client, 'Clip', raw, model);
    return model;
  }
}

/** A recommended page of clips. */
export class ClipsWillLike extends YandexMusicModel {
  /** The recommended clips. */
  clips?: Clip[];
  /** Pagination metadata. */
  pager?: Pager;

  /** @see {@link ClipsWillLike} */
  static deJson(raw: JSONValue | undefined, client?: Client): ClipsWillLike | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ClipsWillLike(client);
    model.clips = deList(Clip.deJson, raw['clips'], client);
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    reportUnknown(client, 'ClipsWillLike', raw, model);
    return model;
  }
}
