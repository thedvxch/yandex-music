/**
 * Album pre-save client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Presaves } from '../models/presaves.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds album pre-save endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with pre-save methods.
 */
export function PresavesMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class PresavesMethods extends Base {
    /**
     * Fetch the user's pre-saved albums.
     *
     * @param includeReleased - Include albums that have since been released. Defaults to `true`.
     * @param includeUpcoming - Include albums not yet released. Defaults to `true`.
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The pre-saves, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPresaves(
      includeReleased = true,
      includeUpcoming = true,
      userId?: string | number,
    ): Promise<Presaves | null> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/presaves`, {
        includeReleased: String(includeReleased),
        includeUpcoming: String(includeUpcoming),
      });
      return Presaves.deJson(result, this as unknown as Client);
    }

    /**
     * Pre-save an album.
     *
     * @param albumId - The album id.
     * @param likeAfterRelease - Automatically like the album once released. Defaults to `true`.
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPresavesAdd(
      albumId: string | number,
      likeAfterRelease = true,
      userId?: string | number,
    ): Promise<boolean> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.post(`${this.baseUrl}/users/${uid}/presaves/add`, {
        albumId,
        likeAfterRelease: String(likeAfterRelease),
      });
      return result === 'ok';
    }

    /**
     * Remove an album pre-save.
     *
     * @param albumId - The album id.
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPresavesRemove(albumId: string | number, userId?: string | number): Promise<boolean> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.post(`${this.baseUrl}/users/${uid}/presaves/remove`, { albumId });
      return result === 'ok';
    }
  }

  return PresavesMethods;
}
