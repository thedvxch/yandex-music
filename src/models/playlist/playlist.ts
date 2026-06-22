/**
 * The {@link Playlist} model.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, deList, isJsonObject } from '../../base.js';
import { Cover } from '../common.js';
import { Pager } from '../pager.js';
import { User } from '../user.js';
import { TrackId, TrackShort } from '../trackShort.js';
import { Artist } from '../artist/artist.js';
import {
  MadeFor,
  PlayCounter,
  PlaylistAbsence,
  OpenGraphData,
  Brand,
  CustomWave,
  Contest,
  PlaylistAvailability,
} from './promo.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/**
 * A playlist (user-made or editorial).
 */
export class Playlist extends YandexMusicModel {
  /** Owner of the playlist. */
  owner?: User;
  /** Playlist cover. */
  cover?: Cover;
  /** "Made for" personalization. */
  madeFor?: MadeFor;
  /** Play counter. */
  playCounter?: PlayCounter;
  /** Absence info. */
  playlistAbsence?: PlaylistAbsence;
  /** Owner uid. */
  uid?: number;
  /** Playlist kind (id within the owner's playlists). */
  kind?: number;
  /** Title. */
  title?: string;
  /** Number of tracks. */
  trackCount?: number;
  /** Tags. */
  tags?: JSONValue[];
  /** Revision number. */
  revision?: number;
  /** Snapshot number. */
  snapshot?: number;
  /** Visibility (`public`/`private`). */
  visibility?: string;
  /** Whether collaborative. */
  collective?: boolean;
  /** URL slug. */
  urlPart?: string;
  /** Creation timestamp. */
  created?: string;
  /** Last modification timestamp. */
  modified?: string;
  /** Whether available. */
  available?: boolean;
  /** Whether shown as a banner. */
  isBanner?: boolean;
  /** Whether a premiere. */
  isPremiere?: boolean;
  /** Total duration in milliseconds. */
  durationMs?: number;
  /** Open Graph image URI template. */
  ogImage?: string;
  /** Open Graph title. */
  ogTitle?: string;
  /** Open Graph description. */
  ogDescription?: string;
  /** Image URI template. */
  image?: string;
  /** Cover without overlaid text. */
  coverWithoutText?: Cover;
  /** Contest info. */
  contest?: Contest;
  /** Background color. */
  backgroundColor?: string;
  /** Text color. */
  textColor?: string;
  /** Origin id used in `from` parameters. */
  idForFrom?: string;
  /** Open Graph data. */
  ogData?: OpenGraphData;
  /** Branding. */
  branding?: Brand;
  /** Metrika id. */
  metrikaId?: number;
  /** Co-author uids. */
  coauthors?: number[];
  /** Top artists in the playlist. */
  topArtist?: Artist[];
  /** Recently added track references. */
  recentTracks?: TrackId[];
  /** Track references. */
  tracks?: TrackShort[];
  /** Number of likes. */
  likesCount?: number;
  /** Playlists similar to this one. */
  similarPlaylists?: Playlist[];
  /** Other playlists by the same owner. */
  lastOwnerPlaylists?: Playlist[];
  /** Generated playlist kind (for example `playlistOfTheDay`). */
  generatedPlaylistType?: string;
  /** Animated cover URI. */
  animatedCoverUri?: string;
  /** Whether the playlist was ever played. */
  everPlayed?: boolean;
  /** Description. */
  description?: string;
  /** Formatted (HTML) description. */
  descriptionFormatted?: string;
  /** Stable UUID. */
  playlistUuid?: string;
  /** Playlist kind label. */
  type?: string;
  /** Whether generation finished. */
  ready?: boolean;
  /** Custom wave config. */
  customWave?: CustomWave;
  /** Pagination metadata for the track list. */
  pager?: Pager;
  /** Whether a trailer exists. */
  hasTrailer?: boolean;
  /** Trailer availability. */
  trailer?: PlaylistAvailability;
  /** Background video URL. */
  backgroundVideoUrl?: string;
  /** Background video id. */
  backgroundVideoId?: string;
  /** Background image URL. */
  backgroundImageUrl?: string;

  /** @see {@link Playlist} */
  static deJson(raw: JSONValue | undefined, client?: Client): Playlist | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Playlist(client);
    assign(model, raw, [
      'uid',
      'kind',
      'title',
      'trackCount',
      'tags',
      'revision',
      'snapshot',
      'visibility',
      'collective',
      'urlPart',
      'created',
      'modified',
      'available',
      'isBanner',
      'isPremiere',
      'durationMs',
      'ogImage',
      'ogTitle',
      'ogDescription',
      'image',
      'backgroundColor',
      'textColor',
      'idForFrom',
      'metrikaId',
      'coauthors',
      'likesCount',
      'generatedPlaylistType',
      'animatedCoverUri',
      'everPlayed',
      'description',
      'descriptionFormatted',
      'playlistUuid',
      'type',
      'ready',
      'hasTrailer',
      'backgroundVideoUrl',
      'backgroundVideoId',
      'backgroundImageUrl',
    ]);
    model.owner = User.deJson(raw['owner'], client) ?? undefined;
    model.cover = Cover.deJson(raw['cover'], client) ?? undefined;
    model.coverWithoutText = Cover.deJson(raw['coverWithoutText'], client) ?? undefined;
    model.madeFor = MadeFor.deJson(raw['madeFor'], client) ?? undefined;
    model.playCounter = PlayCounter.deJson(raw['playCounter'], client) ?? undefined;
    model.playlistAbsence = PlaylistAbsence.deJson(raw['playlistAbsence'], client) ?? undefined;
    model.contest = Contest.deJson(raw['contest'], client) ?? undefined;
    model.ogData = OpenGraphData.deJson(raw['ogData'], client) ?? undefined;
    model.branding = Brand.deJson(raw['branding'], client) ?? undefined;
    model.customWave = CustomWave.deJson(raw['customWave'], client) ?? undefined;
    model.trailer = PlaylistAvailability.deJson(raw['trailer'], client) ?? undefined;
    model.pager = Pager.deJson(raw['pager'], client) ?? undefined;
    model.topArtist = deList(Artist.deJson, raw['topArtist'], client);
    model.recentTracks = deList(TrackId.deJson, raw['recentTracks'], client);
    model.tracks = deList(TrackShort.deJson, raw['tracks'], client);
    model.similarPlaylists = deList(Playlist.deJson, raw['similarPlaylists'], client);
    model.lastOwnerPlaylists = deList(Playlist.deJson, raw['lastOwnerPlaylists'], client);
    return model;
  }
}
