/**
 * Concert models: {@link Concert} and the container/listing models returned by
 * the concert endpoints.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Cover } from '../common.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** The minimum ticket price for a concert. */
export class ConcertMinPrice extends YandexMusicModel {
  /** Price value. */
  value?: number;
  /** Currency code. */
  currency?: string;
  /** Currency symbol. */
  currencySymbol?: string;

  /** @see {@link ConcertMinPrice} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertMinPrice | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertMinPrice(client);
    assign(model, raw, ['value', 'currency', 'currencySymbol']);
    reportUnknown(client, 'ConcertMinPrice', raw, model);
    return model;
  }
}

/** Cashback offered for a concert. */
export class ConcertCashback extends YandexMusicModel {
  /** Cashback title. */
  title?: string;
  /** Cashback percentage. */
  valuePercent?: number;

  /** @see {@link ConcertCashback} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertCashback | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertCashback(client);
    assign(model, raw, ['title', 'valuePercent']);
    reportUnknown(client, 'ConcertCashback', raw, model);
    return model;
  }
}

/** Event-type information for a concert. */
export class ConcertEventInfo extends YandexMusicModel {
  /** Event type (known values: `concert`, `festival`). */
  type?: string;

  /** @see {@link ConcertEventInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertEventInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertEventInfo(client);
    assign(model, raw, ['type']);
    reportUnknown(client, 'ConcertEventInfo', raw, model);
    return model;
  }
}

/** A free-text concert description with a source. */
export class ConcertDescription extends YandexMusicModel {
  /** Description text. */
  text?: string;
  /** Source of the description. */
  source?: string;

  /** @see {@link ConcertDescription} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertDescription | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertDescription(client);
    assign(model, raw, ['text', 'source']);
    reportUnknown(client, 'ConcertDescription', raw, model);
    return model;
  }
}

/** A concert event. */
export class Concert extends YandexMusicModel {
  /** Concert id. */
  id?: string;
  /** Image URI templates. */
  images?: string[];
  /** Single image URI. */
  imageUrl?: string;
  /** Concert title. */
  concertTitle?: string;
  /** Afisha (poster service) URL. */
  afishaUrl?: string;
  /** City. */
  city?: string;
  /** Venue. */
  place?: string;
  /** Address. */
  address?: string;
  /** Date and time. */
  datetime?: string;
  /** Content rating. */
  contentRating?: string;
  /** Minimum ticket price. */
  minPrice?: ConcertMinPrice;
  /** Cashback offer. */
  cashback?: ConcertCashback;
  /** Event-type info. */
  eventInfo?: ConcertEventInfo;
  /** Cover art. */
  cover?: Cover;
  /** Data session id (alternative response shape). */
  dataSessionId?: string;

  /** @see {@link Concert} */
  static deJson(raw: JSONValue | undefined, client?: Client): Concert | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Concert(client);
    assign(model, raw, [
      'id',
      'images',
      'imageUrl',
      'concertTitle',
      'afishaUrl',
      'city',
      'place',
      'address',
      'datetime',
      'contentRating',
      'dataSessionId',
    ]);
    model.minPrice = ConcertMinPrice.deJson(raw['minPrice'], client) ?? undefined;
    model.cashback = ConcertCashback.deJson(raw['cashback'], client) ?? undefined;
    model.eventInfo = ConcertEventInfo.deJson(raw['eventInfo'], client) ?? undefined;
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    reportUnknown(client, 'Concert', raw, model);
    return model;
  }
}

/** An artist's upcoming concerts. */
export class ArtistConcerts extends YandexMusicModel {
  /** Artist title. */
  artistTitle?: string;
  /** The concerts. */
  concerts?: Concert[];

  /** @see {@link ArtistConcerts} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistConcerts | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistConcerts(client);
    assign(model, raw, ['artistTitle']);
    model.concerts = deList(Concert.deJson, raw['concerts'], client);
    reportUnknown(client, 'ArtistConcerts', raw, model);
    return model;
  }
}

/** Detailed information about a single concert. */
export class ConcertInfo extends YandexMusicModel {
  /** The concert. */
  concert?: Concert;
  /** Minimum ticket price. */
  minPrice?: ConcertMinPrice;
  /** Cover art. */
  covers?: Cover[];
  /** Concert description. */
  description?: ConcertDescription;
  /** Id of the lead artist. */
  leadArtistId?: number;

  /** @see {@link ConcertInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertInfo(client);
    assign(model, raw, ['leadArtistId']);
    model.concert = Concert.deJson(raw['concert'], client) ?? undefined;
    model.minPrice = ConcertMinPrice.deJson(raw['minPrice'], client) ?? undefined;
    model.covers = deList(Cover.deJson, raw['covers'], client);
    model.description = ConcertDescription.deJson(raw['description'], client) ?? undefined;
    reportUnknown(client, 'ConcertInfo', raw, model);
    return model;
  }
}

/** The payload of a {@link ConcertFeedItem}. */
export class ConcertFeedItemData extends YandexMusicModel {
  /** The concert. */
  concert?: Concert;
  /** Minimum ticket price. */
  minPrice?: ConcertMinPrice;

  /** @see {@link ConcertFeedItemData} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertFeedItemData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertFeedItemData(client);
    model.concert = Concert.deJson(raw['concert'], client) ?? undefined;
    model.minPrice = ConcertMinPrice.deJson(raw['minPrice'], client) ?? undefined;
    reportUnknown(client, 'ConcertFeedItemData', raw, model);
    return model;
  }
}

/** An item in a concert feed. */
export class ConcertFeedItem extends YandexMusicModel {
  /** Item type (known value: `concert_item`). */
  type?: string;
  /** Item payload. */
  data?: ConcertFeedItemData;

  /** @see {@link ConcertFeedItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertFeedItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertFeedItem(client);
    assign(model, raw, ['type']);
    model.data = ConcertFeedItemData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'ConcertFeedItem', raw, model);
    return model;
  }
}

/** A feed of concerts. */
export class ConcertFeed extends YandexMusicModel {
  /** The feed items. */
  items?: ConcertFeedItem[];

  /** @see {@link ConcertFeed} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertFeed | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertFeed(client);
    model.items = deList(ConcertFeedItem.deJson, raw['items'], client);
    reportUnknown(client, 'ConcertFeed', raw, model);
    return model;
  }
}

/** A concert location (city). */
export class ConcertLocation extends YandexMusicModel {
  /** Location id. */
  id?: number;
  /** Location name. */
  name?: string;

  /** @see {@link ConcertLocation} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertLocation | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertLocation(client);
    assign(model, raw, ['id', 'name']);
    reportUnknown(client, 'ConcertLocation', raw, model);
    return model;
  }
}

/** The available concert locations. */
export class ConcertLocations extends YandexMusicModel {
  /** The locations. */
  locations?: ConcertLocation[];

  /** @see {@link ConcertLocations} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertLocations | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertLocations(client);
    model.locations = deList(ConcertLocation.deJson, raw['locations'], client);
    reportUnknown(client, 'ConcertLocations', raw, model);
    return model;
  }
}

/** A pagination range (offset/limit) inside a concert tab config. */
export class ConcertTabRange extends YandexMusicModel {
  /** Offset from the start. */
  offset?: number;
  /** Maximum number of items. */
  limit?: number;

  /** @see {@link ConcertTabRange} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertTabRange | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertTabRange(client);
    assign(model, raw, ['offset', 'limit']);
    reportUnknown(client, 'ConcertTabRange', raw, model);
    return model;
  }
}

/** The ranges configuring the top and feed sections of the concert tab. */
export class ConcertTabConfigData extends YandexMusicModel {
  /** "Top" section range. */
  top?: ConcertTabRange;
  /** "Feed" section range. */
  feed?: ConcertTabRange;

  /** @see {@link ConcertTabConfigData} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertTabConfigData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertTabConfigData(client);
    model.top = ConcertTabRange.deJson(raw['top'], client) ?? undefined;
    model.feed = ConcertTabRange.deJson(raw['feed'], client) ?? undefined;
    reportUnknown(client, 'ConcertTabConfigData', raw, model);
    return model;
  }
}

/** The concert tab configuration. */
export class ConcertTabConfig extends YandexMusicModel {
  /** The configuration data. */
  config?: ConcertTabConfigData;

  /** @see {@link ConcertTabConfig} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertTabConfig | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertTabConfig(client);
    model.config = ConcertTabConfigData.deJson(raw['config'], client) ?? undefined;
    reportUnknown(client, 'ConcertTabConfig', raw, model);
    return model;
  }
}

/** The skeleton (lazy-render scaffold) of a concert page. */
export class ConcertSkeleton extends YandexMusicModel {
  /** Skeleton id. */
  id?: string;
  /** Skeleton title. */
  title?: string;
  /** Skeleton blocks (raw JSON, pending a typed `SkeletonBlock` model). */
  blocks?: JSONValue[];

  /** @see {@link ConcertSkeleton} */
  static deJson(raw: JSONValue | undefined, client?: Client): ConcertSkeleton | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ConcertSkeleton(client);
    assign(model, raw, ['id', 'title']);
    model.blocks = Array.isArray(raw['blocks']) ? (raw['blocks'] as JSONValue[]) : undefined;
    reportUnknown(client, 'ConcertSkeleton', raw, model);
    return model;
  }
}
