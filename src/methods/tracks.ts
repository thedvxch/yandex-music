/**
 * Track-related client methods.
 *
 * @packageDocumentation
 */
import { randomUUID } from 'node:crypto';
import { ClientBase } from '../clientBase.js';
import { pathSegment } from '../utils/path.js';
import { deList, isJsonObject } from '../base.js';
import { Track } from '../models/track/track.js';
import { AlbumSimilarEntities } from '../models/album/albumExtras.js';
import {
  DownloadInfo,
  FileInfo,
  LosslessDownloadInfo,
  SimilarTracks,
  TrackFullInfo,
  TrackLyrics,
  TrackTrailer,
} from '../models/track/extras.js';
import { Supplement } from '../models/supplement.js';
import { PlayerInformers } from '../models/playerInformers.js';
import { ShotEvent } from '../models/shot.js';
import {
  getSignRequest,
  getFileInfoSign,
  DESKTOP_CLIENT,
  DESKTOP_SIGN_KEY,
  FILE_INFO_CODECS_LIST,
  FILE_INFO_TRANSPORT,
} from '../signRequest.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** Parameters for reporting playback progress via `playAudio`. */
export interface PlayAudioOptions {
  /** Track id. */
  trackId: string | number;
  /** Name of the client the track is played from. */
  from: string;
  /** Album id the track belongs to. */
  albumId: string | number;
  /** Playlist id, when a playlist is playing. */
  playlistId?: string;
  /** Whether the track is played from cache. */
  fromCache?: boolean;
  /** Unique play id. */
  playId?: string;
  /** User id. Defaults to the authenticated account. */
  uid?: number;
  /** ISO timestamp of the event. Defaults to now. */
  timestamp?: string;
  /** Track length in seconds. */
  trackLengthSeconds?: number;
  /** Seconds played in total. */
  totalPlayedSeconds?: number;
  /** Final played-seconds position. */
  endPositionSeconds?: number;
  /** ISO client timestamp. Defaults to now. */
  clientNow?: string;
}

/**
 * File-info quality: `lossless`, `hq` (high), `nq` (normal), `lq` (low),
 * `preview` (a short clip) or `smart_preview` (the highlight clip used for
 * previews; listed in a track's `specialAudioResources` when available).
 */
export type FileInfoQuality = 'lossless' | 'hq' | 'nq' | 'lq' | 'preview' | 'smart_preview';

/** Options for `/get-file-info` requests. */
export interface FileInfoOptions {
  /** Requested quality (see {@link FileInfoQuality}). Defaults to `lossless`. */
  quality?: FileInfoQuality | (string & {});
  /** Allowed codecs. Defaults to every known codec. */
  codecs?: readonly string[];
  /** Transport: `raw` or `encraw`. */
  transport?: 'raw' | 'encraw' | (string & {});
  /** Signing key override. Defaults to the desktop key. */
  signKey?: string;
  /** `X-Yandex-Music-Client` header override. Must match the signing key. */
  clientHeader?: string;
}

/** Query parameters that make `/tracks/{id}/download-info` answer like the web player (no ad preroll in place of the track). */
export const DOWNLOAD_INFO_ANTI_AD_PARAMS: Readonly<Record<string, string>> = {
  from: 'web-main',
  'external-domain': 'music.yandex.ru',
  overloading: 'false',
};

/** Options for {@link Client.tracksDownloadInfo}. */
export interface DownloadInfoOptions {
  /**
   * Send {@link DOWNLOAD_INFO_ANTI_AD_PARAMS} (default `true`). Without them the
   * endpoint has been seen to return an advertisement instead of the track for
   * some accounts (MarshalX/yandex-music-api#675).
   */
  antiAdParams?: boolean;
}

/**
 * Signed file-info `GET` (`/get-file-info`, `/get-file-info/batch` and the
 * `/resources/v2/file-info` variants); returns the unwrapped result. Batch
 * endpoints take `trackIds` and sign over the comma-joined id list.
 */
function requestFileInfo(
  client: ClientBase,
  path: string,
  ids: string | number | Array<string | number>,
  options: FileInfoOptions,
  defaultTransport: string,
) {
  const quality = options.quality ?? 'lossless';
  const codecs = options.codecs ?? FILE_INFO_CODECS_LIST;
  const transport = options.transport ?? defaultTransport;
  const batch = Array.isArray(ids);
  const idValue = batch ? ids.join(',') : ids;
  const sign = getFileInfoSign(idValue, quality, codecs, transport, options.signKey ?? DESKTOP_SIGN_KEY);
  return client.request.get(
    `${client.baseUrl}${path}`,
    {
      ts: sign.ts,
      [batch ? 'trackIds' : 'trackId']: idValue,
      quality,
      codecs: codecs.join(','),
      transports: transport,
      sign: sign.value,
    },
    undefined,
    { 'X-Yandex-Music-Client': options.clientHeader ?? DESKTOP_CLIENT },
  );
}

/** The file-info list of a batch response (`downloadInfos` on v1, `fileInfos` on v2; either is accepted). */
function fileInfoList(result: JSONValue | undefined, client: Client): LosslessDownloadInfo[] {
  if (!isJsonObject(result)) {
    return [];
  }
  return deList(LosslessDownloadInfo.deJson, result['downloadInfos'] ?? result['fileInfos'], client);
}

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
     * @param options - `antiAdParams` (default `true`, see {@link DOWNLOAD_INFO_ANTI_AD_PARAMS}).
     * @returns The list of download variants.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksDownloadInfo(
      trackId: string | number,
      getDirectLinks = false,
      options: DownloadInfoOptions = {},
    ): Promise<DownloadInfo[]> {
      const url = `${this.baseUrl}/tracks/${pathSegment(trackId)}/download-info`;
      const result = await this.request.get(url, options.antiAdParams === false ? undefined : { ...DOWNLOAD_INFO_ANTI_AD_PARAMS });
      return DownloadInfo.deListAsync(result, this as unknown as Client, getDirectLinks);
    }

    /**
     * Fetch file info for a track via the signed `/get-file-info` endpoint
     * (reference-library `tracks_file_info`).
     *
     * @remarks
     * Requires authorization; `lossless` needs a subscription. Defaults to the
     * `raw` transport, so the stream is not encrypted. The server picks the codec
     * from `options.codecs`; when the requested quality is unavailable it returns
     * the best available variant.
     *
     * @param trackId - The track id, sent exactly as given.
     * @param options - Quality, codecs, transport and signing overrides.
     * @returns The file info, or `null` when the endpoint returns none.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksFileInfo(trackId: string | number, options: FileInfoOptions = {}): Promise<FileInfo | null> {
      const result = await requestFileInfo(this, '/get-file-info', trackId, options, 'raw');
      return FileInfo.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch file info for several tracks in one signed request
     * (`GET /get-file-info/batch`, used by the web player).
     *
     * @remarks
     * Same options and signing as {@link tracksFileInfo}; the signature covers the
     * comma-joined id list. Defaults to the `raw` transport. Tracks the server
     * cannot serve are simply missing from the result — match by
     * {@link LosslessDownloadInfo.trackId}.
     *
     * @param trackIds - Track ids, sent exactly as given.
     * @param options - Quality, codecs, transport and signing overrides.
     * @returns One {@link LosslessDownloadInfo} per served track.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksFileInfoBatch(
      trackIds: Array<string | number>,
      options: FileInfoOptions = {},
    ): Promise<LosslessDownloadInfo[]> {
      const result = await requestFileInfo(this, '/get-file-info/batch', trackIds, options, 'raw');
      return fileInfoList(result, this as unknown as Client);
    }

    /**
     * Fetch file info via the newer `GET /resources/v2/file-info`.
     *
     * @remarks
     * Same query and signature as {@link tracksFileInfo}, but the answer is the
     * bare file info (no envelope) and carries loudness data
     * ({@link LosslessDownloadInfo.r128}). Defaults to the `raw` transport.
     *
     * @param trackId - The track id, sent exactly as given.
     * @param options - Quality, codecs, transport and signing overrides.
     * @returns The file info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksFileInfoV2(trackId: string | number, options: FileInfoOptions = {}): Promise<LosslessDownloadInfo | null> {
      const result = await requestFileInfo(this, '/resources/v2/file-info', trackId, options, 'raw');
      const info = isJsonObject(result) ? (result['fileInfo'] ?? result['downloadInfo'] ?? result) : undefined;
      return LosslessDownloadInfo.deJson(info, this as unknown as Client);
    }

    /**
     * Batch form of {@link tracksFileInfoV2} (`GET /resources/v2/file-info/batch`).
     *
     * @param trackIds - Track ids, sent exactly as given.
     * @param options - Quality, codecs, transport and signing overrides.
     * @returns One {@link LosslessDownloadInfo} per served track.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksFileInfoBatchV2(
      trackIds: Array<string | number>,
      options: FileInfoOptions = {},
    ): Promise<LosslessDownloadInfo[]> {
      const result = await requestFileInfo(this, '/resources/v2/file-info/batch', trackIds, options, 'raw');
      return fileInfoList(result, this as unknown as Client);
    }

    /**
     * Fetch lossless (FLAC) download info for a track via the `/get-file-info`
     * endpoint.
     *
     * @remarks
     * Unlike {@link tracksDownloadInfo} (legacy lossy mp3/aac), this resolves the
     * modern signed endpoint that can serve **lossless FLAC**. The transport
     * defaults to `encraw`, so the returned stream is AES-CTR-encrypted;
     * {@link LosslessDownloadInfo.download} / {@link LosslessDownloadInfo.downloadBytes}
     * decrypt it transparently. When a track has no lossless source the server falls
     * back to a lossy codec: check {@link LosslessDownloadInfo.isLossless} / `.codec`.
     *
     * @param trackId - The track id, sent exactly as given.
     * @param quality - Requested quality. Defaults to `lossless`.
     * @param options - Codecs, transport (default `encraw`) and signing overrides.
     * @returns The file info, or `null` when the endpoint returns none.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksLosslessInfo(
      trackId: string | number,
      quality = 'lossless',
      options: Omit<FileInfoOptions, 'quality'> = {},
    ): Promise<LosslessDownloadInfo | null> {
      const result = await requestFileInfo(this, '/get-file-info', trackId, { ...options, quality }, FILE_INFO_TRANSPORT);
      const info = isJsonObject(result) ? result['downloadInfo'] : undefined;
      return LosslessDownloadInfo.deJson(info, this as unknown as Client);
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
      const url = `${this.baseUrl}/tracks/${pathSegment(trackId)}/lyrics`;
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
      return this.getModel(`${this.baseUrl}/tracks/${pathSegment(trackId)}/similar`, SimilarTracks.deJson);
    }

    /**
     * Fetch entities similar to a track (waves startable from it, similar artists, …).
     *
     * @param trackId - The track id.
     * @returns The similar entities, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksSimilarEntities(trackId: string | number): Promise<AlbumSimilarEntities | null> {
      return this.getModel(`${this.baseUrl}/tracks/${pathSegment(trackId)}/similar-entities`, AlbumSimilarEntities.deJson);
    }

    /**
     * Fetch full information about a track.
     *
     * @param trackId - The track id.
     * @returns The full track info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksFullInfo(trackId: string | number): Promise<TrackFullInfo | null> {
      return this.getModel(`${this.baseUrl}/tracks/${pathSegment(trackId)}/full-info`, TrackFullInfo.deJson);
    }

    /**
     * Fetch the trailer of a track.
     *
     * @param trackId - The track id.
     * @returns The trailer, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async tracksTrailer(trackId: string | number): Promise<TrackTrailer | null> {
      return this.getModel(`${this.baseUrl}/tracks/${pathSegment(trackId)}/trailer`, TrackTrailer.deJson);
    }

    /**
     * Fetch supplementary information about a track (legacy lyrics, videos).
     *
     * @param trackId - The track id.
     * @returns The supplement, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async trackSupplement(trackId: string | number): Promise<Supplement | null> {
      return this.getModel(`${this.baseUrl}/tracks/${pathSegment(trackId)}/supplement`, Supplement.deJson);
    }

    /**
     * Report the current playback state of a track.
     *
     * @param options - The playback report.
     * @returns Whether the report was accepted.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playAudio(options: PlayAudioOptions): Promise<boolean> {
      const now = `${new Date().toISOString()}`;
      // Unlike other methods, an unresolved uid is omitted rather than raising IdMissingError.
      const uid = options.uid ?? this.accountUid;
      const data = {
        'track-id': options.trackId,
        'from-cache': String(options.fromCache ?? false),
        from: options.from,
        'play-id': options.playId ?? '',
        ...(uid !== undefined ? { uid } : {}),
        timestamp: options.timestamp ?? now,
        'track-length-seconds': options.trackLengthSeconds ?? 0,
        'total-played-seconds': options.totalPlayedSeconds ?? 0,
        'end-position-seconds': options.endPositionSeconds ?? 0,
        'album-id': options.albumId,
        'playlist-id': options.playlistId ?? '',
        'client-now': options.clientNow ?? now,
      };
      const result = await this.request.post(`${this.baseUrl}/play-audio`, data);
      return result === 'ok';
    }

    /**
     * Report multiple playback events in a single batch (`/plays`).
     *
     * @param items - The playback reports.
     * @param clientNow - ISO client timestamp for the whole batch. Defaults to now.
     * @returns Whether the report was accepted.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playsBulk(items: PlayAudioOptions[], clientNow?: string): Promise<boolean> {
      const now = new Date().toISOString();
      const plays = items.map((options) => ({
        trackId: String(options.trackId),
        albumId: String(options.albumId),
        playlistId: options.playlistId,
        fromCache: options.fromCache ?? false,
        from: options.from,
        // The server rejects the batch outright ("Parameters requirements are not
        // met") when playId is empty/absent, unlike the single-track /play-audio.
        playId: options.playId || randomUUID(),
        timestamp: options.timestamp ?? now,
        trackLengthSeconds: options.trackLengthSeconds,
        totalPlayedSeconds: options.totalPlayedSeconds,
        endPositionSeconds: options.endPositionSeconds,
      }));
      const result = await this.request.postJson(
        `${this.baseUrl}/plays`,
        { plays },
        undefined,
        { params: { 'client-now': clientNow ?? now } },
      );
      return result === 'ok';
    }

    /**
     * Fetch player informer banners for a batch of tracks.
     *
     * @param tracks - The tracks to fetch informers for.
     * @param locations - Location ids to filter by.
     * @returns The informers, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async playerInformers(
      tracks: Array<{ trackId: string | number; artistIds: Array<string | number>; albumId?: string | number }>,
      locations?: Array<string | number>,
    ): Promise<PlayerInformers | null> {
      const params = locations?.length ? { locations: locations.join(',') } : undefined;
      const body = {
        tracks: tracks.map((t) => ({
          trackId: String(t.trackId),
          artistIds: (t.artistIds ?? []).map(String),
          albumId: t.albumId !== undefined ? String(t.albumId) : undefined,
        })),
      };
      const result = await this.request.postJson(`${this.baseUrl}/player-informers`, body, undefined, { params });
      return PlayerInformers.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch an ad or an Alice shot to play after a track.
     *
     * @param nextTrackId - The upcoming track id.
     * @param contextItem - Context identifier (for playlists, `ownerId:playlistId`).
     * @param prevTrackId - The previous track id (optional for Alice shots).
     * @param context - Context kind. Defaults to `playlist`.
     * @param types - What to return after the track. Defaults to `shot`.
     * @param from - Where the context was entered from.
     * @returns The shot event, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async afterTrack(
      nextTrackId: string | number,
      contextItem: string,
      prevTrackId?: string | number,
      context = 'playlist',
      types = 'shot',
      from = 'mobile-landing-origin-default',
    ): Promise<ShotEvent | null> {
      const url = `${this.baseUrl}/after-track`;
      const result = await this.request.get(url, {
        from,
        prevTrackId,
        nextTrackId,
        context,
        contextItem,
        types,
      });
      const shotEvent = isJsonObject(result) ? result['shotEvent'] : undefined;
      return ShotEvent.deJson(shotEvent, this as unknown as Client);
    }
  }

  return Tracks;
}
