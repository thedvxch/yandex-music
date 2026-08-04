/**
 * Landing-page client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList } from '../base.js';
import {
  ChartInfo,
  ContinueListenBlock,
  EntityChart,
  Landing,
  LandingList,
  Mixes,
  RecapSlides,
  RecentlyPlayed,
  UniversalScreenEntitiesPage,
} from '../models/landing/landing.js';
import { AlbumEntitiesIds, AlbumIds, PlaylistEntitiesIds } from '../models/catalogBrowsing.js';
import { Lumen } from '../models/lumen.js';
import { Genre } from '../models/genre.js';
import { Feed } from '../models/feed/feed.js';
import { TagResult } from '../models/tagResult.js';
import { isJsonObject } from '../base.js';
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

    /**
     * Fetch the personalised feed (legacy `/feed` endpoint).
     *
     * @returns The feed, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async feed(): Promise<Feed | null> {
      const result = await this.request.get(`${this.baseUrl}/feed`);
      return Feed.deJson(result, this as unknown as Client);
    }

    /**
     * Check whether the feed onboarding wizard has been completed.
     *
     * @returns `true` when the wizard has been passed.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async feedWizardIsPassed(): Promise<boolean> {
      const result = await this.request.get(`${this.baseUrl}/feed/wizard/is-passed`);
      return isJsonObject(result) ? Boolean(result['isWizardPassed']) : false;
    }

    /**
     * Mark a feed playlist as seen.
     *
     * @param playlistId - The playlist id.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async feedPlaylistsSeen(playlistId: string): Promise<boolean> {
      const result = await this.request.get(`${this.baseUrl}/feed/playlists/seen`, { playlistId });
      return result === 'ok' || isJsonObject(result);
    }

    /**
     * Fetch the album chart.
     *
     * @returns The chart, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async chartAlbums(): Promise<EntityChart | null> {
      const result = await this.request.get(`${this.baseUrl}/chart/albums`);
      return EntityChart.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the podcast chart.
     *
     * @returns The chart, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async chartPodcasts(): Promise<EntityChart | null> {
      const result = await this.request.get(`${this.baseUrl}/chart/podcasts`);
      return EntityChart.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the "My Shelf" (books/podcasts) landing page.
     *
     * @returns The landing, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicBookshelf(): Promise<Landing | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/bookshelf`);
      return Landing.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the books/podcasts catalogue landing page.
     *
     * @returns The landing, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicCatalogue(): Promise<Landing | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/catalogue`);
      return Landing.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the "new episodes" (podcasts) landing page.
     *
     * @returns The landing, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicNewEpisodes(): Promise<Landing | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/new-episodes`);
      return Landing.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the user's recently-played items.
     *
     * @returns The recently-played list, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async landingRecentlyPlayed(): Promise<RecentlyPlayed | null> {
      const result = await this.request.get(`${this.baseUrl}/landing-blocks/recently-played`);
      return RecentlyPlayed.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the personalized "mixes" landing block.
     *
     * @returns The mixes, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async landingMixes(): Promise<Mixes | null> {
      const result = await this.request.get(`${this.baseUrl}/landing/block/mixes`, { fullList: 'true' });
      return Mixes.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of entities from a generic landing block.
     *
     * @param blockId - The block id.
     * @param page - Page index. Defaults to `0`.
     * @param pageSize - Entities per page. Defaults to `20`.
     * @returns The page, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async landingBlockEntities(
      blockId: string,
      page = 0,
      pageSize = 20,
    ): Promise<UniversalScreenEntitiesPage | null> {
      const url = `${this.baseUrl}/landing/block/${blockId}/entities`;
      const result = await this.request.get(url, { page, 'page-size': pageSize });
      return UniversalScreenEntitiesPage.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a page of entities from a tagged landing block.
     *
     * @param metaTagId - The meta-tag id.
     * @param metaTagType - The meta-tag type.
     * @param page - Page index. Defaults to `0`.
     * @param pageSize - Entities per page. Defaults to `20`.
     * @returns The page, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async landingBlocksEntitiesTag(
      metaTagId: string,
      metaTagType: string,
      page = 0,
      pageSize = 20,
    ): Promise<UniversalScreenEntitiesPage | null> {
      const url = `${this.baseUrl}/landing-blocks/entities/tag/${metaTagId}/block/${metaTagType}`;
      const result = await this.request.get(url, { page, 'page-size': pageSize });
      return UniversalScreenEntitiesPage.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the combined "continue listening" block (bookshelf + new episodes + last played).
     *
     * @returns The block, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async landingBlocksNonMusicContinueListen(): Promise<ContinueListenBlock | null> {
      const url = `${this.baseUrl}/landing-blocks/non-music/continue-listen`;
      const result = await this.request.get(url, { type: 'ALL' });
      return ContinueListenBlock.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the ambient theme/color state for the currently playing track.
     *
     * @returns The theme state, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async lumen(): Promise<Lumen | null> {
      const result = await this.request.get(`${this.baseUrl}/lumen`);
      return Lumen.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the albums in a podcasts/books catalogue category.
     *
     * @param name - The category name.
     * @returns The album ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicCategoryAlbums(name: string): Promise<AlbumIds | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/category/${name}/albums`);
      return AlbumIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a podcasts/books catalogue compilation.
     *
     * @param compilationId - The compilation id.
     * @returns The album ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicCompilation(compilationId: string): Promise<AlbumEntitiesIds | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/compilations/${compilationId}`);
      return AlbumEntitiesIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a podcasts/books editorial album collection.
     *
     * @param name - The collection name.
     * @returns The album ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicEditorialAlbum(name: string): Promise<AlbumEntitiesIds | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/editorial/album/${name}`);
      return AlbumEntitiesIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a podcasts/books editorial playlist collection.
     *
     * @param name - The collection name.
     * @returns The playlist ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async nonMusicEditorialPlaylist(name: string): Promise<PlaylistEntitiesIds | null> {
      const result = await this.request.get(`${this.baseUrl}/non-music/editorial/playlist/${name}`);
      return PlaylistEntitiesIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the albums in a kids-mode catalogue category.
     *
     * @param name - The category name.
     * @returns The album ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async childrenLandingCategoryAlbums(name: string): Promise<AlbumIds | null> {
      const result = await this.request.get(`${this.baseUrl}/children-landing/category/${name}/albums`);
      return AlbumIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a kids-mode catalogue compilation.
     *
     * @param compilationId - The compilation id.
     * @returns The album ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async childrenLandingCompilation(compilationId: string): Promise<AlbumEntitiesIds | null> {
      const result = await this.request.get(`${this.baseUrl}/children-landing/compilations/${compilationId}`);
      return AlbumEntitiesIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a kids-mode editorial album collection.
     *
     * @param name - The collection name.
     * @returns The album ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async childrenLandingEditorialAlbum(name: string): Promise<AlbumEntitiesIds | null> {
      const result = await this.request.get(`${this.baseUrl}/children-landing/editorial/album/${name}`);
      return AlbumEntitiesIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a kids-mode editorial playlist collection.
     *
     * @param name - The collection name.
     * @returns The playlist ids, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async childrenLandingEditorialPlaylist(name: string): Promise<PlaylistEntitiesIds | null> {
      const result = await this.request.get(`${this.baseUrl}/children-landing/editorial/playlist/${name}`);
      return PlaylistEntitiesIds.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the user's personal recap slideshow (year/period in review).
     *
     * @returns The slideshow, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async recapSlidesUser(): Promise<RecapSlides | null> {
      const result = await this.request.get(`${this.baseUrl}/recap-slides/user`);
      return RecapSlides.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the kids-account recap slideshow.
     *
     * @returns The slideshow, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async recapSlidesKids(): Promise<RecapSlides | null> {
      const result = await this.request.get(`${this.baseUrl}/recap-slides/kids`);
      return RecapSlides.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch an artist's recap slideshow.
     *
     * @param artistId - The artist id.
     * @returns The slideshow, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async recapSlidesArtist(artistId: string | number): Promise<RecapSlides | null> {
      const result = await this.request.get(`${this.baseUrl}/recap-slides/artist/${artistId}`);
      return RecapSlides.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the playlists grouped under a tag.
     *
     * @param tagId - The tag id.
     * @returns The tagged playlists, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tags(tagId: string): Promise<TagResult | null> {
      const result = await this.request.get(`${this.baseUrl}/tags/${tagId}/playlist-ids`);
      return TagResult.deJson(result, this as unknown as Client);
    }
  }

  return LandingMethods;
}
