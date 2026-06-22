/**
 * Metatag client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import {
  Metatag,
  MetatagAlbums,
  MetatagArtists,
  MetatagPlaylists,
  Metatags,
} from '../models/metatag/metatag.js';
import type { Params } from '../request.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Per-section item counts requested from {@link MetatagsMixin.metatag}. */
export interface MetatagOptions {
  tracksCount?: number;
  artistsCount?: number;
  composersCount?: number;
  albumsCount?: number;
  promotionsCount?: number;
  featuresCount?: number;
  playlistsCount?: number;
  concertsCount?: number;
  tracksSortBy?: string;
  albumsSortBy?: string;
  withLikesCount?: boolean;
}

/**
 * Adds metatag endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with metatag methods.
 */
export function MetatagsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class MetatagsMethods extends Base {
    /**
     * Fetch the metatag navigation (moods, activities, genres, epochs).
     *
     * @returns The metatag navigation, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async metatags(): Promise<Metatags | null> {
      const result = await this.request.get(`${this.baseUrl}/landing3/metatags`);
      return Metatags.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch aggregate information about a metatag.
     *
     * @param metatagId - The metatag id.
     * @param options - Optional per-section counts and sort keys.
     * @returns The metatag, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async metatag(metatagId: string, options: MetatagOptions = {}): Promise<Metatag | null> {
      const result = await this.request.get(`${this.baseUrl}/metatags/${metatagId}`, { ...options });
      return Metatag.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of a metatag's albums.
     *
     * @param metatagId - The metatag id.
     * @param options - Optional period, sort key and pagination.
     * @returns The page of albums, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async metatagAlbums(
      metatagId: string,
      options: { period?: string; sortBy?: string; offset?: number; limit?: number } = {},
    ): Promise<MetatagAlbums | null> {
      const params: Params = { offset: options.offset ?? 0, limit: options.limit ?? 25 };
      if (options.period !== undefined) params['period'] = options.period;
      if (options.sortBy !== undefined) params['sortBy'] = options.sortBy;
      const result = await this.request.get(`${this.baseUrl}/metatags/${metatagId}/albums`, params);
      return MetatagAlbums.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of a metatag's artists.
     *
     * @param metatagId - The metatag id.
     * @param options - Period (required by the API, defaults to `week`), sort key, pagination and tracks-per-artist.
     * @returns The page of artists, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async metatagArtists(
      metatagId: string,
      options: { period?: string; sortBy?: string; offset?: number; limit?: number; tracksPerArtist?: number } = {},
    ): Promise<MetatagArtists | null> {
      const params: Params = {
        period: options.period ?? 'week',
        offset: options.offset ?? 0,
        limit: options.limit ?? 25,
      };
      if (options.sortBy !== undefined) params['sortBy'] = options.sortBy;
      if (options.tracksPerArtist !== undefined) params['tracksPerArtist'] = options.tracksPerArtist;
      const result = await this.request.get(`${this.baseUrl}/metatags/${metatagId}/artists`, params);
      return MetatagArtists.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of a metatag's playlists.
     *
     * @param metatagId - The metatag id.
     * @param options - Optional sort key, pagination and likes-count flag.
     * @returns The page of playlists, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async metatagPlaylists(
      metatagId: string,
      options: { sortBy?: string; offset?: number; limit?: number; withLikesCount?: boolean } = {},
    ): Promise<MetatagPlaylists | null> {
      const params: Params = { offset: options.offset ?? 0, limit: options.limit ?? 25 };
      if (options.sortBy !== undefined) params['sortBy'] = options.sortBy;
      if (options.withLikesCount !== undefined) params['withLikesCount'] = String(options.withLikesCount);
      const result = await this.request.get(`${this.baseUrl}/metatags/${metatagId}/playlists`, params);
      return MetatagPlaylists.deJson(result, this as unknown as Client);
    }
  }

  return MetatagsMethods;
}
