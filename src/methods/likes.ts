/**
 * Like-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { isJsonObject } from '../base.js';
import { TracksList } from '../models/like.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Entity type that can be liked. */
export type LikeableType = 'track' | 'artist' | 'album' | 'playlist';

/**
 * Add or remove a like on one or many objects.
 *
 * @param self - The client issuing the request.
 * @param objectType - The kind of object being liked.
 * @param ids - One or many object ids (playlists use `ownerId:kind`).
 * @param remove - When `true`, remove the like instead of adding it.
 * @param userId - Target user id. Defaults to the authenticated account.
 * @returns Whether the operation succeeded.
 * @throws {YandexMusicError} On any transport or API error.
 */
async function likeAction(
  self: ClientBase,
  objectType: LikeableType,
  ids: Array<string | number> | string | number,
  remove: boolean,
  userId?: string | number,
): Promise<boolean> {
  const uid = userId ?? self.accountUid;
  const action = remove ? 'remove' : 'add-multiple';
  const url = `${self.baseUrl}/users/${uid}/likes/${objectType}s/${action}`;
  const result = await self.request.post(url, { [`${objectType}-ids`]: ids });
  if (objectType === 'track') {
    return isJsonObject(result) && 'revision' in result;
  }
  return result === 'ok';
}

/**
 * Adds like/dislike endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with like methods.
 */
export function LikesMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class LikesMethods extends Base {
    /**
     * Like one or many tracks.
     *
     * @param trackIds - Track id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesTracksAdd(trackIds: Array<string | number> | string | number, userId?: string | number): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'track', trackIds, false, userId);
    }

    /**
     * Remove the like from one or many tracks.
     *
     * @param trackIds - Track id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesTracksRemove(
      trackIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'track', trackIds, true, userId);
    }

    /**
     * Like one or many artists.
     *
     * @param artistIds - Artist id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesArtistsAdd(
      artistIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'artist', artistIds, false, userId);
    }

    /**
     * Remove the like from one or many artists.
     *
     * @param artistIds - Artist id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesArtistsRemove(
      artistIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'artist', artistIds, true, userId);
    }

    /**
     * Like one or many albums.
     *
     * @param albumIds - Album id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesAlbumsAdd(albumIds: Array<string | number> | string | number, userId?: string | number): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'album', albumIds, false, userId);
    }

    /**
     * Remove the like from one or many albums.
     *
     * @param albumIds - Album id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesAlbumsRemove(
      albumIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'album', albumIds, true, userId);
    }

    /**
     * Like one or many playlists.
     *
     * @param playlistIds - Playlist id(s) in `ownerId:kind` form.
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesPlaylistsAdd(
      playlistIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'playlist', playlistIds, false, userId);
    }

    /**
     * Remove the like from one or many playlists.
     *
     * @param playlistIds - Playlist id(s) in `ownerId:kind` form.
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersLikesPlaylistsRemove(
      playlistIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return likeAction(this as unknown as ClientBase, 'playlist', playlistIds, true, userId);
    }

    /**
     * Fetch the user's liked tracks.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The liked-tracks library, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersLikesTracks(userId?: string | number): Promise<TracksList | null> {
      const uid = userId ?? this.accountUid;
      const url = `${this.baseUrl}/users/${uid}/likes/tracks`;
      const result = await this.request.get(url);
      const library = isJsonObject(result) ? result['library'] : undefined;
      return TracksList.deJson(library, this as unknown as Client);
    }
  }

  return LikesMethods;
}
