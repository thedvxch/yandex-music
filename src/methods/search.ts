/**
 * Search-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList } from '../base.js';
import { Search, SearchHistoryItem, SearchInstant, Suggestions } from '../models/search/search.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';
import type { Params } from '../request.js';

/** Entity type to search for. */
export type SearchType = 'all' | 'artist' | 'user' | 'album' | 'playlist' | 'track' | 'podcast' | 'podcast_episode';

/** Options for {@link SearchMethods.searchInstant | searchInstant}. */
export interface SearchInstantOptions {
  /** Content-type filter (server-defined, free-form). */
  contentType?: string;
  /** Input source tag (for example `init`, `type`). Defaults to `init`. */
  inputType?: string;
  /** Page index. Defaults to `0`. */
  page?: number;
  /** Results per page. Defaults to `20`. */
  pageSize?: number;
  /** Entity type to search for. Defaults to `all`. */
  type?: SearchType;
  /** Restrict results to this artist's catalogue. */
  artistId?: string;
  /** Id of a search filter (from a previous response's `filters`). */
  filterId?: string;
  /** Whether to include the "best match" card variants. */
  withBestResults?: boolean;
  /** Whether "best match" releases may be included. */
  withBestResultReleases?: boolean;
  /** Location filter (server-defined, free-form). */
  locations?: string;
}

/**
 * Adds search endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with search methods.
 */
export function SearchMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class SearchMethods extends Base {
    /**
     * Search the catalogue.
     *
     * @param text - The query text.
     * @param nocorrect - When `false`, mistyped queries are auto-corrected. Defaults to `false`.
     * @param type - Entity type to search for. Defaults to `all`.
     * @param page - Page index. Defaults to `0`.
     * @param playlistInBest - Whether playlists may appear as the best match. Defaults to `true`.
     * @returns The search response, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async search(
      text: string,
      nocorrect = false,
      type: SearchType = 'all',
      page = 0,
      playlistInBest = true,
    ): Promise<Search | null> {
      const url = `${this.baseUrl}/search`;
      const result = await this.request.get(url, {
        text,
        nocorrect: String(nocorrect),
        type,
        page,
        'playlist-in-best': String(playlistInBest),
      });
      return Search.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch search suggestions for a partial query.
     *
     * @param part - The partial query text.
     * @returns The suggestions, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async searchSuggest(part: string): Promise<Suggestions | null> {
      const url = `${this.baseUrl}/search/suggest`;
      const result = await this.request.get(url, { part });
      return Suggestions.deJson(result, this as unknown as Client);
    }

    /**
     * Search-as-you-type: a lighter-weight, instant variant of {@link search}.
     *
     * @param text - The query text.
     * @param nocorrect - When `false`, mistyped queries are auto-corrected. Defaults to `false`.
     * @param options - Additional filters and paging.
     * @returns The search response, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async searchInstant(
      text: string,
      nocorrect = false,
      options: SearchInstantOptions = {},
    ): Promise<SearchInstant | null> {
      const url = `${this.baseUrl}/search/instant/mixed`;
      const params: Params = {
        text,
        nocorrect: String(nocorrect),
        inputType: options.inputType ?? 'init',
        page: options.page ?? 0,
        pageSize: options.pageSize ?? 20,
        type: options.type ?? 'all',
      };
      if (options.contentType !== undefined) params['contentType'] = options.contentType;
      if (options.artistId !== undefined) params['artistId'] = options.artistId;
      if (options.filterId !== undefined) params['filter'] = options.filterId;
      if (options.withBestResults !== undefined) params['withBestResults'] = String(options.withBestResults);
      if (options.withBestResultReleases !== undefined) {
        params['withBestResultReleases'] = String(options.withBestResultReleases);
      }
      if (options.locations !== undefined) params['locations'] = options.locations;
      const result = await this.request.get(url, params);
      return SearchInstant.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the user's search history.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The history entries.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersSearchHistory(userId?: string | number): Promise<SearchHistoryItem[]> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/search-history`);
      return deList(SearchHistoryItem.deJson, result, this as unknown as Client);
    }

    /**
     * Clear the user's search history.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersSearchHistoryClear(userId?: string | number): Promise<boolean> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/search-history/clear`);
      return result === 'ok';
    }
  }

  return SearchMethods;
}
