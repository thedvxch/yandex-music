/**
 * Pagination metadata returned by list endpoints.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** Pagination cursor describing a single page of a larger result set. */
export class Pager extends YandexMusicModel {
  /** Total number of items across all pages. */
  total?: number;
  /** Current page index (0-based). */
  page?: number;
  /** Number of items per page. */
  perPage?: number;

  /** @see {@link Pager} */
  static deJson(raw: JSONValue | undefined, client?: Client): Pager | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Pager(client);
    assign(model, raw, ['total', 'page', 'perPage']);
    reportUnknown(client, 'Pager', raw, model);
    return model;
  }
}
