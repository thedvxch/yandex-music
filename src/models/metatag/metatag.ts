/**
 * Metatag models. A metatag groups artists, albums and playlists by mood,
 * genre, epoch or activity.
 *
 * @remarks
 * The metatag listing endpoints also return `tracks`, `composers`, `promotions`,
 * `features` and `concerts`; these were empty in every observed response and are
 * therefore not modeled here.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Album } from '../album/album.js';
import { Artist } from '../artist/artist.js';
import { Track } from '../track/track.js';
import { Playlist } from '../playlist/playlist.js';
import { Pager } from '../pager.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A metatag title (short and full forms). */
export class MetatagTitle extends YandexMusicModel {
  /** Short title. */
  title?: string;
  /** Full title. */
  fullTitle?: string;

  /** @see {@link MetatagTitle} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagTitle | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagTitle(client);
    assign(model, raw, ['title', 'fullTitle']);
    reportUnknown(client, 'MetatagTitle', raw, model);
    return model;
  }
}

/** A selectable sort option for a metatag listing. */
export class MetatagSortByValue extends YandexMusicModel {
  /** Sort value (known values: `popular`, `new`). */
  value?: string;
  /** Human-readable label. */
  title?: string;
  /** Whether this sort is currently active. */
  active?: boolean;

  /** @see {@link MetatagSortByValue} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagSortByValue | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagSortByValue(client);
    assign(model, raw, ['value', 'title', 'active']);
    reportUnknown(client, 'MetatagSortByValue', raw, model);
    return model;
  }
}

/** A leaf in a metatag navigation tree (may nest further leaves). */
export class MetatagLeaf extends YandexMusicModel {
  /** Tag id used as the metatag identifier in requests. */
  tag?: string;
  /** Leaf title. */
  title?: string;
  /** Nested leaves. */
  leaves?: MetatagLeaf[];

  /** @see {@link MetatagLeaf} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagLeaf | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagLeaf(client);
    assign(model, raw, ['tag', 'title']);
    model.leaves = deList(MetatagLeaf.deJson, raw['leaves'], client);
    reportUnknown(client, 'MetatagLeaf', raw, model);
    return model;
  }
}

/** A metatag navigation tree (for example "moods", "genres"). */
export class MetatagTree extends YandexMusicModel {
  /** Tree title. */
  title?: string;
  /** Navigation id (known values: `moods`, `activities`, `genres`, `epochs`). */
  navigationId?: string;
  /** Top-level leaves. */
  leaves?: MetatagLeaf[];

  /** @see {@link MetatagTree} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagTree | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagTree(client);
    assign(model, raw, ['title', 'navigationId']);
    model.leaves = deList(MetatagLeaf.deJson, raw['leaves'], client);
    reportUnknown(client, 'MetatagTree', raw, model);
    return model;
  }
}

/** The metatag navigation, as a list of trees. */
export class Metatags extends YandexMusicModel {
  /** The navigation trees. */
  trees?: MetatagTree[];

  /** @see {@link Metatags} */
  static deJson(raw: JSONValue | undefined, client?: Client): Metatags | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Metatags(client);
    model.trees = deList(MetatagTree.deJson, raw['trees'], client);
    reportUnknown(client, 'Metatags', raw, model);
    return model;
  }
}

/** An artist together with a few of their popular tracks, inside a metatag. */
export class MetatagArtistEntry extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** A selection of popular tracks. */
  popularTracks?: Track[];

  /** @see {@link MetatagArtistEntry} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagArtistEntry | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagArtistEntry(client);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.popularTracks = deList(Track.deJson, raw['popularTracks'], client);
    reportUnknown(client, 'MetatagArtistEntry', raw, model);
    return model;
  }
}

/** Aggregate metatag information (artists, albums and playlists). */
export class Metatag extends YandexMusicModel {
  /** Metatag id. */
  id?: string;
  /** Cover URI template. */
  coverUri?: string;
  /** Accent color. */
  color?: string;
  /** Title. */
  title?: MetatagTitle;
  /** Whether the metatag is liked. */
  liked?: boolean;
  /** Radio station id for the metatag. */
  stationId?: string;
  /** Custom wave animation URL. */
  customWaveAnimationUrl?: string;
  /** Featured artists. */
  artists?: Artist[];
  /** Featured albums. */
  albums?: Album[];
  /** Featured playlists. */
  playlists?: Playlist[];
  /** Available track sort options. */
  tracksSortByValues?: MetatagSortByValue[];
  /** Available album sort options. */
  albumsSortByValues?: MetatagSortByValue[];
  /** Available playlist sort options. */
  playlistsSortByValues?: MetatagSortByValue[];
  /** Featured composers. */
  composers?: Artist[];
  /** Featured tracks. */
  tracks?: Track[];
  /** Featured entities (free-form raw JSON, pending a typed model). */
  features?: JSONValue;
  /** Promotions (free-form raw JSON, pending a typed model). */
  promotions?: JSONValue;

  /** @see {@link Metatag} */
  static deJson(raw: JSONValue | undefined, client?: Client): Metatag | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Metatag(client);
    assign(model, raw, [
      'id',
      'coverUri',
      'color',
      'liked',
      'stationId',
      'customWaveAnimationUrl',
      'features',
      'promotions',
    ]);
    model.title = MetatagTitle.deJson(raw['title'], client) ?? undefined;
    model.artists = deList(Artist.deJson, raw['artists'], client);
    model.albums = deList(Album.deJson, raw['albums'], client);
    model.playlists = deList(Playlist.deJson, raw['playlists'], client);
    model.composers = deList(Artist.deJson, raw['composers'], client);
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    model.tracksSortByValues = deList(MetatagSortByValue.deJson, raw['tracksSortByValues'], client);
    model.albumsSortByValues = deList(MetatagSortByValue.deJson, raw['albumsSortByValues'], client);
    model.playlistsSortByValues = deList(MetatagSortByValue.deJson, raw['playlistsSortByValues'], client);
    reportUnknown(client, 'Metatag', raw, model);
    return model;
  }
}

/** A page of a metatag's albums. */
export class MetatagAlbums extends YandexMusicModel {
  /** Metatag id. */
  id?: string;
  /** Cover URI template. */
  coverUri?: string;
  /** Accent color. */
  color?: string;
  /** Title. */
  title?: MetatagTitle;
  /** Radio station id. */
  stationId?: string;
  /** Pagination metadata. */
  pager?: Pager;
  /** The albums on this page. */
  albums?: Album[];
  /** Available sort options. */
  sortByValues?: MetatagSortByValue[];

  /** @see {@link MetatagAlbums} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagAlbums | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagAlbums(client);
    assign(model, raw, ['id', 'coverUri', 'color', 'stationId']);
    model.title = MetatagTitle.deJson(raw['title'], client) ?? undefined;
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    model.albums = deList(Album.deJson, raw['albums'], client);
    model.sortByValues = deList(MetatagSortByValue.deJson, raw['sortByValues'], client);
    reportUnknown(client, 'MetatagAlbums', raw, model);
    return model;
  }
}

/** A page of a metatag's artists. */
export class MetatagArtists extends YandexMusicModel {
  /** Metatag id. */
  id?: string;
  /** Cover URI template. */
  coverUri?: string;
  /** Accent color. */
  color?: string;
  /** Title. */
  title?: MetatagTitle;
  /** Radio station id. */
  stationId?: string;
  /** Pagination metadata. */
  pager?: Pager;
  /** The artist entries on this page. */
  artists?: MetatagArtistEntry[];
  /** Available sort options. */
  sortByValues?: MetatagSortByValue[];

  /** @see {@link MetatagArtists} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagArtists | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagArtists(client);
    assign(model, raw, ['id', 'coverUri', 'color', 'stationId']);
    model.title = MetatagTitle.deJson(raw['title'], client) ?? undefined;
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    model.artists = deList(MetatagArtistEntry.deJson, raw['artists'], client);
    model.sortByValues = deList(MetatagSortByValue.deJson, raw['sortByValues'], client);
    reportUnknown(client, 'MetatagArtists', raw, model);
    return model;
  }
}

/** A page of a metatag's playlists. */
export class MetatagPlaylists extends YandexMusicModel {
  /** Metatag id. */
  id?: string;
  /** Cover URI template. */
  coverUri?: string;
  /** Accent color. */
  color?: string;
  /** Title. */
  title?: MetatagTitle;
  /** Radio station id. */
  stationId?: string;
  /** Pagination metadata. */
  pager?: Pager;
  /** The playlists on this page. */
  playlists?: Playlist[];
  /** Available sort options. */
  sortByValues?: MetatagSortByValue[];

  /** @see {@link MetatagPlaylists} */
  static deJson(raw: JSONValue | undefined, client?: Client): MetatagPlaylists | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MetatagPlaylists(client);
    assign(model, raw, ['id', 'coverUri', 'color', 'stationId']);
    model.title = MetatagTitle.deJson(raw['title'], client) ?? undefined;
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    model.playlists = deList(Playlist.deJson, raw['playlists'], client);
    model.sortByValues = deList(MetatagSortByValue.deJson, raw['sortByValues'], client);
    reportUnknown(client, 'MetatagPlaylists', raw, model);
    return model;
  }
}
