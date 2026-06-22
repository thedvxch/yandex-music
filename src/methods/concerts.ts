/**
 * Concert client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import {
  ArtistConcerts,
  ConcertFeed,
  ConcertInfo,
  ConcertLocations,
  ConcertSkeleton,
  ConcertTabConfig,
} from '../models/concert/concert.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds concert endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with concert methods.
 */
export function ConcertsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class ConcertsMethods extends Base {
    /**
     * Fetch an artist's upcoming concerts.
     *
     * @param artistId - The artist id.
     * @returns The artist's concerts, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsConcerts(artistId: string | number): Promise<ArtistConcerts | null> {
      const result = await this.request.get(`${this.baseUrl}/artists/${artistId}/concerts`);
      return ArtistConcerts.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch detailed information about a concert.
     *
     * @param concertId - The concert id.
     * @returns The concert info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertInfo(concertId: string | number): Promise<ConcertInfo | null> {
      const result = await this.request.get(`${this.baseUrl}/concerts/${concertId}/info`);
      return ConcertInfo.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the skeleton (render scaffold) of a concert page.
     *
     * @param concertId - The concert id.
     * @param skeletonId - The skeleton id. Defaults to `'concert_page'`.
     * @returns The skeleton, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertSkeleton(concertId: string | number, skeletonId = 'concert_page'): Promise<ConcertSkeleton | null> {
      const result = await this.request.get(`${this.baseUrl}/concerts/${concertId}/skeletons/${skeletonId}`);
      return ConcertSkeleton.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the concert feed, optionally filtered by location.
     *
     * @param locations - Location ids to filter by.
     * @returns The concert feed, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertsFeed(locations?: Array<string | number>): Promise<ConcertFeed | null> {
      const params = locations && locations.length ? { locations: locations.join(',') } : undefined;
      const result = await this.request.get(`${this.baseUrl}/concerts/feed`, params);
      return ConcertFeed.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the available concert locations.
     *
     * @returns The locations, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertsLocations(): Promise<ConcertLocations | null> {
      const result = await this.request.get(`${this.baseUrl}/concerts/locations`);
      return ConcertLocations.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the concert tab configuration.
     *
     * @returns The tab config, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertsTabConfig(): Promise<ConcertTabConfig | null> {
      const result = await this.request.get(`${this.baseUrl}/concerts/tab-config`);
      return ConcertTabConfig.deJson(result, this as unknown as Client);
    }
  }

  return ConcertsMethods;
}
