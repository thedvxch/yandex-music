/**
 * Artist-adjacent models returned by the dedicated artist endpoints:
 * {@link ArtistLink}, {@link ArtistLinks}, {@link ArtistAlbums},
 * {@link ArtistSimilar}, {@link ArtistTrailer} and {@link BriefInfo}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Cover, ExtraAction, Link } from '../common.js';
import { Track } from '../track/track.js';
import { Album } from '../album/album.js';
import { Video } from '../video.js';
import { Clip } from '../clip.js';
import { Playlist } from '../playlist/playlist.js';
import { PlaylistId } from '../playlist/playlistId.js';
import { CustomWave } from '../playlist/promo.js';
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
    reportUnknown(client, 'ArtistLink', raw, model);
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
    reportUnknown(client, 'ArtistLinks', raw, model);
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
    reportUnknown(client, 'ArtistAlbums', raw, model);
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
    reportUnknown(client, 'ArtistSimilar', raw, model);
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
    reportUnknown(client, 'ArtistTrailer', raw, model);
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
  /** Bandlink scanner (smartlink) URL for the artist. */
  bandlinkScannerLink?: string;
  /** The artist's clips (short videos). */
  clips?: Clip[];
  /** Extra page actions (for example a donation button). */
  extraActions?: ExtraAction[];
  /** The artist's custom wave (radio) descriptor. */
  customWave?: CustomWave;
  /** Whether the artist has a trailer. */
  hasTrailer?: boolean;
  /** External links (official site, socials). */
  links?: Link[];

  /** @see {@link BriefInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): BriefInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new BriefInfo(client);
    assign(model, raw, ['lastReleaseIds', 'concerts', 'hasPromotions', 'bandlinkScannerLink', 'hasTrailer']);
    model.extraActions = deList(ExtraAction.deJson, raw['extraActions'], client);
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
    model.clips = deList(Clip.deJson, raw['clips'], client);
    model.stats = Stats.deJson(raw['stats'], client) ?? undefined;
    model.customWave = CustomWave.deJson(raw['customWave'], client) ?? undefined;
    model.links = raw['links'] ? deList(Link.deJson, raw['links'], client) : undefined;
    reportUnknown(client, 'BriefInfo', raw, model);
    return model;
  }
}

/** A fundraising goal attached to an artist donation. */
export class ArtistDonationGoal extends YandexMusicModel {
  /** Goal title. */
  title?: string;

  /** @see {@link ArtistDonationGoal} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistDonationGoal | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistDonationGoal(client);
    assign(model, raw, ['title']);
    reportUnknown(client, 'ArtistDonationGoal', raw, model);
    return model;
  }
}

/** The payload of an {@link ArtistDonationItem} (a tip link and its goal). */
export class ArtistDonationData extends YandexMusicModel {
  /** Tip/donation URL. */
  tipUrl?: string;
  /** The artist the donation supports. */
  artist?: Artist;
  /** The fundraising goal. */
  goal?: ArtistDonationGoal;

  /** @see {@link ArtistDonationData} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistDonationData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistDonationData(client);
    assign(model, raw, ['tipUrl']);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.goal = ArtistDonationGoal.deJson(raw['goal'], client) ?? undefined;
    reportUnknown(client, 'ArtistDonationData', raw, model);
    return model;
  }
}

/** A single donation block on an artist's page. */
export class ArtistDonationItem extends YandexMusicModel {
  /** Donation block type. */
  type?: string;
  /** Donation payload. */
  data?: ArtistDonationData;

  /** @see {@link ArtistDonationItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistDonationItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistDonationItem(client);
    assign(model, raw, ['type']);
    model.data = ArtistDonationData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'ArtistDonationItem', raw, model);
    return model;
  }
}

/** The artist-donation block (`/artists/{id}/blocks/artist-donation`). */
export class ArtistDonations extends YandexMusicModel {
  /** The donation items. */
  donations?: ArtistDonationItem[];

  /** @see {@link ArtistDonations} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistDonations | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistDonations(client);
    model.donations = deList(ArtistDonationItem.deJson, raw['donations'], client);
    reportUnknown(client, 'ArtistDonations', raw, model);
    return model;
  }
}

/** Detailed artist information (`/artists/{id}/info`). */
export class ArtistInfo extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** Number of likes. */
  likesCount?: number;
  /** Listening statistics. */
  stats?: Stats;
  /** Trailer availability (free-form raw JSON). */
  trailer?: JSONValue;
  /** Donation info (free-form raw JSON). */
  donation?: JSONValue;
  /** All available covers. */
  covers?: Cover[];
  /** Artist description. */
  description?: string;
  /** Artist type (for example `artist`, `podcaster`). */
  artistType?: string;

  /** @see {@link ArtistInfo} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistInfo | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistInfo(client);
    assign(model, raw, ['likesCount', 'trailer', 'donation', 'description', 'artistType']);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.stats = Stats.deJson(raw['stats'], client) ?? undefined;
    model.covers = deList(Cover.deJson, raw['covers'], client);
    reportUnknown(client, 'ArtistInfo', raw, model);
    return model;
  }
}

/** The "about" block of an artist (`/artists/{id}/about-artist`). */
export class ArtistAbout extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** Donation blocks. */
  donations?: ArtistDonationItem[];
  /** Listening statistics. */
  stats?: Stats;
  /** Artist description. */
  description?: string;
  /** External links. */
  links?: Link[];
  /** All available covers. */
  covers?: Cover[];
  /** Artist type. */
  artistType?: string;

  /** @see {@link ArtistAbout} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistAbout | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistAbout(client);
    assign(model, raw, ['description', 'artistType']);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.donations = deList(ArtistDonationItem.deJson, raw['donations'], client);
    model.stats = Stats.deJson(raw['stats'], client) ?? undefined;
    model.links = deList(Link.deJson, raw['links'], client);
    model.covers = deList(Cover.deJson, raw['covers'], client);
    reportUnknown(client, 'ArtistAbout', raw, model);
    return model;
  }
}

/** The payload of an {@link ArtistClipItem} (a clip plus its artists). */
export class ArtistClipData extends YandexMusicModel {
  /** The clip. */
  clip?: Clip;
  /** Artists featured in the clip. */
  artists?: Artist[];

  /** @see {@link ArtistClipData} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistClipData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistClipData(client);
    model.clip = Clip.deJson(raw['clip'], client) ?? undefined;
    model.artists = deList(Artist.deJson, raw['artists'], client);
    reportUnknown(client, 'ArtistClipData', raw, model);
    return model;
  }
}

/** A single item in the artist-clips block. */
export class ArtistClipItem extends YandexMusicModel {
  /** Item type. */
  type?: string;
  /** Item payload. */
  data?: ArtistClipData;

  /** @see {@link ArtistClipItem} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistClipItem | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistClipItem(client);
    assign(model, raw, ['type']);
    model.data = ArtistClipData.deJson(raw['data'], client) ?? undefined;
    reportUnknown(client, 'ArtistClipItem', raw, model);
    return model;
  }
}

/** The artist-clips block (`/artists/{id}/blocks/artist-clips`). */
export class ArtistClips extends YandexMusicModel {
  /** The clip items. */
  items?: ArtistClipItem[];
  /** Pagination metadata. */
  pager?: Pager;

  /** @see {@link ArtistClips} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistClips | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistClips(client);
    model.items = deList(ArtistClipItem.deJson, raw['items'], client);
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    reportUnknown(client, 'ArtistClips', raw, model);
    return model;
  }
}

/** An artist page skeleton (`/artists/{id}/skeletons/{skeletonId}`). */
export class ArtistSkeleton extends YandexMusicModel {
  /** Skeleton id. */
  id?: string;
  /** Skeleton title. */
  title?: string;
  /** Page blocks (free-form raw JSON, pending typed variants). */
  blocks?: JSONValue[];

  /** @see {@link ArtistSkeleton} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistSkeleton | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistSkeleton(client);
    assign(model, raw, ['id', 'title', 'blocks']);
    reportUnknown(client, 'ArtistSkeleton', raw, model);
    return model;
  }
}
