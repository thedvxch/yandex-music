/**
 * Concert client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { pathSegment } from '../utils/path.js';
import {
  ArtistConcerts,
  ArtistsWithConcerts,
  ConcertFeed,
  ConcertInfo,
  ConcertLocations,
  ConcertSkeleton,
  ConcertTabConfig,
} from '../models/concert/concert.js';
import { PersonalConcerts } from '../models/landing/blocks.js';
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
      return this.getModel(`${this.baseUrl}/artists/${pathSegment(artistId)}/concerts`, ArtistConcerts.deJson);
    }

    /**
     * Fetch detailed information about a concert.
     *
     * @param concertId - The concert id.
     * @returns The concert info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertInfo(concertId: string | number): Promise<ConcertInfo | null> {
      return this.getModel(`${this.baseUrl}/concerts/${pathSegment(concertId)}/info`, ConcertInfo.deJson);
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
      return this.getModel(`${this.baseUrl}/concerts/${pathSegment(concertId)}/skeletons/${pathSegment(skeletonId)}`, ConcertSkeleton.deJson);
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
      return this.getModel(`${this.baseUrl}/concerts/locations`, ConcertLocations.deJson);
    }

    /**
     * Fetch the concert tab configuration.
     *
     * @returns The tab config, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertsTabConfig(): Promise<ConcertTabConfig | null> {
      return this.getModel(`${this.baseUrl}/concerts/tab-config`, ConcertTabConfig.deJson);
    }

    /**
     * Fetch the artists-with-concerts landing block for a set of artists.
     *
     * @param artistIds - The artist ids.
     * @param locations - Location ids to filter by.
     * @returns The entities, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertsLandingArtists(
      artistIds: Array<string | number>,
      locations?: Array<string | number>,
    ): Promise<ArtistsWithConcerts | null> {
      const params = locations?.length ? { locations: locations.join(',') } : undefined;
      const result = await this.request.postJson(
        `${this.baseUrl}/concerts/landing/artists`,
        { artistIds: artistIds.map(String) },
        undefined,
        { params },
      );
      return ArtistsWithConcerts.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch concerts recommended for the user (`concerts/landing/personal`).
     *
     * @remarks Requires authorization.
     * @returns The concerts, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async concertsLandingPersonal(): Promise<PersonalConcerts | null> {
      return this.getModel(`${this.baseUrl}/concerts/landing/personal`, PersonalConcerts.deJson);
    }
  }

  return ConcertsMethods;
}
