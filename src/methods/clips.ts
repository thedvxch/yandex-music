/**
 * Clip (short music video) client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList } from '../base.js';
import { Clip, ClipsWillLike } from '../models/clip.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds clip endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with clip methods.
 */
export function ClipsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class ClipsMethods extends Base {
    /**
     * Fetch one or many clips by id.
     *
     * @param clipIds - A single clip id or a list of ids.
     * @returns The requested clips.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async clips(clipIds: Array<string | number> | string | number): Promise<Clip[]> {
      const ids = Array.isArray(clipIds) ? clipIds.join(',') : clipIds;
      const result = await this.request.get(`${this.baseUrl}/clips`, { clipIds: ids });
      return deList(Clip.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch a recommended page of clips.
     *
     * @param page - Page index (0-based). Defaults to `0`.
     * @param pageSize - Clips per page. Defaults to `50`.
     * @returns The recommended clips, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async clipsWillLike(page = 0, pageSize = 50): Promise<ClipsWillLike | null> {
      const result = await this.request.get(`${this.baseUrl}/clips/will/like`, { page, pageSize });
      return ClipsWillLike.deJson(result, this as unknown as Client);
    }
  }

  return ClipsMethods;
}
