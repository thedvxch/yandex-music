/**
 * Track-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Track } from '../models/track/track.js';
import { DownloadInfo, SimilarTracks, TrackFullInfo, TrackLyrics, TrackTrailer } from '../models/track/extras.js';
import { getSignRequest } from '../signRequest.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds track endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with track methods.
 */
export function TracksMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class Tracks extends Base {
    /**
     * Fetch one or many tracks by id.
     *
     * @param trackIds - A single id or a list of ids.
     * @param withPositions - Include album track positions. Defaults to `true`.
     * @returns The requested tracks.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracks(
      trackIds: Array<string | number> | string | number,
      withPositions = true,
    ): Promise<Track[]> {
      return this.getList('track', trackIds, Track.deJson, { 'with-positions': String(withPositions) });
    }

    /**
     * Fetch the available download variants for a track.
     *
     * @param trackId - The track id.
     * @param getDirectLinks - Resolve direct file links eagerly. Defaults to `false`.
     * @returns The list of download variants.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksDownloadInfo(trackId: string | number, getDirectLinks = false): Promise<DownloadInfo[]> {
      const url = `${this.baseUrl}/tracks/${trackId}/download-info`;
      const result = await this.request.get(url);
      return DownloadInfo.deListAsync(result, this as unknown as Client, getDirectLinks);
    }

    /**
     * Fetch the lyrics of a track.
     *
     * @remarks Requires authorization.
     * @param trackId - The track id.
     * @param format - `TEXT` (plain) or `LRC` (time-synced). Defaults to `TEXT`.
     * @returns The lyrics, or `null` when none exist.
     * @throws {UnauthorizedError} When called without authorization.
     * @throws {NotFoundError} When the track has no lyrics.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksLyrics(trackId: string | number, format: 'TEXT' | 'LRC' = 'TEXT'): Promise<TrackLyrics | null> {
      const url = `${this.baseUrl}/tracks/${trackId}/lyrics`;
      const sign = getSignRequest(trackId);
      const result = await this.request.get(url, {
        format,
        timeStamp: sign.timestamp,
        sign: sign.value,
      });
      return TrackLyrics.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch tracks similar to a track.
     *
     * @param trackId - The track id.
     * @returns The similar-tracks result, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksSimilar(trackId: string | number): Promise<SimilarTracks | null> {
      const url = `${this.baseUrl}/tracks/${trackId}/similar`;
      const result = await this.request.get(url);
      return SimilarTracks.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch full information about a track.
     *
     * @param trackId - The track id.
     * @returns The full track info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksFullInfo(trackId: string | number): Promise<TrackFullInfo | null> {
      const url = `${this.baseUrl}/tracks/${trackId}/full-info`;
      const result = await this.request.get(url);
      return TrackFullInfo.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the trailer of a track.
     *
     * @param trackId - The track id.
     * @returns The trailer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksTrailer(trackId: string | number): Promise<TrackTrailer | null> {
      const url = `${this.baseUrl}/tracks/${trackId}/trailer`;
      const result = await this.request.get(url);
      return TrackTrailer.deJson(result, this as unknown as Client);
    }
  }

  return Tracks;
}
