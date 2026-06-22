/**
 * The central {@link Track} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { CoverDerivedColors } from '../common.js';
import { Fade, LyricsInfo, Major, MetaData, Normalization, PoetryLoverMatch, SmartPreviewParams } from './nested.js';
// Value imports despite the import cycle (track ↔ artist ↔ album): the cyclic
// bindings are only dereferenced inside method bodies, never at module load, so
// ES module evaluation order is safe.
import { Artist } from '../artist/artist.js';
import { Album } from '../album/album.js';
import type { DownloadInfo, LosslessDownloadInfo, SimilarTracks, TrackFullInfo, TrackLyrics } from './extras.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/**
 * A music track.
 *
 * In addition to plain data, a track carries convenience methods (such as
 * {@link Track.getDownloadInfo}) that delegate to the owning {@link Client}.
 */
export class Track extends YandexMusicModel {
  /** Unique track identifier. */
  id?: string | number;
  /** Track title. */
  title?: string;
  /** Whether the track is available for playback. */
  available?: boolean;
  /** Performing artists. */
  artists?: Artist[];
  /** Albums the track belongs to. */
  albums?: Album[];
  /** Whether available for premium users. */
  availableForPremiumUsers?: boolean;
  /** Whether lyrics are available. */
  lyricsAvailable?: boolean;
  /** Matched lyric ranges (poetry-lover feature). */
  poetryLoverMatches?: PoetryLoverMatch[];
  /** Whether this is the "best" track. */
  best?: boolean;
  /** Canonical track id when this track is a duplicate. */
  realId?: string | number;
  /** Open Graph image URI template. */
  ogImage?: string;
  /** Track kind, for example `music` or `podcast-episode`. */
  type?: string;
  /** Cover URI template. */
  coverUri?: string;
  /** Content provider major. */
  major?: Major;
  /** Duration in milliseconds. */
  durationMs?: number;
  /** Storage directory. */
  storageDir?: string;
  /** File size in bytes. */
  fileSize?: number;
  /** Track substituted for this one when unavailable. */
  substituted?: Track;
  /** Track this one matched against (search). */
  matchedTrack?: Track;
  /** Loudness normalization parameters. */
  normalization?: Normalization;
  /** Error code when the track could not be resolved. */
  error?: string;
  /** Whether the track can be published. */
  canPublish?: boolean;
  /** Publication state. */
  state?: string;
  /** Desired visibility. */
  desiredVisibility?: string;
  /** Original filename (user-uploaded tracks). */
  filename?: string;
  /** Embedded tag metadata. */
  metaData?: MetaData;
  /** Regions where available. */
  regions?: string[];
  /** Whether available as a ringback tone. */
  availableAsRbt?: boolean;
  /** Content warning marker. */
  contentWarning?: string;
  /** Explicit marker. */
  explicit?: boolean;
  /** Preview duration in milliseconds. */
  previewDurationMs?: number;
  /** Whether the full track is available without a subscription. */
  availableFullWithoutPermission?: boolean;
  /** Version (for example "Remastered"). */
  version?: string;
  /** Whether playback position is remembered (podcasts). */
  rememberPosition?: boolean;
  /** Background video URI for the track. */
  backgroundVideoUri?: string;
  /** Short description (podcasts). */
  shortDescription?: string;
  /** Whether suitable for children. */
  isSuitableForChildren?: boolean;
  /** Source of the track. */
  trackSource?: string;
  /** Options the track is available for. */
  availableForOptions?: string[];
  /** Lyrics availability flags. */
  lyricsInfo?: LyricsInfo;
  /** Sharing flag. */
  trackSharingFlag?: string;
  /** Colors derived from the cover. */
  derivedColors?: CoverDerivedColors;
  /** Crossfade timings. */
  fade?: Fade;
  /** Smart preview parameters. */
  smartPreviewParams?: SmartPreviewParams;
  /** Special audio resource identifiers. */
  specialAudioResources?: string[];
  /** Disclaimers. */
  disclaimers?: string[];
  /** Background video identifier. */
  backgroundVideoId?: string;
  /** Player identifier. */
  playerId?: string;

  /**
   * Deserialize a {@link Track}.
   *
   * @param raw - Raw JSON value from the API.
   * @param client - The owning client.
   * @returns The model, or `null` when `raw` is not an object.
   */
  static deJson(raw: JSONValue | undefined, client?: Client): Track | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Track(client);
    assign(model, raw, [
      'id',
      'title',
      'available',
      'availableForPremiumUsers',
      'lyricsAvailable',
      'best',
      'realId',
      'ogImage',
      'type',
      'coverUri',
      'durationMs',
      'storageDir',
      'fileSize',
      'error',
      'canPublish',
      'state',
      'desiredVisibility',
      'filename',
      'regions',
      'availableAsRbt',
      'contentWarning',
      'explicit',
      'previewDurationMs',
      'availableFullWithoutPermission',
      'version',
      'rememberPosition',
      'backgroundVideoUri',
      'shortDescription',
      'isSuitableForChildren',
      'trackSource',
      'availableForOptions',
      'trackSharingFlag',
      'specialAudioResources',
      'disclaimers',
      'backgroundVideoId',
      'playerId',
    ]);
    model.artists = deList(Artist.deJson, raw['artists'], client);
    model.albums = deList(Album.deJson, raw['albums'], client);
    model.poetryLoverMatches = deList(PoetryLoverMatch.deJson, raw['poetryLoverMatches'], client);
    model.major = Major.deJson(raw['major'], client) ?? undefined;
    model.substituted = Track.deJson(raw['substituted'], client) ?? undefined;
    model.matchedTrack = Track.deJson(raw['matchedTrack'], client) ?? undefined;
    model.normalization = Normalization.deJson(raw['normalization'], client) ?? undefined;
    model.metaData = MetaData.deJson(raw['metaData'], client) ?? undefined;
    model.lyricsInfo = LyricsInfo.deJson(raw['lyricsInfo'], client) ?? undefined;
    model.derivedColors = CoverDerivedColors.deJson(raw['derivedColors'], client) ?? undefined;
    model.fade = Fade.deJson(raw['fade'], client) ?? undefined;
    model.smartPreviewParams = SmartPreviewParams.deJson(raw['smartPreviewParams'], client) ?? undefined;
    return model;
  }

  /**
   * Resolve the numeric portion of this track's id (drops any `:album` suffix).
   *
   * @returns The track id as-is, suitable for passing to API methods.
   * @throws {Error} When the track has no id.
   */
  trackId(): string | number {
    if (this.id === undefined) {
      throw new Error('Track has no id.');
    }
    return this.id;
  }

  /**
   * Fetch the available download variants for this track.
   *
   * @returns The list of download options.
   * @throws {YandexMusicError} On any transport or API error.
   */
  getDownloadInfo(): Promise<DownloadInfo[]> {
    return this.requireClient().tracksDownloadInfo(this.trackId());
  }

  /**
   * Fetch lossless (FLAC) download info for this track via `/get-file-info`.
   *
   * @param quality - Requested quality. Defaults to `lossless`.
   * @returns The file info, or `null`. See {@link LosslessDownloadInfo}.
   * @throws {YandexMusicError} On any transport or API error.
   */
  getLosslessInfo(quality = 'lossless'): Promise<LosslessDownloadInfo | null> {
    return this.requireClient().tracksLosslessInfo(this.trackId(), quality);
  }

  /**
   * Fetch the lyrics of this track.
   *
   * @param format - `TEXT` (plain) or `LRC` (time-synced). Defaults to `TEXT`.
   * @returns The lyrics, or `null` when none exist.
   * @throws {YandexMusicError} On any transport or API error.
   */
  getLyrics(format: 'TEXT' | 'LRC' = 'TEXT'): Promise<TrackLyrics | null> {
    return this.requireClient().tracksLyrics(this.trackId(), format);
  }

  /**
   * Fetch tracks similar to this one.
   *
   * @returns The similar-tracks result, or `null`.
   * @throws {YandexMusicError} On any transport or API error.
   */
  getSimilar(): Promise<SimilarTracks | null> {
    return this.requireClient().tracksSimilar(this.trackId());
  }

  /**
   * Fetch full information about this track.
   *
   * @returns The full track info, or `null`.
   * @throws {YandexMusicError} On any transport or API error.
   */
  getFullInfo(): Promise<TrackFullInfo | null> {
    return this.requireClient().tracksFullInfo(this.trackId());
  }
}
