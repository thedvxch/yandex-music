/**
 * The {@link Genre} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../base.js';
import { Icon } from './common.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

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
  /** Localized titles keyed by language (raw JSON, pending a typed model). */
  titles?: JSONValue;
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
      'titles',
      'images',
      'showInMenu',
      'showInRegions',
      'hideInRegions',
      'fullTitle',
      'urlPart',
      'color',
    ]);
    model.radioIcon = Icon.deJson(raw['radioIcon'], client) ?? undefined;
    model.subGenres = deList(Genre.deJson, raw['subGenres'], client);
    reportUnknown(client, 'Genre', raw, model);
    return model;
  }
}
