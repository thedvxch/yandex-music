/**
 * Listening-history client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { MusicHistory } from '../models/musicHistory/musicHistory.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds listening-history endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with music-history methods.
 */
export function MusicHistoryMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class MusicHistoryMethods extends Base {
    /**
     * Fetch the user's listening history grouped by day.
     *
     * @param fullModelsCount - How many items to return with their full models inlined. Defaults to `0`.
     * @returns The listening history, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async musicHistory(fullModelsCount = 0): Promise<MusicHistory | null> {
      const url = `${this.baseUrl}/music-history`;
      const result = await this.request.get(url, { fullModelsCount });
      return MusicHistory.deJson(result, this as unknown as Client);
    }
  }

  return MusicHistoryMethods;
}
