/**
 * Production-credits client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { pathSegment } from '../utils/path.js';
import { Credits } from '../models/credit.js';
import type { AbstractConstructor } from './mixin.js';

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
      return this.getModel(`${this.baseUrl}/tracks/${pathSegment(trackId)}/credits`, Credits.deJson);
    }

    /**
     * Fetch the production credits of a clip.
     *
     * @param clipId - The clip id.
     * @returns The credits, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async clipsCredits(clipId: string | number): Promise<Credits | null> {
      return this.getModel(`${this.baseUrl}/clips/${pathSegment(clipId)}/credits`, Credits.deJson);
    }
  }

  return CreditsMethods;
}
