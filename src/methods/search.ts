/**
 * Search-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Search, Suggestions } from '../models/search/search.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Entity type to search for. */
export type SearchType = 'all' | 'artist' | 'user' | 'album' | 'playlist' | 'track' | 'podcast' | 'podcast_episode';

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
  }

  return SearchMethods;
}
