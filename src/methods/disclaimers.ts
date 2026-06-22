/**
 * Legal-disclaimer client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Disclaimer } from '../models/disclaimer.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds disclaimer endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with disclaimer methods.
 */
export function DisclaimersMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class DisclaimersMethods extends Base {
    /**
     * Fetch the disclaimer of a track.
     *
     * @param trackId - The track id.
     * @returns The disclaimer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksDisclaimer(trackId: string | number): Promise<Disclaimer | null> {
      const result = await this.request.get(`${this.baseUrl}/tracks/${trackId}/disclaimer`);
      return Disclaimer.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the disclaimer of a clip.
     *
     * @param clipId - The clip id.
     * @returns The disclaimer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async clipsDisclaimer(clipId: string | number): Promise<Disclaimer | null> {
      const result = await this.request.get(`${this.baseUrl}/clips/${clipId}/disclaimer`);
      return Disclaimer.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the disclaimer of an album.
     *
     * @param albumId - The album id.
     * @returns The disclaimer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async albumsDisclaimer(albumId: string | number): Promise<Disclaimer | null> {
      const result = await this.request.get(`${this.baseUrl}/albums/${albumId}/disclaimer`);
      return Disclaimer.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the disclaimer of an artist.
     *
     * @param artistId - The artist id.
     * @returns The disclaimer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async artistsDisclaimer(artistId: string | number): Promise<Disclaimer | null> {
      const result = await this.request.get(`${this.baseUrl}/artists/${artistId}/disclaimer`);
      return Disclaimer.deJson(result, this as unknown as Client);
    }
  }

  return DisclaimersMethods;
}
