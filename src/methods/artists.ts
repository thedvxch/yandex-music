/**
 * Artist-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Artist } from '../models/artist/artist.js';
import { ArtistTracks } from '../models/artist/artistTracks.js';
import {
  ArtistAlbums,
  ArtistLinks,
  ArtistSimilar,
  ArtistTrailer,
  BriefInfo,
} from '../models/artist/artistExtras.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** How an artist's albums are sorted. */
export type ArtistAlbumsSortBy = 'year' | 'rating';

/** The direction of a sort. */
export type SortOrder = 'asc' | 'desc';

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
     * Fetch aggregate information about an artist.
     *
     * @param artistId - The artist id.
     * @returns The brief info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsBriefInfo(artistId: string | number): Promise<BriefInfo | null> {
      const url = `${this.baseUrl}/artists/${artistId}/brief-info`;
      const result = await this.request.get(url);
      return BriefInfo.deJson(result, this as unknown as Client);
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

    /**
     * Fetch a page of albums where the artist is the primary author.
     *
     * @param artistId - The artist id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Albums per page. Defaults to `20`.
     * @param sortBy - Sort key. Defaults to `'year'`.
     * @returns The page of albums, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsDirectAlbums(
      artistId: string | number,
      page = 0,
      pageSize = 20,
      sortBy: ArtistAlbumsSortBy = 'year',
    ): Promise<ArtistAlbums | null> {
      const url = `${this.baseUrl}/artists/${artistId}/direct-albums`;
      const result = await this.request.get(url, { 'sort-by': sortBy, page, 'page-size': pageSize });
      return ArtistAlbums.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of compilations and albums the artist also appears on.
     *
     * @param artistId - The artist id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Albums per page. Defaults to `20`.
     * @param sortBy - Sort key. Defaults to `'year'`.
     * @returns The page of albums, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsAlsoAlbums(
      artistId: string | number,
      page = 0,
      pageSize = 20,
      sortBy: ArtistAlbumsSortBy = 'year',
    ): Promise<ArtistAlbums | null> {
      const url = `${this.baseUrl}/artists/${artistId}/also-albums`;
      const result = await this.request.get(url, { 'sort-by': sortBy, page, 'page-size': pageSize });
      return ArtistAlbums.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of the artist's discography.
     *
     * @param artistId - The artist id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Albums per page. Defaults to `20`.
     * @param sortBy - Sort key. Defaults to `'year'`.
     * @returns The page of albums, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsDiscographyAlbums(
      artistId: string | number,
      page = 0,
      pageSize = 20,
      sortBy: ArtistAlbumsSortBy = 'year',
    ): Promise<ArtistAlbums | null> {
      const url = `${this.baseUrl}/artists/${artistId}/discography-albums`;
      const result = await this.request.get(url, { 'sort-by': sortBy, page, 'page-size': pageSize });
      return ArtistAlbums.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the artist's "safe" direct albums (no explicit content).
     *
     * @param artistId - The artist id.
     * @param sortBy - Sort key. Defaults to `'year'`.
     * @param sortOrder - Sort direction. Defaults to `'desc'`.
     * @param limit - Maximum number of albums. Defaults to `20`.
     * @returns The albums, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsSafeDirectAlbums(
      artistId: string | number,
      sortBy: ArtistAlbumsSortBy = 'year',
      sortOrder: SortOrder = 'desc',
      limit = 20,
    ): Promise<ArtistAlbums | null> {
      const url = `${this.baseUrl}/artists/${artistId}/safe-direct-albums`;
      const result = await this.request.get(url, { 'sort-by': sortBy, 'sort-order': sortOrder, limit });
      return ArtistAlbums.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch artists similar to the given one.
     *
     * @param artistId - The artist id.
     * @returns The similar artists, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsSimilar(artistId: string | number): Promise<ArtistSimilar | null> {
      const url = `${this.baseUrl}/artists/${artistId}/similar`;
      const result = await this.request.get(url);
      return ArtistSimilar.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the external links shown on an artist's page.
     *
     * @param artistId - The artist id.
     * @returns The links, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsLinks(artistId: string | number): Promise<ArtistLinks | null> {
      const url = `${this.baseUrl}/artists/${artistId}/artist-links`;
      const result = await this.request.get(url);
      return ArtistLinks.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the trailer of an artist.
     *
     * @param artistId - The artist id.
     * @returns The trailer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsTrailer(artistId: string | number): Promise<ArtistTrailer | null> {
      const url = `${this.baseUrl}/artists/${artistId}/trailer`;
      const result = await this.request.get(url);
      return ArtistTrailer.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of the artist's track ids.
     *
     * @param artistId - The artist id.
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Ids per page. Defaults to `20`.
     * @returns The list of track ids, or an empty array.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsTrackIds(artistId: string | number, page = 0, pageSize = 20): Promise<Array<string | number>> {
      const url = `${this.baseUrl}/artists/${artistId}/track-ids`;
      const result = await this.request.get(url, { page, 'page-size': pageSize });
      if (Array.isArray(result)) {
        return result.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number');
      }
      return [];
    }
  }

  return Artists;
}
