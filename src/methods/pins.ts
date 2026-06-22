/**
 * Pinned-item client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Pin, PinsList } from '../models/pin.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds pinned-item endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with pin methods.
 */
export function PinsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class PinsMethods extends Base {
    /**
     * Fetch the user's pinned items.
     *
     * @returns The pinned items, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async pins(): Promise<PinsList | null> {
      const result = await this.request.get(`${this.baseUrl}/pins`);
      return PinsList.deJson(result, this as unknown as Client);
    }

    /**
     * Pin an album.
     *
     * @param albumId - The album id.
     * @returns The created pin, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async pinAlbum(albumId: string | number): Promise<Pin | null> {
      const result = await this.request.put(`${this.baseUrl}/pin/album`, { id: albumId });
      return Pin.deJson(result, this as unknown as Client);
    }

    /**
     * Unpin an album.
     *
     * @param albumId - The album id.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async unpinAlbum(albumId: string | number): Promise<boolean> {
      const result = await this.request.delete(`${this.baseUrl}/pin/album`, { id: albumId });
      return result === 'ok';
    }

    /**
     * Pin an artist.
     *
     * @param artistId - The artist id.
     * @returns The created pin, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async pinArtist(artistId: string | number): Promise<Pin | null> {
      const result = await this.request.put(`${this.baseUrl}/pin/artist`, { id: artistId });
      return Pin.deJson(result, this as unknown as Client);
    }

    /**
     * Unpin an artist.
     *
     * @param artistId - The artist id.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async unpinArtist(artistId: string | number): Promise<boolean> {
      const result = await this.request.delete(`${this.baseUrl}/pin/artist`, { id: artistId });
      return result === 'ok';
    }

    /**
     * Pin a playlist.
     *
     * @param uid - The playlist owner uid.
     * @param kind - The playlist kind.
     * @returns The created pin, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async pinPlaylist(uid: string | number, kind: string | number): Promise<Pin | null> {
      const result = await this.request.put(`${this.baseUrl}/pin/playlist`, { uid, kind });
      return Pin.deJson(result, this as unknown as Client);
    }

    /**
     * Unpin a playlist.
     *
     * @param uid - The playlist owner uid.
     * @param kind - The playlist kind.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async unpinPlaylist(uid: string | number, kind: string | number): Promise<boolean> {
      const result = await this.request.delete(`${this.baseUrl}/pin/playlist`, { uid, kind });
      return result === 'ok';
    }

    /**
     * Pin a wave (radio seed, for example `artist:12345`).
     *
     * @param seeds - The wave seed identifier.
     * @returns The created pin, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async pinWave(seeds: string): Promise<Pin | null> {
      const result = await this.request.put(`${this.baseUrl}/pin/wave`, { seeds });
      return Pin.deJson(result, this as unknown as Client);
    }

    /**
     * Unpin a wave.
     *
     * @param seeds - The wave seed identifier.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async unpinWave(seeds: string): Promise<boolean> {
      const result = await this.request.delete(`${this.baseUrl}/pin/wave`, { seeds });
      return result === 'ok';
    }
  }

  return PinsMethods;
}
