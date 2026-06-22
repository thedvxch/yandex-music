/**
 * Production-credits client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Credits } from '../models/credit.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds production-credits endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with credits methods.
 */
export function CreditsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class CreditsMethods extends Base {
    /**
     * Fetch the production credits of a track.
     *
     * @param trackId - The track id.
     * @returns The credits, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksCredits(trackId: string | number): Promise<Credits | null> {
      const result = await this.request.get(`${this.baseUrl}/tracks/${trackId}/credits`);
      return Credits.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the production credits of a clip.
     *
     * @param clipId - The clip id.
     * @returns The credits, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async clipsCredits(clipId: string | number): Promise<Credits | null> {
      const result = await this.request.get(`${this.baseUrl}/clips/${clipId}/credits`);
      return Credits.deJson(result, this as unknown as Client);
    }
  }

  return CreditsMethods;
}
