/**
 * Feed models for the legacy `/feed` endpoint.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject, reportUnknown } from '../../base.js';
import { Track } from '../track/track.js';
import { Artist } from '../artist/artist.js';
import { Album } from '../album/album.js';
import { GeneratedPlaylist } from '../playlist/playlistExtras.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/** A track bundled with its ad parameters, as served inside a {@link Day}. */
export class TrackWithAds extends YandexMusicModel {
  /** Ad slot type. */
  type?: string;
  /** The track. */
  track?: Track;

  /** @see {@link TrackWithAds} */
  static deJson(raw: JSONValue | undefined, client?: Client): TrackWithAds | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new TrackWithAds(client);
    assign(model, raw, ['type']);
    model.track = Track.deJson(raw['track'], client) ?? undefined;
    reportUnknown(client, 'TrackWithAds', raw, model);
    return model;
  }
}

/** An album together with the tracks surfaced for it inside a feed {@link Event}. */
export class AlbumEvent extends YandexMusicModel {
  /** The album. */
  album?: Album;
  /** Tracks surfaced from the album. */
  tracks?: Track[];

  /** @see {@link AlbumEvent} */
  static deJson(raw: JSONValue | undefined, client?: Client): AlbumEvent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new AlbumEvent(client);
    model.album = Album.deJson(raw['album'], client) ?? undefined;
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    reportUnknown(client, 'AlbumEvent', raw, model);
    return model;
  }
}

/** An artist together with surfaced tracks and similar artists inside a feed {@link Event}. */
export class ArtistEvent extends YandexMusicModel {
  /** The artist. */
  artist?: Artist;
  /** Tracks surfaced from the artist. */
  tracks?: Track[];
  /** Similar artists derived from listening history. */
  similarToArtistsFromHistory?: Artist[];
  /** Whether the user is subscribed to the artist (liked). */
  subscribed?: boolean;

  /** @see {@link ArtistEvent} */
  static deJson(raw: JSONValue | undefined, client?: Client): ArtistEvent | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new ArtistEvent(client);
    model.artist = Artist.deJson(raw['artist'], client) ?? undefined;
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    model.similarToArtistsFromHistory = deList(Artist.deJson, raw['similarToArtistsFromHistory'], client);
    assign(model, raw, ['subscribed']);
    reportUnknown(client, 'ArtistEvent', raw, model);
    return model;
  }
}

/** A single event in a {@link Day} (a release, a recommendation, a promotion, …). */
export class Event extends YandexMusicModel {
  /** Event id. */
  id?: string;
  /** Event type. */
  type?: string;
  /** Origin tag used in `from` parameters. */
  typeForFrom?: string;
  /** Event title. */
  title?: string;
  /** Tracks featured in the event. */
  tracks?: Track[];
  /** Artist sub-events featured in the event. */
  artists?: ArtistEvent[];
  /** Album sub-events featured in the event. */
  albums?: AlbumEvent[];
  /** Event message text. */
  message?: string;
  /** Device name. */
  device?: string;
  /** Number of tracks in the event. */
  tracksCount?: number;
  /** Associated genre. */
  genre?: string;
  /** Background descriptor (raw JSON, promotion events). */
  background?: JSONValue;
  /** Promotion category. */
  category?: string;
  /** Event description. */
  description?: string;
  /** Promotion heading. */
  heading?: string;
  /** Image position hint. */
  imagePosition?: string;
  /** Promotion id. */
  promoId?: string;
  /** Promotion type. */
  promotionType?: string;
  /** Promotion start date. */
  startDate?: string;
  /** Event subtitle. */
  subtitle?: string;
  /** Subtitle link URL. */
  subtitleUrl?: string;
  /** Event tags (raw JSON). */
  tags?: JSONValue;
  /** Title link URL. */
  titleUrl?: string;

  /** @see {@link Event} */
  static deJson(raw: JSONValue | undefined, client?: Client): Event | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Event(client);
    assign(model, raw, [
      'id',
      'type',
      'typeForFrom',
      'title',
      'message',
      'device',
      'tracksCount',
      'genre',
      'background',
      'category',
      'description',
      'heading',
      'imagePosition',
      'promoId',
      'promotionType',
      'startDate',
      'subtitle',
      'subtitleUrl',
      'tags',
      'titleUrl',
    ]);
    model.tracks = deList(Track.deJson, raw['tracks'], client);
    model.artists = deList(ArtistEvent.deJson, raw['artists'], client);
    model.albums = deList(AlbumEvent.deJson, raw['albums'], client);
    reportUnknown(client, 'Event', raw, model);
    return model;
  }
}

/** A single day of the {@link Feed}. */
export class Day extends YandexMusicModel {
  /** Date (`YYYY-MM-DD`). */
  day?: string;
  /** Events of the day. */
  events?: Event[];
  /** Tracks to play, with ad slots. */
  tracksToPlayWithAds?: TrackWithAds[];
  /** Tracks to play. */
  tracksToPlay?: Track[];

  /** @see {@link Day} */
  static deJson(raw: JSONValue | undefined, client?: Client): Day | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Day(client);
    assign(model, raw, ['day']);
    model.events = deList(Event.deJson, raw['events'], client);
    model.tracksToPlayWithAds = deList(TrackWithAds.deJson, raw['tracksToPlayWithAds'], client);
    model.tracksToPlay = deList(Track.deJson, raw['tracksToPlay'], client);
    reportUnknown(client, 'Day', raw, model);
    return model;
  }
}

/** A notification headline shown above the feed (for example a "vk-not-bound" notification). */
export class FeedHeadline extends YandexMusicModel {
  /** Headline kind (for example "notification"). */
  type?: string;
  /** Headline id. */
  id?: string;
  /** Headline message code or text. */
  message?: string;

  /** @see {@link FeedHeadline} */
  static deJson(raw: JSONValue | undefined, client?: Client): FeedHeadline | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new FeedHeadline(client);
    assign(model, raw, ['type', 'id', 'message']);
    reportUnknown(client, 'FeedHeadline', raw, model);
    return model;
  }
}

/** The personalised feed (`/feed`). */
export class Feed extends YandexMusicModel {
  /** Whether more events can be loaded. */
  canGetMoreEvents?: boolean;
  /** Whether the Halloween ("pumpkin") theme is active. */
  pumpkin?: boolean;
  /** Whether the onboarding wizard has been completed. */
  isWizardPassed?: boolean;
  /** Personalised generated playlists. */
  generatedPlaylists?: GeneratedPlaylist[];
  /** Notification headlines shown above the feed. */
  headlines?: FeedHeadline[];
  /** Today's date (`YYYY-MM-DD`). */
  today?: string;
  /** The feed days. */
  days?: Day[];
  /** Revision token for the next page. */
  nextRevision?: string;

  /** @see {@link Feed} */
  static deJson(raw: JSONValue | undefined, client?: Client): Feed | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Feed(client);
    assign(model, raw, ['canGetMoreEvents', 'pumpkin', 'isWizardPassed', 'today', 'nextRevision']);
    model.headlines = deList(FeedHeadline.deJson, raw['headlines'], client);
    model.generatedPlaylists = deList(GeneratedPlaylist.deJson, raw['generatedPlaylists'], client);
    model.days = deList(Day.deJson, raw['days'], client);
    reportUnknown(client, 'Feed', raw, model);
    return model;
  }
}
