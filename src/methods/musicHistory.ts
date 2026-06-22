/**
 * Listening-history client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { MusicHistory, MusicHistoryItems } from '../models/musicHistory/musicHistory.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';
import type { JSONObject } from '../types.js';

/** The set of entity ids whose history items are requested. */
export interface MusicHistoryItemsQuery {
  /** Pairs of `[trackId, albumId]`. */
  trackIds?: Array<[string | number, string | number]>;
  /** Album ids. */
  albumIds?: Array<string | number>;
  /** Artist ids. */
  artistIds?: Array<string | number>;
  /** Pairs of `[uid, kind]`. */
  playlistIds?: Array<[string | number, string | number]>;
  /** Wave seed arrays (for example `[['user:onyourwave']]`). */
  waveSeeds?: string[][];
}

function buildHistoryItems(query: MusicHistoryItemsQuery): JSONObject[] {
  const items: JSONObject[] = [];
  for (const [trackId, albumId] of query.trackIds ?? []) {
    items.push({ type: 'track', data: { itemId: { trackId: String(trackId), albumId: String(albumId) } } });
  }
  for (const albumId of query.albumIds ?? []) {
    items.push({ type: 'album', data: { itemId: { id: String(albumId) } } });
  }
  for (const artistId of query.artistIds ?? []) {
    items.push({ type: 'artist', data: { itemId: { id: String(artistId) } } });
  }
  for (const [uid, kind] of query.playlistIds ?? []) {
    items.push({ type: 'playlist', data: { itemId: { uid: Number(uid), kind: Number(kind) } } });
  }
  for (const seeds of query.waveSeeds ?? []) {
    items.push({ type: 'wave', data: { itemId: { seeds } } });
  }
  return items;
}

/**
 * Adds listening-history endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with music-history methods.
 */
export function MusicHistoryMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class MusicHistoryMethods extends Base {
    /**
     * Fetch the user's listening history grouped by day.
     *
     * @param fullModelsCount - How many items to return with their full models inlined. Defaults to `0`.
     * @returns The listening history, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async musicHistory(fullModelsCount = 0): Promise<MusicHistory | null> {
      const url = `${this.baseUrl}/music-history`;
      const result = await this.request.get(url, { fullModelsCount });
      return MusicHistory.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch history items for a specific set of entities.
     *
     * @param query - The entity ids to resolve.
     * @returns The resolved history items, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async musicHistoryItems(query: MusicHistoryItemsQuery): Promise<MusicHistoryItems | null> {
      const url = `${this.baseUrl}/music-history/items`;
      const items = buildHistoryItems(query);
      const result = await this.request.postJson(url, { items });
      return MusicHistoryItems.deJson(result, this as unknown as Client);
    }
  }

  return MusicHistoryMethods;
}
