/**
 * The {@link Genre} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, deRecord, isJsonObject, reportUnknown } from '../base.js';
import { Icon } from './common.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** A genre's localized title (one entry of {@link Genre.titles}). */
export class GenreTitle extends YandexMusicModel {
  /** Short title. */
  title?: string;
  /** Full title. */
  fullTitle?: string;

  /** @see {@link GenreTitle} */
  static deJson(raw: JSONValue | undefined, client?: Client): GenreTitle | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new GenreTitle(client);
    assign(model, raw, ['title', 'fullTitle']);
    reportUnknown(client, 'GenreTitle', raw, model);
    return model;
  }
}

/** A music genre, possibly containing sub-genres. */
export class Genre extends YandexMusicModel {
  /** Genre id. */
  id?: string;
  /** Sorting weight. */
  weight?: number;
  /** Whether composers are highlighted for this genre. */
  composerTop?: boolean;
  /** Default title. */
  title?: string;
  /** Localized titles keyed by language code (`ru`, `en`, …). */
  titles?: Record<string, GenreTitle>;
  /** Genre images (raw JSON, pending a typed model). */
  images?: JSONValue;
  /** Whether shown in the genre menu. */
  showInMenu?: boolean;
  /** Region codes where shown. */
  showInRegions?: number[];
  /** Region codes where hidden. */
  hideInRegions?: number[];
  /** Full title. */
  fullTitle?: string;
  /** URL slug. */
  urlPart?: string;
  /** Accent color. */
  color?: string;
  /** Radio icon. */
  radioIcon?: Icon;
  /** Nested sub-genres. */
  subGenres?: Genre[];

  /** @see {@link Genre} */
  static deJson(raw: JSONValue | undefined, client?: Client): Genre | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Genre(client);
    assign(model, raw, [
      'id',
      'weight',
      'composerTop',
      'title',
      'images',
      'showInMenu',
      'showInRegions',
      'hideInRegions',
      'fullTitle',
      'urlPart',
      'color',
    ]);
    model.titles = deRecord(GenreTitle.deJson, raw['titles'], client);
    model.radioIcon = Icon.deJson(raw['radioIcon'], client) ?? undefined;
    model.subGenres = deList(Genre.deJson, raw['subGenres'], client);
    reportUnknown(client, 'Genre', raw, model);
    return model;
  }
}
