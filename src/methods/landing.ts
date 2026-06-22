/**
 * Landing-page client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList } from '../base.js';
import { ChartInfo, Landing, LandingList } from '../models/landing/landing.js';
import { Genre } from '../models/genre.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Sample user id the landing endpoint expects in `eitherUserId`. */
const LANDING_EITHER_USER_ID = '10254713668400548221';

/**
 * Adds landing endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with landing methods.
 */
export function LandingMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class LandingMethods extends Base {
    /**
     * Fetch one or more landing blocks (`/landing3`).
     *
     * @param blocks - A block name or list of block names (for example `personalplaylists`, `chart`).
     * @returns The landing page, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async landing(blocks: string | string[]): Promise<Landing | null> {
      const url = `${this.baseUrl}/landing3`;
      const result = await this.request.get(url, { blocks, eitherUserId: LANDING_EITHER_USER_ID });
      return Landing.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a chart (`/landing3/chart`).
     *
     * @param chartOption - Optional chart option (for example a country code).
     * @returns The chart, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async chart(chartOption = ''): Promise<ChartInfo | null> {
      const url = chartOption
        ? `${this.baseUrl}/landing3/chart/${chartOption}`
        : `${this.baseUrl}/landing3/chart`;
      const result = await this.request.get(url);
      return ChartInfo.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the "new releases" landing list.
     *
     * @returns The list, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async newReleases(): Promise<LandingList | null> {
      const result = await this.request.get(`${this.baseUrl}/landing3/new-releases`);
      return LandingList.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the "new playlists" landing list.
     *
     * @returns The list, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async newPlaylists(): Promise<LandingList | null> {
      const result = await this.request.get(`${this.baseUrl}/landing3/new-playlists`);
      return LandingList.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the podcasts landing list.
     *
     * @returns The list, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async podcasts(): Promise<LandingList | null> {
      const result = await this.request.get(`${this.baseUrl}/landing3/podcasts`);
      return LandingList.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the genre tree.
     *
     * @returns The list of top-level genres (each with nested sub-genres).
     * @throws {YandexMusicError} On any transport or API error.
     */
    async genres(): Promise<Genre[]> {
      const result = await this.request.get(`${this.baseUrl}/genres`);
      return deList(Genre.deJson, result, this as unknown as Client);
    }
  }

  return LandingMethods;
}
