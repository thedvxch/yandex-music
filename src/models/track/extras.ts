/**
 * Track-adjacent models: download info, lyrics, similar tracks, full info, trailer.
 *
 * @packageDocumentation
 */
import { createHash, createDecipheriv } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
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

/**
 * Decrypt an `encraw` (AES-CTR) lossless stream with its hex key.
 *
 * The IV is 16 zero bytes (12-byte zero nonce + zero counter); the key length
 * selects AES-128 vs AES-256. Exported for consumers that run their own download
 * pipeline (streaming, progress, custom caching) off {@link LosslessDownloadInfo.urls}
 * + {@link LosslessDownloadInfo.key} instead of {@link LosslessDownloadInfo.downloadBytes}.
 *
 * @param data - The encrypted audio bytes.
 * @param keyHex - The hex AES-CTR key from `/get-file-info`.
 * @returns The decrypted audio bytes.
 */
export function decryptEncraw(data: Uint8Array, keyHex: string): Uint8Array {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.alloc(16);
  const algo = key.length === 32 ? 'aes-256-ctr' : 'aes-128-ctr';
  const decipher = createDecipheriv(algo, key, iv);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

/**
 * Lossless (and other modern) download info from `/get-file-info`.
 *
 * @remarks
 * With `transport: 'encraw'` the URLs serve an **AES-CTR-encrypted** stream and
 * {@link LosslessDownloadInfo.key} holds the hex decryption key;
 * {@link LosslessDownloadInfo.downloadBytes} fetches and decrypts it for you. The
 * endpoint falls back to a lossy codec when a track has no lossless source, so
 * check {@link LosslessDownloadInfo.codec} / {@link LosslessDownloadInfo.isLossless}.
 */
export class LosslessDownloadInfo extends YandexMusicModel {
  /** Track id this info belongs to. */
  trackId?: string;
  /** Requested/granted quality (for example `lossless`). */
  quality?: string;
  /** Actual codec served (`flac`, `flac-mp4`, `aac`, `mp3`, …). */
  codec?: string;
  /** Bitrate in kbit/s. */
  bitrate?: number;
  /** Transport, typically `encraw` (AES-CTR-encrypted raw stream). */
  transport?: string;
  /** Hex AES-CTR key used to decrypt an `encraw` stream, when encrypted. */
  key?: string;
  /** Candidate stream URLs (any one works). */
  urls?: string[];
  /** Single stream URL (older response shape). */
  url?: string;
  /** File size in bytes, when known. */
  size?: number;

  /** @see {@link LosslessDownloadInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): LosslessDownloadInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LosslessDownloadInfo(client);
    assign(model, raw, ['trackId', 'quality', 'codec', 'bitrate', 'transport', 'key', 'urls', 'url', 'size']);
    return model;
  }

  /** Whether this is a true lossless (FLAC) variant. */
  get isLossless(): boolean {
    return this.codec === 'flac' || this.codec === 'flac-mp4';
  }

  /** Every candidate stream URL, in preference order (`urls` then `url`). */
  links(): string[] {
    const all = [...(this.urls ?? []), this.url].filter((u): u is string => Boolean(u));
    return [...new Set(all)];
  }

  /**
   * Pick a stream URL.
   *
   * @returns The first candidate stream URL (the bytes may be encrypted — see {@link key}).
   * @throws When no URL is present.
   */
  getDirectLink(): string {
    const link = this.links()[0];
    if (!link) {
      throw new Error('LosslessDownloadInfo has no stream URL.');
    }
    return link;
  }

  /**
   * Download the audio as bytes, transparently AES-CTR-decrypting an `encraw`
   * stream when {@link key} is present.
   *
   * `/get-file-info` returns several mirror URLs on different CDN hosts; this
   * tries each in order so a single flaky host doesn't fail the download.
   *
   * @returns The decoded audio file contents.
   * @throws {YandexMusicError} On any transport or API error (the last one, after
   *   every candidate URL fails).
   */
  async downloadBytes(): Promise<Uint8Array> {
    const links = this.links();
    if (links.length === 0) {
      throw new Error('LosslessDownloadInfo has no stream URL.');
    }
    const request = this.requireClient().request;
    let lastError: unknown;
    for (const link of links) {
      try {
        const bytes = await request.retrieve(link);
        return this.key ? decryptEncraw(bytes, this.key) : bytes;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  /**
   * Download the audio straight to a file on disk (decrypting if needed).
   *
   * @param filename - Destination path, including extension.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async download(filename: string): Promise<void> {
    await writeFile(filename, await this.downloadBytes());
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
  /** Other versions of the track, keyed by version label (e.g. `live`, `remix`). */
  otherVersions?: Record<string, Track[]>;

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
    if (isJsonObject(raw['otherVersions'])) {
      const versions: Record<string, Track[]> = {};
      for (const [label, list] of Object.entries(raw['otherVersions'])) {
        versions[label] = deList(Track.deJson, list, client);
      }
      model.otherVersions = versions;
    }
    reportUnknown(client, 'TrackFullInfo', raw, model);
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
