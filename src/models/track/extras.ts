/**
 * Track-adjacent models: download info, lyrics, similar tracks, full info, trailer.
 *
 * @packageDocumentation
 */
import { createHash, createDecipheriv, type Decipher } from 'node:crypto';
import type { Transform } from 'node:stream';
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { ForbiddenError, GoneError, InvalidResponseError, YandexMusicError } from '../../exceptions.js';
import { DEFAULT_DOWNLOAD_TIMEOUT_MS } from '../../request.js';
import { LyricsMajor, R128 } from './nested.js';
import { Track } from './track.js';
import { Artist } from '../artist/artist.js';
import type { Client } from '../../client.js';
import type { RequestOptions } from '../../request.js';
import type { JSONValue } from '../../types.js';

/** Options for the download helpers: a caller `signal` and an overall `timeout` (ms). */
export type DownloadOptions = Pick<RequestOptions, 'signal' | 'timeout'>;

/** Salt used to sign direct download links. */
const SIGN_SALT = 'XGRlBW9FXlekgbPrRHuSiA';

/**
 * How long (ms) a resolved {@link DownloadInfo.directLink} is reused. The server
 * keeps the signed link valid for about a minute; past this age it is resolved
 * again before downloading.
 */
export const DIRECT_LINK_TTL_MS = 50_000;

function xmlTagText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(xml);
  return match ? match[1]!.trim() : '';
}

/** Whether a mirror loop must stop: a caller abort or a local failure (disk, key) that no other URL can fix. */
function isFinal(error: unknown): boolean {
  return error instanceof YandexMusicError && error.status === undefined && !error.retryable;
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
  /** `Date.now()` when {@link DownloadInfo.directLink} was resolved. */
  directLinkResolvedAt?: number;

  /** @see {@link DownloadInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): DownloadInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new DownloadInfo(client);
    assign(model, raw, ['codec', 'bitrateInKbps', 'gain', 'preview', 'downloadInfoUrl', 'direct']);
    reportUnknown(client, 'DownloadInfo', raw, model);
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
   * an HTTP 410. The result is cached in {@link DownloadInfo.directLink} (with
   * {@link DownloadInfo.directLinkResolvedAt}); {@link DownloadInfo.download} and
   * {@link DownloadInfo.downloadBytes} reuse it for {@link DIRECT_LINK_TTL_MS}
   * and resolve it again when it is older or the CDN answers 403/410.
   *
   * @param options - Optional `signal` / `timeout`.
   * @returns The direct download URL.
   * @throws {InvalidResponseError} When the info XML lacks `host`, `path`, `ts` or `s`.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async getDirectLink(options: DownloadOptions = {}): Promise<string> {
    if (!this.downloadInfoUrl) {
      throw new InvalidResponseError('DownloadInfo has no downloadInfoUrl.');
    }
    const bytes = await this.requireClient().request.retrieve(this.downloadInfoUrl, undefined, options);
    const xml = new TextDecoder('utf-8').decode(bytes);
    const host = xmlTagText(xml, 'host');
    const path = xmlTagText(xml, 'path');
    const ts = xmlTagText(xml, 'ts');
    const s = xmlTagText(xml, 's');
    if (!host || /[/?#\s]/.test(host) || !path.startsWith('/') || !ts || !s) {
      throw new InvalidResponseError(`Unexpected download-info response: ${xml.slice(0, 200).trim()}`);
    }
    const sign = createHash('md5')
      .update(SIGN_SALT + path.slice(1) + s, 'utf8')
      .digest('hex');
    this.directLink = `https://${host}/get-mp3/${sign}/${ts}${path}`;
    this.directLinkResolvedAt = Date.now();
    return this.directLink;
  }

  /** Whether the cached {@link DownloadInfo.directLink} is missing or older than {@link DIRECT_LINK_TTL_MS}. */
  get directLinkExpired(): boolean {
    return (
      !this.directLink ||
      this.directLinkResolvedAt === undefined ||
      Date.now() - this.directLinkResolvedAt >= DIRECT_LINK_TTL_MS
    );
  }

  /**
   * Run `use` with a fresh direct link; when a cached link is rejected with
   * 403/410 (expired signature), resolve it once more and retry.
   */
  private async withDirectLink<T>(options: DownloadOptions, use: (link: string) => Promise<T>): Promise<T> {
    const cached = this.directLinkExpired ? undefined : this.directLink;
    const link = cached ?? (await this.getDirectLink({ signal: options.signal }));
    try {
      return await use(link);
    } catch (error) {
      if (cached && (error instanceof GoneError || error instanceof ForbiddenError)) {
        return use(await this.getDirectLink({ signal: options.signal }));
      }
      throw error;
    }
  }

  /**
   * Download the track and return it as bytes.
   *
   * @param options - Optional `signal` / `timeout`.
   * @returns The audio file contents.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async downloadBytes(options: DownloadOptions = {}): Promise<Uint8Array> {
    const request = this.requireClient().request;
    return this.withDirectLink(options, (link) =>
      request.retrieve(link, options.timeout ?? DEFAULT_DOWNLOAD_TIMEOUT_MS, { signal: options.signal }),
    );
  }

  /**
   * Download the track straight to a file on disk.
   *
   * @param filename - Destination path, including extension.
   * @param options - Optional `signal` / `timeout`.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async download(filename: string, options: DownloadOptions = {}): Promise<void> {
    const request = this.requireClient().request;
    await this.withDirectLink(options, (link) => request.streamToFile(link, filename, options));
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
  const decipher = encrawDecipher(keyHex);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

/**
 * Build the AES-CTR decipher transform for an `encraw` stream from its hex key.
 *
 * AES-CTR is a stream cipher, so this can be piped (decrypting on the fly during
 * a streaming download) as well as run over a whole buffer. The IV is 16 zero
 * bytes; the key length selects AES-128 vs AES-256.
 *
 * @param keyHex - The hex AES-CTR key from `/get-file-info`.
 * @returns A fresh decipher transform (single-use).
 */
export function encrawDecipher(keyHex: string): Decipher {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.alloc(16);
  const algo = key.length === 32 ? 'aes-256-ctr' : 'aes-128-ctr';
  return createDecipheriv(algo, key, iv);
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
  /** Whether loudness-normalization gain data is available. */
  gain?: boolean;
  /** Canonical track id when the requested id is an alias. */
  realId?: string;
  /** Loudness (EBU R128 integrated loudness `i` and true peak `tp`), sent by `/resources/v2/file-info`. */
  r128?: R128;

  /** @see {@link LosslessDownloadInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): LosslessDownloadInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LosslessDownloadInfo(client);
    assign(model, raw, [
      'trackId',
      'quality',
      'codec',
      'bitrate',
      'transport',
      'key',
      'urls',
      'url',
      'size',
      'gain',
      'realId',
    ]);
    model.r128 = R128.deJson(raw['r128'], client) ?? undefined;
    reportUnknown(client, 'LosslessDownloadInfo', raw, model);
    return model;
  }

  /** Whether this is a true lossless (FLAC) variant. */
  get isLossless(): boolean {
    return this.codec === 'flac' || this.codec === 'flac-mp4';
  }

  /** Whether the stream is AES-CTR-encrypted: a key is present and the transport is not explicitly `raw` (a missing transport counts as encrypted). */
  get isEncrypted(): boolean {
    return this.transport !== 'raw' && Boolean(this.key);
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
      throw new InvalidResponseError('LosslessDownloadInfo has no stream URL.');
    }
    return link;
  }

  /**
   * Download the audio as bytes, transparently AES-CTR-decrypting an `encraw`
   * stream (a {@link key} is present and the transport is not `raw`); `raw` bytes are returned unchanged.
   *
   * `/get-file-info` returns several mirror URLs on different CDN hosts; this
   * tries each in order so a single flaky host doesn't fail the download.
   *
   * @param options - Optional `signal` / `timeout`.
   * @returns The decoded audio file contents.
   * @throws {YandexMusicError} On any transport or API error (the last one, after
   *   every candidate URL fails).
   */
  async downloadBytes(options: DownloadOptions = {}): Promise<Uint8Array> {
    const links = this.links();
    if (links.length === 0) {
      throw new InvalidResponseError('LosslessDownloadInfo has no stream URL.');
    }
    const request = this.requireClient().request;
    let bytes: Uint8Array | undefined;
    let lastError: unknown;
    for (const link of links) {
      try {
        bytes = await request.retrieve(link, options.timeout ?? DEFAULT_DOWNLOAD_TIMEOUT_MS, { signal: options.signal });
        break;
      } catch (error) {
        lastError = error;
        if (isFinal(error)) {
          break;
        }
      }
    }
    if (bytes === undefined) {
      throw lastError;
    }
    if (!this.isEncrypted) {
      return bytes;
    }
    try {
      return decryptEncraw(bytes, this.key!);
    } catch (error) {
      throw new YandexMusicError(`Cannot decrypt the stream: ${(error as Error).message}`, { cause: error, retryable: false });
    }
  }

  /**
   * Download the audio straight to a file on disk, streaming it and transparently
   * AES-CTR-decrypting an `encraw` stream on the fly when {@link key} is present.
   *
   * Streaming keeps memory O(chunk) rather than buffering the whole (large, for
   * lossless) file. Mirror URLs are tried in order, so a flaky host falls back to
   * the next.
   *
   * @param filename - Destination path, including extension.
   * @param options - Set `race: true` to race all mirror URLs and commit to the
   *   fastest responder (cuts tail latency when a host is slow; falls back to
   *   sequential on failure). Defaults to sequential mirror failover. `signal`
   *   cancels the download, `timeout` caps it (ms).
   * @throws {YandexMusicError} On any transport or API error (the last one, after
   *   every candidate URL fails).
   */
  async download(filename: string, options: DownloadOptions & { race?: boolean } = {}): Promise<void> {
    const links = this.links();
    if (links.length === 0) {
      throw new InvalidResponseError('LosslessDownloadInfo has no stream URL.');
    }
    const request = this.requireClient().request;
    const key = this.isEncrypted ? this.key : undefined;
    const transform = key ? (): Transform => encrawDecipher(key) : undefined;
    const stream = { transform, signal: options.signal, timeout: options.timeout };
    if (options.race) {
      return request.raceToFile(links, filename, stream);
    }
    let lastError: unknown;
    for (const link of links) {
      try {
        await request.streamToFile(link, filename, stream);
        return;
      } catch (error) {
        lastError = error;
        if (isFinal(error)) {
          break;
        }
      }
    }
    throw lastError;
  }
}

/** Reference-library name for {@link LosslessDownloadInfo}. */
export const FileDownloadInfo = LosslessDownloadInfo;
/** Reference-library name for {@link LosslessDownloadInfo}. */
export type FileDownloadInfo = LosslessDownloadInfo;

/** Result of `/get-file-info`: wraps the {@link LosslessDownloadInfo} (`downloadInfo`). */
export class FileInfo extends YandexMusicModel {
  /** The download info of the file. */
  downloadInfo?: LosslessDownloadInfo;

  /** @see {@link FileInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): FileInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new FileInfo(client);
    const info = LosslessDownloadInfo.deJson(raw['downloadInfo'], client);
    if (info) {
      model.downloadInfo = info;
    }
    reportUnknown(client, 'FileInfo', raw, model, ['downloadInfo']);
    return model;
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
    reportUnknown(client, 'TrackLyrics', raw, model);
    return model;
  }

  /**
   * Fetch the raw lyrics text (plain or LRC, matching the requested format).
   *
   * @param options - Optional `signal` / `timeout`.
   * @returns The lyrics text.
   * @throws {YandexMusicError} On any transport or API error.
   */
  async fetchLyrics(options: DownloadOptions = {}): Promise<string> {
    if (!this.downloadUrl) {
      throw new InvalidResponseError('TrackLyrics has no downloadUrl.');
    }
    const bytes = await this.requireClient().request.retrieve(this.downloadUrl, options.timeout, { signal: options.signal });
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
    reportUnknown(client, 'SimilarTracks', raw, model);
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
    reportUnknown(client, 'TrackTrailer', raw, model);
    return model;
  }
}
