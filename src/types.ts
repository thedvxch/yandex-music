/**
 * Shared structural types used across the library.
 *
 * @packageDocumentation
 */

/** Any value that can appear in a parsed JSON document. */
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

/** A JSON object (string-keyed map of {@link JSONValue}). */
export type JSONObject = { [key: string]: JSONValue };

/**
 * Signature of a model deserializer: turns a raw JSON value into a typed model
 * instance, or `null` when the input is not a valid object for that model.
 *
 * @typeParam T - The model type produced.
 */
export type DeJson<T> = (raw: JSONValue, client?: import('./client.js').Client) => T | null;
