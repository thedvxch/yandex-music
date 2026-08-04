/**
 * Album-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Album } from '../models/album/album.js';
import { AlbumDonations, AlbumRelatedContent, AlbumSimilarEntities, AlbumTrailer } from '../models/album/albumExtras.js';
import type { AbstractConstructor } from './mixin.js';

/**
 * Adds album endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with album methods.
 */
export function AlbumsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class Albums extends Base {
    /**
     * Fetch one or many albums by id (without their track lists).
     *
     * @param albumIds - A single id or a list of ids.
     * @returns The requested albums.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albums(albumIds: Array<string | number> | string | number): Promise<Album[]> {
      return this.getList('album', albumIds, Album.deJson);
    }

    /**
     * Fetch a single album together with all of its tracks (grouped by volume).
     *
     * @param albumId - The album id.
     * @returns The album with its `volumes`, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsWithTracks(albumId: string | number): Promise<Album | null> {
      return this.getModel(`${this.baseUrl}/albums/${albumId}/with-tracks`, Album.deJson);
    }

    /**
     * Fetch entities similar to an album.
     *
     * @param albumId - The album id.
     * @returns The similar entities, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsSimilarEntities(albumId: string | number): Promise<AlbumSimilarEntities | null> {
      return this.getModel(`${this.baseUrl}/albums/${albumId}/similar-entities`, AlbumSimilarEntities.deJson);
    }

    /**
     * Fetch the trailer of an album.
     *
     * @param albumId - The album id.
     * @returns The album trailer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsTrailer(albumId: string | number): Promise<AlbumTrailer | null> {
      return this.getModel(`${this.baseUrl}/albums/${albumId}/trailer`, AlbumTrailer.deJson);
    }

    /**
     * Fetch the donations made on an album.
     *
     * @param albumId - The album id.
     * @returns The donations, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsDonations(albumId: string | number): Promise<AlbumDonations | null> {
      return this.getModel(`${this.baseUrl}/donation/albums/${albumId}`, AlbumDonations.deJson);
    }

    /**
     * Fetch content related to an album.
     *
     * @param albumId - The album id.
     * @returns The related content, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsRelatedContent(albumId: string | number): Promise<AlbumRelatedContent | null> {
      return this.getModel(`${this.baseUrl}/albums/${albumId}/related-content`, AlbumRelatedContent.deJson);
    }
  }

  return Albums;
}
