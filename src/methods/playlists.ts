/**
 * Playlist-related client methods (read access and mutations).
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList, isJsonObject } from '../base.js';
import { Playlist } from '../models/playlist/playlist.js';
import {
  GeneratedPlaylist,
  PlaylistRecommendations,
  PlaylistSimilarEntities,
  PlaylistTrailer,
  PlaylistsList,
} from '../models/playlist/playlistExtras.js';
import { UserSettings } from '../models/account/settings.js';
import { Difference } from '../utils/difference.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Visibility of a playlist. */
export type PlaylistVisibility = 'public' | 'private';

/**
 * Adds playlist endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with playlist methods.
 */
export function PlaylistsMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class PlaylistsMethods extends Base {
    /**
     * Fetch a user's library settings.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The user settings, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersSettings(userId?: string | number): Promise<UserSettings | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/settings`;
      const result = await this.request.get(url);
      const settings = isJsonObject(result) ? result['userSettings'] : undefined;
      return UserSettings.deJson(settings, this as unknown as Client);
    }

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
     * Fetch track recommendations for a playlist.
     *
     * @param kind - The playlist kind.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The recommendations, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsRecommendations(
      kind: string | number,
      userId?: string | number,
    ): Promise<PlaylistRecommendations | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/recommendations`;
      const result = await this.request.get(url);
      return PlaylistRecommendations.deJson(result, this as unknown as Client);
    }

    /**
     * Create a new playlist.
     *
     * @param title - The playlist title.
     * @param visibility - Access modifier. Defaults to `'public'`.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The created playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsCreate(
      title: string,
      visibility: PlaylistVisibility = 'public',
      userId?: string | number,
    ): Promise<Playlist | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/create`;
      const result = await this.request.post(url, { title, visibility });
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Delete a playlist.
     *
     * @param kind - The playlist kind.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsDelete(kind: string | number, userId?: string | number): Promise<boolean> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/delete`;
      const result = await this.request.post(url);
      return result === 'ok';
    }

    /**
     * Rename a playlist.
     *
     * @param kind - The playlist kind.
     * @param name - The new title.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The updated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsName(
      kind: string | number,
      name: string,
      userId?: string | number,
    ): Promise<Playlist | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/name`;
      const result = await this.request.post(url, { value: name });
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Change a playlist's visibility.
     *
     * @param kind - The playlist kind.
     * @param visibility - The new visibility.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The updated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsVisibility(
      kind: string | number,
      visibility: PlaylistVisibility,
      userId?: string | number,
    ): Promise<Playlist | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/visibility`;
      const result = await this.request.post(url, { value: visibility });
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Change a playlist's description.
     *
     * @param kind - The playlist kind.
     * @param description - The new description.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The updated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsDescription(
      kind: string | number,
      description: string,
      userId?: string | number,
    ): Promise<Playlist | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/description`;
      const result = await this.request.post(url, { value: description });
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Apply a raw diff to a playlist.
     *
     * @param kind - The playlist kind.
     * @param diff - The serialized diff (see {@link Difference}).
     * @param revision - The playlist revision. Defaults to `1`.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The updated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsChange(
      kind: string | number,
      diff: string,
      revision = 1,
      userId?: string | number,
    ): Promise<Playlist | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/change`;
      const result = await this.request.post(url, { kind, revision, diff });
      return Playlist.deJson(result, this as unknown as Client);
    }

    /**
     * Insert a track into a playlist at the given index.
     *
     * @param kind - The playlist kind.
     * @param trackId - The track id to insert.
     * @param albumId - The album the track belongs to.
     * @param at - The insertion index. Defaults to `0`.
     * @param revision - The playlist revision. Defaults to `1`.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The updated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsInsertTrack(
      kind: string | number,
      trackId: string | number,
      albumId: string | number,
      at = 0,
      revision = 1,
      userId?: string | number,
    ): Promise<Playlist | null> {
      const diff = new Difference().addInsert(at, { id: trackId, albumId }).toJson();
      return this.usersPlaylistsChange(kind, diff, revision, userId);
    }

    /**
     * Remove a range of tracks from a playlist.
     *
     * @param kind - The playlist kind.
     * @param from - Start index (inclusive).
     * @param to - End index (exclusive).
     * @param revision - The playlist revision. Defaults to `1`.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The updated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsDeleteTrack(
      kind: string | number,
      from: number,
      to: number,
      revision = 1,
      userId?: string | number,
    ): Promise<Playlist | null> {
      const diff = new Difference().addDelete(from, to).toJson();
      return this.usersPlaylistsChange(kind, diff, revision, userId);
    }

    /**
     * Join a collaborative playlist as a co-author.
     *
     * @param userId - The numeric id of the playlist owner.
     * @param token - The join token (from the "add co-author" link).
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playlistsCollectiveJoin(userId: number, token: string): Promise<boolean> {
      const search = new URLSearchParams({ uid: String(userId), token });
      const url = `${this.baseUrl}/playlists/collective/join?${search.toString()}`;
      const result = await this.request.post(url);
      return result === 'ok';
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
     * Fetch entities similar to a playlist.
     *
     * @param playlistUuid - The playlist UUID.
     * @returns The similar entities, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playlistSimilarEntities(playlistUuid: string): Promise<PlaylistSimilarEntities | null> {
      const url = `${this.baseUrl}/playlist/${playlistUuid}/similar-entities`;
      const result = await this.request.get(url);
      return PlaylistSimilarEntities.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a list of playlists by their `uid:kind` ids.
     *
     * @param playlistIds - A single id or a list of ids in `uid:kind` form.
     * @returns The playlists, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playlists(playlistIds: string[] | string): Promise<PlaylistsList | null> {
      const url = `${this.baseUrl}/playlists`;
      const ids = Array.isArray(playlistIds) ? playlistIds.join(',') : playlistIds;
      const result = await this.request.get(url, { playlistIds: ids });
      return PlaylistsList.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch a short-form list of playlists by their `uid:kind` ids.
     *
     * @remarks
     * The returned playlists do not carry their track lists; use
     * {@link usersPlaylists} to obtain a playlist with `tracks` populated.
     *
     * @param playlistIds - A single id or a list of ids in `uid:kind` form.
     * @returns The playlists.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playlistsList(playlistIds: Array<string | number> | string | number): Promise<Playlist[]> {
      return this.getList('playlist', playlistIds, Playlist.deJson);
    }

    /**
     * Fetch a personal (auto-generated) playlist.
     *
     * @remarks
     * Known ids: `daily`, `missedLikes`, `recentTracks`, `neverHeard`,
     * `podcasts`, `origin`.
     *
     * @param playlistId - The personal-playlist id.
     * @returns The generated playlist, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playlistsPersonal(playlistId: string): Promise<GeneratedPlaylist | null> {
      const url = `${this.baseUrl}/playlists/personal/${playlistId}`;
      const result = await this.request.get(url);
      return GeneratedPlaylist.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the trailer of a playlist.
     *
     * @param kind - The playlist kind.
     * @param userId - Owner user id. Defaults to the authenticated account.
     * @returns The trailer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersPlaylistsTrailer(
      kind: string | number,
      userId?: string | number,
    ): Promise<PlaylistTrailer | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/playlists/${kind}/trailer`;
      const result = await this.request.get(url);
      return PlaylistTrailer.deJson(result, this as unknown as Client);
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
