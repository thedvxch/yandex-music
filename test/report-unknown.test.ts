import { describe, expect, it } from 'vitest';
import { Cover, YandexMusicModel, assign, describeShape, reportUnknown } from '../src/index.js';
import type { Client, JSONObject, UnknownFieldsReport } from '../src/index.js';

class Probe extends YandexMusicModel {
  a?: string;
  b?: string;
  nested?: Cover;
}

function collect(): { client: Client; reports: UnknownFieldsReport[] } {
  const reports: UnknownFieldsReport[] = [];
  const client = { onUnknownField: (r: UnknownFieldsReport) => void reports.push(r) } as unknown as Client;
  return { client, reports };
}

describe('reportUnknown', () => {
  it('flags a raw key that matches a declared but unassigned field', () => {
    const { client, reports } = collect();
    const raw: JSONObject = { a: 'x', b: 'y' };
    const model = new Probe(client);
    assign(model, raw, ['a']);
    reportUnknown(client, 'Probe', raw, model);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.fields).toEqual(['b']);
  });

  it('does not flag assigned, alsoKnown, or null-nested keys', () => {
    const { client, reports } = collect();
    const raw: JSONObject = { a: 'x', b: 'y', nested: null, snake_key: 1 };
    const model = new Probe(client);
    assign(model, raw, ['a', 'b']);
    model.nested = undefined;
    reportUnknown(client, 'Probe', raw, model, ['snake_key']);
    expect(reports).toHaveLength(0);
  });

  it('treats a key asked to be copied as known even when the raw value is null', () => {
    const { client, reports } = collect();
    const raw: JSONObject = { a: null };
    const model = new Probe(client);
    assign(model, raw, ['a']);
    reportUnknown(client, 'Probe', raw, model);
    expect(reports).toHaveLength(0);
  });

  it('always flags `client`', () => {
    const { client, reports } = collect();
    const raw: JSONObject = { a: 'x', client: 'evil' };
    const model = new Probe(client);
    assign(model, raw, ['a']);
    reportUnknown(client, 'Probe', raw, model);
    expect(reports[0]!.fields).toEqual(['client']);
  });

  it('reports value shapes for unknown fields', () => {
    const { client, reports } = collect();
    const raw: JSONObject = { x: [{ id: 1, t: 's' }] };
    reportUnknown(client, 'Probe', raw, new Probe(client));
    expect(reports[0]!.shapes).toEqual({ x: 'list[{id: int, t: str}]' });
  });

  it('is silent without opt-in', () => {
    const model = new Probe();
    expect(() => reportUnknown(undefined, 'Probe', { zzz: 1 }, model)).not.toThrow();
  });
});

describe('describeShape', () => {
  it('describes scalars, lists and objects without values', () => {
    expect(describeShape(1)).toBe('int');
    expect(describeShape(1.5)).toBe('float');
    expect(describeShape(true)).toBe('bool');
    expect(describeShape(null)).toBe('null');
    expect(describeShape('secret')).toBe('str');
    expect(describeShape([])).toBe('list[]');
    expect(describeShape({ a: 1, b: [1, 'x'] })).toBe('{a: int, b: list[int | str]}');
  });

  it('collapses id-like keys and merges list items', () => {
    expect(describeShape({ '12345': { a: 1 }, '67890': { a: 2 } })).toBe('{{id}: {a: int}}');
    expect(describeShape([{ a: 1 }, { b: 's' }])).toBe('list[{a: int, b: str}]');
  });

  it('caps depth and length', () => {
    expect(describeShape({ a: { b: { c: { d: 1 } } } })).toBe('{a: {b: {c: {...}}}}');
    const long = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`key${i}x`, 1]));
    expect(describeShape(long).length).toBeLessThanOrEqual(500);
  });
});
