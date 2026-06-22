/**
 * Album-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Album } from '../models/album/album.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds album endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with album methods.
 */
export function AlbumsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class Albums extends Base {
    /**
     * Fetch one or many albums by id (without their track lists).
     *
     * @param albumIds - A single id or a list of ids.
     * @returns The requested albums.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albums(albumIds: Array<string | number> | string | number): Promise<Album[]> {
      return this.getList('album', albumIds, Album.deJson);
    }

    /**
     * Fetch a single album together with all of its tracks (grouped by volume).
     *
     * @param albumId - The album id.
     * @returns The album with its `volumes`, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsWithTracks(albumId: string | number): Promise<Album | null> {
      const url = `${this.baseUrl}/albums/${albumId}/with-tracks`;
      const result = await this.request.get(url);
      return Album.deJson(result, this as unknown as Client);
    }
  }

  return Albums;
}
