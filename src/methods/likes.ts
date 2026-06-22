/**
 * Like-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList, isJsonObject } from '../base.js';
import { Like, TracksList } from '../models/like.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Entity type that can be liked. */
export type LikeableType = 'track' | 'artist' | 'album' | 'playlist';

/** Entity type that can be disliked. */
export type DislikeableType = 'track' | 'artist';

/**
 * Add or remove a dislike on one or many objects.
 *
 * @param self - The client issuing the request.
 * @param objectType - The kind of object being disliked.
 * @param ids - One or many object ids.
 * @param remove - When `true`, remove the dislike instead of adding it.
 * @param userId - Target user id. Defaults to the authenticated account.
 * @returns Whether the operation succeeded.
 * @throws {YandexMusicError} On any transport or API error.
 */
async function dislikeAction(
  self: ClientBase,
  objectType: DislikeableType,
  ids: Array<string | number> | string | number,
  remove: boolean,
  userId?: string | number,
): Promise<boolean> {
  const uid = userId ?? self.accountUid;
  const action = remove ? 'remove' : 'add-multiple';
  const url = `${self.baseUrl}/users/${uid}/dislikes/${objectType}s/${action}`;
  const result = await self.request.post(url, { [`${objectType}-ids`]: ids });
  if (objectType === 'track') {
    return isJsonObject(result) && 'revision' in result;
  }
  return result === 'ok';
}

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

    /**
     * Fetch the user's liked albums.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The liked albums.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersLikesAlbums(userId?: string | number): Promise<Like[]> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/likes/albums`);
      return deList(Like.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch the user's liked artists.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The liked artists.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersLikesArtists(userId?: string | number): Promise<Like[]> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/likes/artists`);
      return deList(Like.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch the user's liked playlists.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The liked playlists.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersLikesPlaylists(userId?: string | number): Promise<Like[]> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/likes/playlists`);
      return deList(Like.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch the user's disliked tracks.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The disliked-tracks library, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersDislikesTracks(userId?: string | number): Promise<TracksList | null> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/dislikes/tracks`);
      const library = isJsonObject(result) ? result['library'] : undefined;
      return TracksList.deJson(library, this as unknown as Client);
    }

    /**
     * Dislike one or many tracks.
     *
     * @param trackIds - Track id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersDislikesTracksAdd(
      trackIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return dislikeAction(this as unknown as ClientBase, 'track', trackIds, false, userId);
    }

    /**
     * Remove the dislike from one or many tracks.
     *
     * @param trackIds - Track id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersDislikesTracksRemove(
      trackIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return dislikeAction(this as unknown as ClientBase, 'track', trackIds, true, userId);
    }

    /**
     * Fetch the user's disliked artists.
     *
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns The disliked artists.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async usersDislikesArtists(userId?: string | number): Promise<Like[]> {
      const uid = userId ?? this.accountUid;
      const result = await this.request.get(`${this.baseUrl}/users/${uid}/dislikes/artists`);
      return deList(Like.deJson, result, this as unknown as Client);
    }

    /**
     * Dislike one or many artists.
     *
     * @param artistIds - Artist id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersDislikesArtistsAdd(
      artistIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return dislikeAction(this as unknown as ClientBase, 'artist', artistIds, false, userId);
    }

    /**
     * Remove the dislike from one or many artists.
     *
     * @param artistIds - Artist id(s).
     * @param userId - Target user id. Defaults to the authenticated account.
     * @returns Whether the operation succeeded.
     */
    usersDislikesArtistsRemove(
      artistIds: Array<string | number> | string | number,
      userId?: string | number,
    ): Promise<boolean> {
      return dislikeAction(this as unknown as ClientBase, 'artist', artistIds, true, userId);
    }
  }

  return LikesMethods;
}
