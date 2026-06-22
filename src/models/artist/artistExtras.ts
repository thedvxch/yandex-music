/**
 * Artist-adjacent models returned by the dedicated artist endpoints:
 * {@link ArtistLink}, {@link ArtistLinks}, {@link ArtistAlbums},
 * {@link ArtistSimilar}, {@link ArtistTrailer} and {@link BriefInfo}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { Cover } from '../common.js';
import { Track } from '../track/track.js';
import { Album } from '../album/album.js';
import { Video } from '../video.js';
import { Playlist } from '../playlist/playlist.js';
import { PlaylistId } from '../playlist/playlistId.js';
import { Chart } from '../landing/landing.js';
import { TrailerInfo } from '../trailerInfo.js';
import { Pager } from '../pager.js';
import { Artist } from './artist.js';
import { Stats } from './stats.js';
import { Vinyl } from './vinyl.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A single external link on an artist's page (site, social network, store). */
export class ArtistLink extends YandexMusicModel {
  /** Link title. */
  title?: string;
  /** Link subtitle. */
  subtitle?: string;
  /** Target URL. */
  url?: string;
  /** Icon image URL. */
  imgUrl?: string;

  /** @see {@link ArtistLink} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistLink | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistLink(client);
    assign(model, raw, ['title', 'subtitle', 'url', 'imgUrl']);
    return model;
  }
}

/** The collection of external links shown on an artist's page. */
export class ArtistLinks extends YandexMusicModel {
  /** The artist's external links. */
  links?: ArtistLink[];

  /** @see {@link ArtistLinks} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistLinks | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistLinks(client);
    model.links = deList(ArtistLink.deJson, raw['links'], client);
    return model;
  }
}

/** A page of an artist's albums (direct, also, discography or safe-direct). */
export class ArtistAlbums extends YandexMusicModel {
  /** The albums on this page. */
  albums?: Album[];
  /** Pagination metadata. */
  pager?: Pager;

  /** @see {@link ArtistAlbums} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistAlbums | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistAlbums(client);
    model.albums = deList(Album.deJson, raw['albums'], client);
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    return model;
  }
}

/** Artists similar to a given artist. */
export class ArtistSimilar extends YandexMusicModel {
  /** The reference artist. */
  artist?: Artist;
  /** Artists similar to the reference. */
  similarArtists?: Artist[];

  /** @see {@link ArtistSimilar} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistSimilar | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistSimilar(client);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.similarArtists = raw['similarArtists']
      ? deList(Artist.deJson, raw['similarArtists'], client)
      : undefined;
    return model;
  }
}

/** An artist together with their trailer. */
export class ArtistTrailer extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** The trailer. */
  trailer?: TrailerInfo;

  /** @see {@link ArtistTrailer} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistTrailer | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistTrailer(client);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.trailer = TrailerInfo.deJson(raw['trailer'], client) ?? undefined;
    return model;
  }
}

/** A rich aggregate of everything shown on an artist's main page. */
export class BriefInfo extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** The artist's albums. */
  albums?: Album[];
  /** Playlists featuring the artist. */
  playlists?: Playlist[];
  /** Albums the artist also appears on. */
  alsoAlbums?: Album[];
  /** Ids of the most recent releases. */
  lastReleaseIds?: number[];
  /** The most recent releases. */
  lastReleases?: Album[];
  /** A selection of popular tracks. */
  popularTracks?: Track[];
  /** Similar artists. */
  similarArtists?: Artist[];
  /** All available covers. */
  allCovers?: Cover[];
  /** Upcoming concerts (raw JSON, pending a typed `Concert` model). */
  concerts?: JSONValue;
  /** Music videos. */
  videos?: Video[];
  /** Vinyl records on offer. */
  vinyls?: Vinyl[];
  /** Whether the artist has active promotions. */
  hasPromotions?: boolean;
  /** References to playlists by the artist. */
  playlistIds?: PlaylistId[];
  /** Listening statistics. */
  stats?: Stats;
  /** The artist's tracks that currently chart. */
  tracksInChart?: Chart[];

  /** @see {@link BriefInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): BriefInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new BriefInfo(client);
    assign(model, raw, ['lastReleaseIds', 'concerts', 'hasPromotions']);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.albums = deList(Album.deJson, raw['albums'], client);
    model.playlists = deList(Playlist.deJson, raw['playlists'], client);
    model.alsoAlbums = deList(Album.deJson, raw['alsoAlbums'], client);
    model.lastReleases = deList(Album.deJson, raw['lastReleases'], client);
    model.popularTracks = deList(Track.deJson, raw['popularTracks'], client);
    model.similarArtists = deList(Artist.deJson, raw['similarArtists'], client);
    model.allCovers = deList(Cover.deJson, raw['allCovers'], client);
    model.videos = deList(Video.deJson, raw['videos'], client);
    model.vinyls = deList(Vinyl.deJson, raw['vinyls'], client);
    model.playlistIds = deList(PlaylistId.deJson, raw['playlistIds'], client);
    model.tracksInChart = deList(Chart.deJson, raw['tracksInChart'], client);
    model.stats = Stats.deJson(raw['stats'], client) ?? undefined;
    return model;
  }
}
