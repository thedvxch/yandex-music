/**
 * Value objects nested inside {@link Track}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../../base.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A content provider / label major associated with a track. */
export class Major extends YandexMusicModel {
  /** Major identifier. */
  id?: number;
  /** Major name. */
  name?: string;

  /** @see {@link Major} */
  static deJson(raw: JSONValue | undefined, client?: Client): Major | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Major(client);
    assign(model, raw, ['id', 'name']);
    reportUnknown(client, 'Major', raw, model);
    return model;
  }
}

/** Loudness normalization parameters (ReplayGain-style). */
export class Normalization extends YandexMusicModel {
  /** Gain adjustment in dB. */
  gain?: number;
  /** Peak sample value. */
  peak?: number;

  /** @see {@link Normalization} */
  static deJson(raw: JSONValue | undefined, client?: Client): Normalization | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Normalization(client);
    assign(model, raw, ['gain', 'peak']);
    reportUnknown(client, 'Normalization', raw, model);
    return model;
  }
}

/** A matched range of a track's lyrics (used by the "poetry lover" feature). */
export class PoetryLoverMatch extends YandexMusicModel {
  /** Start character offset within the matched line. */
  begin?: number;
  /** End character offset within the matched line. */
  end?: number;
  /** Line number of the match. */
  line?: number;

  /** @see {@link PoetryLoverMatch} */
  static deJson(raw: JSONValue | undefined, client?: Client): PoetryLoverMatch | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PoetryLoverMatch(client);
    assign(model, raw, ['begin', 'end', 'line']);
    reportUnknown(client, 'PoetryLoverMatch', raw, model);
    return model;
  }
}

/** Availability of lyrics for a track. */
export class LyricsInfo extends YandexMusicModel {
  /** Whether time-synced (LRC) lyrics are available. */
  hasAvailableSyncLyrics?: boolean;
  /** Whether plain-text lyrics are available. */
  hasAvailableTextLyrics?: boolean;

  /** @see {@link LyricsInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): LyricsInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LyricsInfo(client);
    assign(model, raw, ['hasAvailableSyncLyrics', 'hasAvailableTextLyrics']);
    reportUnknown(client, 'LyricsInfo', raw, model);
    return model;
  }
}

/** Fade-in/fade-out timing for smart previews and crossfade. */
export class Fade extends YandexMusicModel {
  /** Fade-in start time in seconds. */
  inStart?: number;
  /** Fade-in stop time in seconds. */
  inStop?: number;
  /** Fade-out start time in seconds. */
  outStart?: number;
  /** Fade-out stop time in seconds. */
  outStop?: number;

  /** @see {@link Fade} */
  static deJson(raw: JSONValue | undefined, client?: Client): Fade | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Fade(client);
    assign(model, raw, ['inStart', 'inStop', 'outStart', 'outStop']);
    reportUnknown(client, 'Fade', raw, model);
    return model;
  }
}

/** Parameters describing the "smart" (auto-selected) preview of a track. */
export class SmartPreviewParams extends YandexMusicModel {
  /** Preview duration in milliseconds. */
  durationMs?: number;
  /** Fade timing for the preview. */
  fade?: Fade;

  /** @see {@link SmartPreviewParams} */
  static deJson(raw: JSONValue | undefined, client?: Client): SmartPreviewParams | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SmartPreviewParams(client);
    assign(model, raw, ['durationMs']);
    model.fade = Fade.deJson(raw['fade'], client) ?? undefined;
    reportUnknown(client, 'SmartPreviewParams', raw, model);
    return model;
  }
}

/** Track metadata as embedded in file tags. */
export class MetaData extends YandexMusicModel {
  /** Album title. */
  album?: string;
  /** Volume (disc) number. */
  volume?: number;
  /** Release year. */
  year?: number;
  /** Track number within the volume. */
  number?: number;
  /** Genre. */
  genre?: string;
  /** Lyricist credit. */
  lyricist?: string;
  /** Version (for example "Remastered"). */
  version?: string;
  /** Composer credit. */
  composer?: string;

  /** @see {@link MetaData} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetaData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetaData(client);
    assign(model, raw, ['album', 'volume', 'year', 'number', 'genre', 'lyricist', 'version', 'composer']);
    reportUnknown(client, 'MetaData', raw, model);
    return model;
  }
}

/** EBU R128 loudness measurements. */
export class R128 extends YandexMusicModel {
  /** Integrated loudness (LUFS). */
  i?: number;
  /** True peak (dBTP). */
  tp?: number;

  /** @see {@link R128} */
  static deJson(raw: JSONValue | undefined, client?: Client): R128 | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new R128(client);
    assign(model, raw, ['i', 'tp']);
    reportUnknown(client, 'R128', raw, model);
    return model;
  }
}

/** Label/major that owns a track's lyrics. */
export class LyricsMajor extends YandexMusicModel {
  /** Identifier. */
  id?: number;
  /** Internal name. */
  name?: string;
  /** Display name. */
  prettyName?: string;

  /** @see {@link LyricsMajor} */
  static deJson(raw: JSONValue | undefined, client?: Client): LyricsMajor | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new LyricsMajor(client);
    assign(model, raw, ['id', 'name', 'prettyName']);
    reportUnknown(client, 'LyricsMajor', raw, model);
    return model;
  }
}
