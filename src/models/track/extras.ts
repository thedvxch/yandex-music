/**
 * Track-adjacent models: download info, lyrics, similar tracks, full info, trailer.
 *
 * @packageDocumentation
 */
import { createHash } from 'node:crypto';
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { LyricsMajor } from './nested.js';
import { Track } from './track.js';
import { Artist } from '../artist/artist.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** Salt used to sign direct download links. */
const SIGN_SALT = 'XGRlBW9FXlekgbPrRHuSiA';

function xmlTagText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return match ? match[1]! : '';
}

/**
 * One download variant of a track (codec + bitrate), plus the means to resolve a
 * short-lived direct file URL.
 */
export class DownloadInfo extends YandexMusicModel {
  /** Audio codec, for example `mp3` or `aac`. */
  codec?: string;
  /** Bitrate in kbit/s. */
  bitrateInKbps?: number;
  /** Whether gain is applied. */
  gain?: boolean;
  /** Whether this is a preview rather than the full track. */
  preview?: boolean;
  /** URL of the XML document describing how to build the direct link. */
  downloadInfoUrl?: string;
  /** Whether the link is already direct. */
  direct?: boolean;
  /** Cached resolved direct link, populated by {@link DownloadInfo.getDirectLink}. */
  directLink?: string;

  /** @see {@link DownloadInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): DownloadInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new DownloadInfo(client);
    assign(model, raw, ['codec', 'bitrateInKbps', 'gain', 'preview', 'downloadInfoUrl', 'direct']);
    return model;
  }

  /**
   * Deserialize a list of {@link DownloadInfo}, optionally resolving direct links.
   *
   * @param raw - Raw JSON array from the API.
   * @param client - The owning client.
   * @param getDirectLinks - When `true`, resolve every direct link eagerly.
   * @returns The list of download variants.
   */
  static async deListAsync(
    raw: JSONValue | undefined,
    client?: Client,
    getDirectLinks = false,
  ): Promise<DownloadInfo[]> {
    const infos = deList(DownloadInfo.deJson, raw, client);
    if (getDirectLinks) {
      for (const info of infos) {
        await info.getDirectLink();
      }
    }
    return infos;
  }

  /**
   * Resolve the short-lived direct download URL from the info XML.
   *
   * The resolved URL is valid for roughly one minute; requesting it later yields
   * an HTTP 410. The result is cached in {@link DownloadInfo.directLink}.
   *
   * @returns The direct download URL.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async getDirectLink(): Promise<string> {
    if (!this.downloadInfoUrl) {
      throw new Error('DownloadInfo has no downloadInfoUrl.');
    }
    const bytes = await this.requireClient().request.retrieve(this.downloadInfoUrl);
    const xml = new TextDecoder('utf-8').decode(bytes);
    const host = xmlTagText(xml, 'host');
    const path = xmlTagText(xml, 'path');
    const ts = xmlTagText(xml, 'ts');
    const s = xmlTagText(xml, 's');
    const sign = createHash('md5')
      .update(SIGN_SALT + path.slice(1) + s, 'utf8')
      .digest('hex');
    this.directLink = `https://${host}/get-mp3/${sign}/${ts}${path}`;
    return this.directLink;
  }

  /**
   * Download the track and return it as bytes.
   *
   * @returns The audio file contents.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async downloadBytes(): Promise<Uint8Array> {
    const link = this.directLink ?? (await this.getDirectLink());
    return this.requireClient().request.retrieve(link);
  }

  /**
   * Download the track straight to a file on disk.
   *
   * @param filename - Destination path, including extension.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async download(filename: string): Promise<void> {
    const link = this.directLink ?? (await this.getDirectLink());
    await this.requireClient().request.download(link, filename);
  }
}

/** Lyrics of a track. */
export class TrackLyrics extends YandexMusicModel {
  /** URL the raw lyrics text is fetched from. */
  downloadUrl?: string;
  /** Lyric identifier. */
  lyricId?: number;
  /** External lyric identifier. */
  externalLyricId?: string;
  /** Writer credits. */
  writers?: string[];
  /** Lyrics provider major. */
  major?: LyricsMajor;

  /** @see {@link TrackLyrics} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackLyrics | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackLyrics(client);
    assign(model, raw, ['downloadUrl', 'lyricId', 'externalLyricId', 'writers']);
    model.major = LyricsMajor.deJson(raw['major'], client) ?? undefined;
    return model;
  }

  /**
   * Fetch the raw lyrics text (plain or LRC, matching the requested format).
   *
   * @returns The lyrics text.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async fetchLyrics(): Promise<string> {
    if (!this.downloadUrl) {
      throw new Error('TrackLyrics has no downloadUrl.');
    }
    const bytes = await this.requireClient().request.retrieve(this.downloadUrl);
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** A track together with tracks similar to it. */
export class SimilarTracks extends YandexMusicModel {
  /** The reference track. */
  track?: Track;
  /** Tracks similar to {@link SimilarTracks.track}. */
  similarTracks?: Track[];

  /** @see {@link SimilarTracks} */
  static deJson(raw: JSONValue | undefined, client?: Client): SimilarTracks | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SimilarTracks(client);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    model.similarTracks = deList(Track.deJson, raw['similarTracks'], client);
    return model;
  }
}

/** Full information about a track, including related content. */
export class TrackFullInfo extends YandexMusicModel {
  /** The track itself. */
  track?: Track;
  /** Similar tracks. */
  similarTracks?: Track[];
  /** Other albums the track appears in. */
  alsoInAlbums?: Track[];
  /** Title aliases. */
  aliases?: string[];
  /** Related artists. */
  artists?: Artist[];

  /** @see {@link TrackFullInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackFullInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackFullInfo(client);
    assign(model, raw, ['aliases']);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    model.similarTracks = raw['similarTracks'] ? deList(Track.deJson, raw['similarTracks'], client) : undefined;
    model.alsoInAlbums = raw['alsoInAlbums'] ? deList(Track.deJson, raw['alsoInAlbums'], client) : undefined;
    model.artists = raw['artists'] ? deList(Artist.deJson, raw['artists'], client) : undefined;
    return model;
  }
}

/** A track trailer. */
export class TrackTrailer extends YandexMusicModel {
  /** Trailer title. */
  title?: string;
  /** The trailer track. */
  track?: Track;

  /** @see {@link TrackTrailer} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackTrailer | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackTrailer(client);
    assign(model, raw, ['title']);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    return model;
  }
}
