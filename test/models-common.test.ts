import { describe, expect, it } from 'vitest';
import {
  Cover,
  Images,
  InvocationInfo,
  SimilarEntityData,
  SimilarEntityItem,
  SkeletonBlock,
  SkeletonBlockData,
  SkeletonSource,
  SkeletonTab,
  SkeletonViewAllAction,
  Tag,
  Wave,
  WaveAgent,
  WaveAgentEntity,
} from '../src/index.js';
import type { Client, UnknownFieldsReport } from '../src/index.js';

describe('shared primitive models', () => {
  it('Images keeps size-named keys', () => {
    const m = Images.deJson({ '208x208': 'a', '300x300': 'b' });
    expect(m).toBeInstanceOf(Images);
    expect(m?.['208x208']).toBe('a');
    expect(m?.['300x300']).toBe('b');
    expect(Images.deJson(null)).toBeNull();
  });

  it('Tag', () => {
    const m = Tag.deJson({ id: 't1', value: 'v', name: 'N', ogDescription: 'd', ogImage: 'img' });
    expect(m).toBeInstanceOf(Tag);
    expect(m).toMatchObject({ id: 't1', value: 'v', name: 'N', ogDescription: 'd', ogImage: 'img' });
  });

  it('InvocationInfo', () => {
    const m = InvocationInfo.deJson({ hostname: 'h', reqId: 'r', execDurationMillis: 7, appName: 'app' });
    expect(m).toMatchObject({ hostname: 'h', reqId: 'r', execDurationMillis: 7, appName: 'app' });
  });

  it('Wave', () => {
    const m = Wave.deJson({
      name: 'n',
      description: 'd',
      seeds: ['album:1'],
      stationId: 'user:onyourwave',
      idForFrom: 'wave',
      type: 'DEFAULT',
    });
    expect(m).toBeInstanceOf(Wave);
    expect(m?.seeds).toEqual(['album:1']);
    expect(m?.stationId).toBe('user:onyourwave');
  });

  it('WaveAgentEntity, WaveAgent, SimilarEntityData and SimilarEntityItem nest', () => {
    expect(WaveAgentEntity.deJson({ type: 'artist' })?.type).toBe('artist');
    const agent = WaveAgent.deJson({ animationUri: 'u', cover: { uri: 'c' }, entity: { type: 'artist' } });
    expect(agent?.cover).toBeInstanceOf(Cover);
    expect(agent?.entity).toBeInstanceOf(WaveAgentEntity);
    const item = SimilarEntityItem.deJson({
      type: 'wave',
      data: { wave: { name: 'w' }, agent: { animationUri: 'u' } },
    });
    expect(item?.data).toBeInstanceOf(SimilarEntityData);
    expect(item?.data?.wave).toBeInstanceOf(Wave);
    expect(item?.data?.agent).toBeInstanceOf(WaveAgent);
    expect(item?.data?.wave?.name).toBe('w');
  });

  it('skeleton models nest recursively', () => {
    expect(SkeletonSource.deJson({ uri: 'u', countWeb: 5, count: 3 })).toMatchObject({ uri: 'u', countWeb: 5, count: 3 });
    expect(SkeletonViewAllAction.deJson({ deeplink: 'd', weblink: 'w' })).toMatchObject({ deeplink: 'd', weblink: 'w' });
    const block = SkeletonBlock.deJson({
      id: 'b1',
      type: 'tabs',
      data: {
        selectedTabIndex: 1,
        title: 'T',
        showPolicy: 'always',
        source: { uri: 'u' },
        viewAllAction: { weblink: 'w' },
        tabs: [{ id: 't', title: 'Tab', blocks: [{ id: 'inner', type: 'x' }] }],
      },
    });
    expect(block).toBeInstanceOf(SkeletonBlock);
    expect(block?.data).toBeInstanceOf(SkeletonBlockData);
    expect(block?.data?.selectedTabIndex).toBe(1);
    expect(block?.data?.source).toBeInstanceOf(SkeletonSource);
    expect(block?.data?.viewAllAction?.weblink).toBe('w');
    const tab = block?.data?.tabs?.[0];
    expect(tab).toBeInstanceOf(SkeletonTab);
    expect(tab?.blocks?.[0]).toBeInstanceOf(SkeletonBlock);
    expect(tab?.blocks?.[0]?.id).toBe('inner');
  });

  it('reports unmapped fields on the new models', () => {
    const reports: UnknownFieldsReport[] = [];
    const client = { onUnknownField: (r: UnknownFieldsReport) => void reports.push(r) } as unknown as Client;
    Tag.deJson({ id: 't', surprise: 1 }, client);
    Wave.deJson({ name: 'n', extra: [1] }, client);
    SkeletonBlock.deJson({ id: 'b', novel: { a: 1 } }, client);
    expect(reports.map((r) => [r.model, r.fields])).toEqual([
      ['Tag', ['surprise']],
      ['Wave', ['extra']],
      ['SkeletonBlock', ['novel']],
    ]);
  });
});
