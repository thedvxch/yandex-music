/**
 * Record-label client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Label } from '../models/album/album.js';
import { LabelAlbums, LabelArtists } from '../models/label/labelExtras.js';
import type { ArtistAlbumsSortBy, SortOrder } from './artists.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds record-label endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with label methods.
 */
export function LabelsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class LabelsMethods extends Base {
    /**
     * Fetch a record label by id.
     *
     * @param labelId - The label id.
     * @returns The label, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async label(labelId: string | number): Promise<Label | null> {
      const result = await this.request.get(`${this.baseUrl}/labels/${labelId}`);
      return Label.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of a label's albums.
     *
     * @param labelId - The label id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Albums per page. Defaults to `100`.
     * @param sortBy - Sort key.
     * @param sortOrder - Sort direction.
     * @returns The page of albums, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async labelAlbums(
      labelId: string | number,
      page = 0,
      pageSize = 100,
      sortBy?: ArtistAlbumsSortBy,
      sortOrder?: SortOrder,
    ): Promise<LabelAlbums | null> {
      const result = await this.request.get(`${this.baseUrl}/labels/${labelId}/albums`, {
        page,
        pageSize,
        sortBy,
        sortOrder,
      });
      return LabelAlbums.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of a label's artists.
     *
     * @param labelId - The label id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Artists per page. Defaults to `100`.
     * @returns The page of artists, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async labelArtists(labelId: string | number, page = 0, pageSize = 100): Promise<LabelArtists | null> {
      const result = await this.request.get(`${this.baseUrl}/labels/${labelId}/artists`, { page, pageSize });
      return LabelArtists.deJson(result, this as unknown as Client);
    }
  }

  return LabelsMethods;
}
