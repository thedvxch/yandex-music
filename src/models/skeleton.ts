/**
 * Page skeleton models (tabs of blocks that are loaded lazily).
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../base.js';
import type { Client } from '../client.js';
import type { JSONValue } from '../types.js';

/** Where a skeleton block loads its items from. */
export class SkeletonSource extends YandexMusicModel {
  /** Source URI. */
  uri?: string;
  /** Item count for the web client. */
  countWeb?: number;
  /** Item count. */
  count?: number;

  /** @see {@link SkeletonSource} */
  static deJson(raw: JSONValue | undefined, client?: Client): SkeletonSource | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SkeletonSource(client);
    assign(model, raw, ['uri', 'countWeb', 'count']);
    reportUnknown(client, 'SkeletonSource', raw, model);
    return model;
  }
}

/** A "view all" action of a skeleton block. */
export class SkeletonViewAllAction extends YandexMusicModel {
  /** App deeplink. */
  deeplink?: string;
  /** Web link. */
  weblink?: string;

  /** @see {@link SkeletonViewAllAction} */
  static deJson(raw: JSONValue | undefined, client?: Client): SkeletonViewAllAction | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SkeletonViewAllAction(client);
    assign(model, raw, ['deeplink', 'weblink']);
    reportUnknown(client, 'SkeletonViewAllAction', raw, model);
    return model;
  }
}

/** A tab inside a skeleton block. */
export class SkeletonTab extends YandexMusicModel {
  /** Tab id. */
  id?: string;
  /** Tab title. */
  title?: string;
  /** Blocks of the tab. */
  blocks?: SkeletonBlock[];

  /** @see {@link SkeletonTab} */
  static deJson(raw: JSONValue | undefined, client?: Client): SkeletonTab | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SkeletonTab(client);
    assign(model, raw, ['id', 'title']);
    if (Array.isArray(raw['blocks'])) {
      model.blocks = deList(SkeletonBlock.deJson, raw['blocks'], client);
    }
    reportUnknown(client, 'SkeletonTab', raw, model);
    return model;
  }
}

/** Payload of a skeleton block. */
export class SkeletonBlockData extends YandexMusicModel {
  /** Tabs of the block. */
  tabs?: SkeletonTab[];
  /** Index of the selected tab. */
  selectedTabIndex?: number;
  /** Item source. */
  source?: SkeletonSource;
  /** Block title. */
  title?: string;
  /** Show policy. */
  showPolicy?: string;
  /** The "view all" action. */
  viewAllAction?: SkeletonViewAllAction;

  /** @see {@link SkeletonBlockData} */
  static deJson(raw: JSONValue | undefined, client?: Client): SkeletonBlockData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SkeletonBlockData(client);
    assign(model, raw, ['selectedTabIndex', 'title', 'showPolicy']);
    if (Array.isArray(raw['tabs'])) {
      model.tabs = deList(SkeletonTab.deJson, raw['tabs'], client);
    }
    model.source = SkeletonSource.deJson(raw['source'], client) ?? undefined;
    model.viewAllAction = SkeletonViewAllAction.deJson(raw['viewAllAction'], client) ?? undefined;
    reportUnknown(client, 'SkeletonBlockData', raw, model);
    return model;
  }
}

/** A block of a page skeleton. */
export class SkeletonBlock extends YandexMusicModel {
  /** Block id. */
  id?: string;
  /** Block type. */
  type?: string;
  /** Block payload. */
  data?: SkeletonBlockData;

  /** @see {@link SkeletonBlock} */
  static deJson(raw: JSONValue | undefined, client?: Client): SkeletonBlock | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new SkeletonBlock(client);
    assign(model, raw, ['id', 'type']);
    model.data = SkeletonBlockData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'SkeletonBlock', raw, model);
    return model;
  }
}
