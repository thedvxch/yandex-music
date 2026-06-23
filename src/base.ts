/**
 * Base class and helpers shared by every model in the library.
 *
 * @packageDocumentation
 */
import type { Client } from './client.js';
import type { DeJson, JSONObject, JSONValue } from './types.js';

/**
 * Type guard narrowing an arbitrary {@link JSONValue} to a JSON object.
 *
 * @param data - The value to test.
 * @returns `true` when `data` is a non-null, non-array object.
 */
export function isJsonObject(data: JSONValue | undefined): data is JSONObject {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

/**
 * Deserialize an array of raw JSON objects into typed model instances.
 *
 * Non-object entries and entries the deserializer rejects (returns `null`) are
 * skipped, so the result only contains successfully parsed models.
 *
 * @typeParam T - The model type produced.
 * @param deJson - The per-model deserializer (typically `Model.deJson`).
 * @param data - A raw JSON array, or any value (returns `[]` when not an array).
 * @param client - The owning {@link Client}, propagated to each model.
 * @returns The list of successfully deserialized models.
 */
export function deList<T>(deJson: DeJson<T>, data: JSONValue | undefined, client?: Client): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const result: T[] = [];
  for (const item of data) {
    const model = deJson(item, client);
    if (model !== null) {
      result.push(model);
    }
  }

  return result;
}

/**
 * When the owning client has `reportUnknownFields` enabled, warn about keys the
 * API returned that the finished model did not map.
 *
 * Called at the end of a `deJson` once every field (scalar and nested) is
 * assigned: any raw key without a matching own-property on the model is unmapped.
 * This relies on the library's verbatim camelCase mapping (model field names
 * equal API keys), which holds throughout. Opt-in and side-effect-free unless the
 * flag is set, so it is safe to leave wired into every model.
 *
 * @param client - The owning client (carries the `reportUnknownFields` flag).
 * @param label - Model name, used in the warning.
 * @param raw - The raw JSON object the model was built from.
 * @param model - The finished model instance.
 * @param alsoKnown - Raw keys consumed under a different model field name (for
 *   example a snake_case API key mapped to a camelCase field); not reported.
 */
export function reportUnknown(
  client: Client | undefined,
  label: string,
  raw: JSONObject,
  model: object,
  alsoKnown?: readonly string[],
): void {
  if (!client?.reportUnknownFields) {
    return;
  }
  const known = new Set(Object.keys(model));
  if (alsoKnown) {
    for (const key of alsoKnown) {
      known.add(key);
    }
  }
  const unknown = Object.keys(raw).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[yandex-music] ${label}: API returned unmapped field(s): ${unknown.join(', ')}`);
  }
}

/**
 * Copy a set of scalar fields straight from a raw JSON object onto a model.
 *
 * The API already returns keys in camelCase, matching the library's field names,
 * so plain pass-through copying is correct for primitive fields. Nested objects
 * and arrays of models are handled explicitly by each model's `deJson`.
 *
 * @typeParam T - The model type being populated.
 * @param target - The model instance to assign onto.
 * @param raw - The raw JSON object from the API.
 * @param keys - The field names to copy when present in `raw`.
 */
export function assign<T extends object>(target: T, raw: JSONObject, keys: readonly (keyof T & string)[]): void {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined) {
      (target as Record<string, JSONValue>)[key] = value;
    }
  }
}

/**
 * Base class for every model returned by the API.
 *
 * Holds a back-reference to the {@link Client} that produced the model so that
 * convenience methods (for example downloading a track) can issue further
 * requests without the caller threading the client around manually.
 */
export abstract class YandexMusicModel {
  /** The client that created this model, used by convenience methods. */
  client?: Client;

  /**
   * @param client - The owning client, stored for later convenience calls.
   */
  constructor(client?: Client) {
    this.client = client;
  }

  /**
   * Assert that this model carries a client, returning it narrowed to non-null.
   *
   * Convenience methods that need to call the API use this to fail fast with a
   * clear message instead of a generic "cannot read property of undefined".
   *
   * @returns The owning {@link Client}.
   * @throws {Error} When the model was created without a client.
   */
  protected requireClient(): Client {
    if (!this.client) {
      throw new Error('This operation requires a Client, but the model was created without one.');
    }
    return this.client;
  }
}
