/**
 * Rotor seed model and the seed helpers shared by the session models.
 *
 * @remarks
 * Lives in its own module so that `rotor.ts` and `session.ts` can both use it
 * without an import cycle.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject, reportUnknown } from '../../base.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A rotor seed: the `type:tag` pair a session was started or extended with. */
export class RotorSeed extends YandexMusicModel {
  /** Seed type, for example `user`, `track` or `genre`. */
  type?: string;
  /** Seed tag within the type. */
  tag?: string;
  /** Raw seed value, when the server sends one. */
  value?: string;

  /** @see {@link RotorSeed} */
  static deJson(raw: JSONValue | undefined, client?: Client): RotorSeed | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new RotorSeed(client);
    assign(model, raw, ['type', 'tag', 'value']);
    reportUnknown(client, 'RotorSeed', raw, model);
    return model;
  }

  /**
   * Parse a `type:tag` seed string (the tag may itself contain colons).
   *
   * @param seed - The seed string, for example `user:onyourwave`.
   * @param client - The owning client.
   */
  static fromString(seed: string, client?: Client): RotorSeed {
    const model = new RotorSeed(client);
    const colon = seed.indexOf(':');
    if (colon < 0) {
      model.type = seed;
      return model;
    }
    model.type = seed.slice(0, colon);
    model.tag = seed.slice(colon + 1);
    return model;
  }

  /** The `type:tag` string form of this seed (falls back to `value`). */
  toSeedString(): string | undefined {
    if (this.type !== undefined && this.tag !== undefined) {
      return `${this.type}:${this.tag}`;
    }
    return this.value ?? this.type;
  }
}

/**
 * Read one raw seed that is either a `type:tag` string or a `{type, tag, value}`
 * object, and return both representations.
 *
 * @internal
 */
export function readSeed(
  raw: JSONValue | undefined,
  client?: Client,
): { text: string | undefined; seed: RotorSeed } | null {
  if (typeof raw === 'string') {
    return { text: raw, seed: RotorSeed.fromString(raw, client) };
  }
  const seed = RotorSeed.deJson(raw, client);
  return seed ? { text: seed.toSeedString(), seed } : null;
}

/**
 * Read a raw seed list (strings or objects) into typed seeds and their string forms.
 *
 * @internal
 */
export function readSeedList(
  raw: JSONValue | undefined,
  client?: Client,
): { strings: string[]; seeds: RotorSeed[] } | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const strings: string[] = [];
  const seeds: RotorSeed[] = [];
  for (const item of raw) {
    const read = readSeed(item, client);
    if (!read) {
      continue;
    }
    seeds.push(read.seed);
    if (read.text !== undefined) {
      strings.push(read.text);
    }
  }
  return { strings, seeds };
}
