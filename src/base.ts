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
 * Deserialize a map of raw JSON objects (keyed by string, e.g. by language) into
 * a record of typed models. Entries the deserializer rejects are skipped.
 *
 * @typeParam T - The model type produced.
 * @param deJson - The per-model deserializer.
 * @param data - A raw JSON object, or any value (returns `undefined` otherwise).
 * @param client - The owning {@link Client}, propagated to each model.
 * @returns The record of deserialized models, or `undefined` when empty/not an object.
 */
export function deRecord<T>(
  deJson: DeJson<T>,
  data: JSONValue | undefined,
  client?: Client,
): Record<string, T> | undefined {
  if (!isJsonObject(data)) {
    return undefined;
  }
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(data)) {
    const model = deJson(value, client);
    if (model !== null) {
      result[key] = model;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** A report of API keys a model did not map, passed to {@link UnknownFieldReporter}. */
export interface UnknownFieldsReport {
  /** The model name (the `label` passed to {@link reportUnknown}). */
  model: string;
  /** The raw API keys with no matching field on the finished model. */
  fields: string[];
  /** The raw JSON object the model was built from, for inspection. */
  raw: JSONObject;
  /**
   * Type-only shape of each unknown field's value (no data), for example
   * `list[{id: int, title: str}]`. Depth is capped at 3 and each string at 500 chars.
   */
  shapes?: Record<string, string>;
}

/**
 * A hook invoked when a model leaves API fields unmapped. Configure it via
 * `onUnknownField` on the client to route drift reports somewhere other than the
 * console (a logger, metrics, a test assertion).
 */
export type UnknownFieldReporter = (report: UnknownFieldsReport) => void;

const SHAPE_MAX_DEPTH = 3;
const SHAPE_MAX_LENGTH = 500;
const ID_SEGMENT = /^[\d:_-]*\d[\d:_-]*$|^[0-9a-fA-F-]{16,}$/;

function describeValue(value: JSONValue | undefined, depth: number): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'list[]';
    }
    if (depth >= SHAPE_MAX_DEPTH) {
      return 'list[...]';
    }
    const dicts: JSONObject[] = [];
    const variants = new Set<string>();
    for (const item of value) {
      if (isJsonObject(item)) {
        dicts.push(item);
      } else {
        variants.add(describeValue(item, depth + 1));
      }
    }
    if (dicts.length > 0) {
      variants.add(describeDicts(dicts, depth + 1));
    }
    return `list[${[...variants].sort().join(' | ')}]`;
  }
  if (typeof value === 'object') {
    return describeDicts([value], depth);
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float';
  }
  if (typeof value === 'boolean') {
    return 'bool';
  }
  return 'str';
}

function describeDicts(dicts: JSONObject[], depth: number): string {
  if (depth >= SHAPE_MAX_DEPTH) {
    return '{...}';
  }
  const keys = new Map<string, Set<string>>();
  for (const dict of dicts) {
    for (const [key, value] of Object.entries(dict)) {
      const name = ID_SEGMENT.test(key) ? '{id}' : key;
      let types = keys.get(name);
      if (!types) {
        types = new Set();
        keys.set(name, types);
      }
      types.add(describeValue(value, depth + 1));
    }
  }
  return `{${[...keys].map(([name, types]) => `${name}: ${[...types].sort().join(' | ')}`).join(', ')}}`;
}

/**
 * Describe the structure of a JSON value without its data: types instead of
 * values, id-like keys collapsed to `{id}`, list items merged. For example
 * `list[{id: int, title: str}]`.
 *
 * @internal Exported for tests.
 * @param value - The JSON value to describe.
 * @param depth - Nesting depth after which objects/lists are elided (default 3).
 * @returns The shape string, at most 500 characters.
 */
export function describeShape(value: JSONValue | undefined, depth = SHAPE_MAX_DEPTH): string {
  const shape = describeValue(value, SHAPE_MAX_DEPTH - depth);
  return shape.length <= SHAPE_MAX_LENGTH ? shape : `${shape.slice(0, SHAPE_MAX_LENGTH - 1)}…`;
}

/** Keys each model instance was asked to copy by {@link assign}. */
const assignedKeys = new WeakMap<object, Set<string>>();

/**
 * Detect API keys the finished model did not map and report them — to the
 * client's `onUnknownField` hook when set, otherwise to `console.warn` when
 * `reportUnknownFields` is enabled.
 *
 * Called at the end of a `deJson` once every field (scalar and nested) is
 * assigned. A raw key is known when {@link assign} was asked to copy it, when
 * the model holds an own property of that name with a defined value, when the
 * model has an own (possibly undefined) property for a `null` raw value, or
 * when it is listed in `alsoKnown`. `client` is never known. A declared field
 * the model never maps is therefore reported. Detection is off unless one of
 * the two options is set, so it is safe to leave wired into every model.
 *
 * @param client - The owning client (carries `reportUnknownFields`/`onUnknownField`).
 * @param label - Model name, used in the report.
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
  if (!client || (!client.reportUnknownFields && !client.onUnknownField)) {
    return;
  }
  const assigned = assignedKeys.get(model);
  const extra = alsoKnown ? new Set(alsoKnown) : undefined;
  const fields = model as Record<string, unknown>;
  const unknown = Object.keys(raw).filter((key) => {
    if (key === 'client') {
      return true;
    }
    if (assigned?.has(key) || extra?.has(key)) {
      return false;
    }
    if (!Object.hasOwn(fields, key)) {
      return true;
    }
    return fields[key] === undefined && raw[key] !== null;
  });
  if (unknown.length === 0) {
    return;
  }
  if (client.onUnknownField) {
    const shapes: Record<string, string> = {};
    for (const key of unknown) {
      shapes[key] = describeShape(raw[key]);
    }
    try {
      client.onUnknownField({ model: label, fields: unknown, raw, shapes });
    } catch {
      // hook errors must not abort model deserialization.
    }
    return;
  }
  // eslint-disable-next-line no-console
  console.warn(`[yandex-music] ${label}: API returned unmapped field(s): ${unknown.join(', ')}`);
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
  let recorded = assignedKeys.get(target);
  if (!recorded) {
    recorded = new Set();
    assignedKeys.set(target, recorded);
  }
  for (const key of keys) {
    recorded.add(key);
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
  /**
   * The client that created this model, used by convenience methods.
   *
   * Non-enumerable: it never shows up in `JSON.stringify`, `Object.keys`, spread
   * copies or `console.log` output, so serializing or logging a model neither
   * walks into the transport (and its `Authorization` header) nor hits the
   * client → request → client cycle.
   */
  declare client?: Client;

  /**
   * @param client - The owning client, stored for later convenience calls.
   */
  constructor(client?: Client) {
    Object.defineProperty(this, 'client', { value: client, writable: true, configurable: true, enumerable: false });
  }

  /**
   * Plain-data view of the model for `JSON.stringify`: own enumerable fields
   * only (the {@link YandexMusicModel.client} back-reference is excluded).
   *
   * @returns A shallow copy of the model's data fields.
   */
  toJSON(): Record<string, unknown> {
    return { ...(this as object) } as Record<string, unknown>;
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
