/**
 * Artist-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Artist } from '../models/artist/artist.js';
import { ArtistTracks } from '../models/artist/artistTracks.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds artist endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with artist methods.
 */
export function ArtistsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class Artists extends Base {
    /**
     * Fetch one or many artists by id.
     *
     * @param artistIds - A single id or a list of ids.
     * @returns The requested artists.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artists(artistIds: Array<string | number> | string | number): Promise<Artist[]> {
      return this.getList('artist', artistIds, Artist.deJson);
    }

    /**
     * Fetch a page of an artist's tracks.
     *
     * @param artistId - The artist id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Tracks per page. Defaults to `20`.
     * @returns The page of tracks, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsTracks(artistId: string | number, page = 0, pageSize = 20): Promise<ArtistTracks | null> {
      const url = `${this.baseUrl}/artists/${artistId}/tracks`;
      const result = await this.request.get(url, { page, 'page-size': pageSize });
      return ArtistTracks.deJson(result, this as unknown as Client);
    }
  }

  return Artists;
}
