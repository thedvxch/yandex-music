/**
 * Playlist-related client methods (read access).
 *
 * @remarks
 * Mutating endpoints (create/rename/change/insert-track) and their auxiliary
 * models are not yet implemented; this mixin currently covers reading playlists.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList, isJsonObject } from '../base.js';
import { Playlist } from '../models/playlist/playlist.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds playlist read endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with playlist methods.
 */
export function PlaylistsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class PlaylistsMethods extends Base {
    /**
     * Fetch one playlist (by a single kind) or several (by a list of kinds).
     *
     * @param kind - A single playlist kind, or a list of kinds.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns A single {@link Playlist}, a list of them, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylists(
      kind: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<Playlist | Playlist[] | null> {
      const uid = userId ?? this.accountUid;
      if (Array.isArray(kind)) {
        const url = `${this.baseUrl}/users/${uid}/playlists`;
        const result = await this.request.post(url, { kinds: kind });
        return deList(Playlist.deJson, result, this as unknown as Client);
      }
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}`;
      const result = await this.request.get(url);
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch every playlist owned by a user.
     *
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The user's playlists.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsList(userId?: string | number): Promise<Playlist[]> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/list`;
      const result = await this.request.get(url);
      return deList(Playlist.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch a playlist by its stable UUID.
     *
     * @param playlistUuid - The playlist UUID.
     * @returns The {@link Playlist}, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playlist(playlistUuid: string): Promise<Playlist | null> {
      const url = `${this.baseUrl}/playlist/${playlistUuid}`;
      const result = await this.request.get(url);
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the kinds (ids) of all playlists owned by a user.
     *
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The list of playlist kinds.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsKinds(userId?: string | number): Promise<number[]> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/list/kinds`;
      const result = await this.request.get(url);
      return Array.isArray(result) ? (result.filter((x) => typeof x === 'number') as number[]) : [];
    }
  }

  return PlaylistsMethods;
}
