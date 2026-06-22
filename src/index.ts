/**
 * yamuse — a typed, async TypeScript client for the Yandex Music API.
 *
 * @packageDocumentation
 */

// Client
export { Client } from './client.js';
export type { ClientOptions } from './client.js';
export { ClientBase, DEFAULT_BASE_URL, DEFAULT_DEVICE } from './clientBase.js';
export type { BatchObjectType } from './clientBase.js';

// Transport
export { Request, USER_AGENT, DEFAULT_TIMEOUT_MS, BASE_HEADERS } from './request.js';
export type { Params, ParamValue, RequestInit } from './request.js';

// Signing
export { getSignRequest, convertTrackIdToNumber, DEFAULT_SIGN_KEY } from './signRequest.js';
export type { Sign } from './signRequest.js';

// Base model machinery
export { YandexMusicModel, deList, isJsonObject, assign } from './base.js';
export type { JSONObject, JSONValue, DeJson } from './types.js';

// Exceptions
export {
  YandexMusicError,
  UnauthorizedError,
  InvalidBitrateError,
  IdMissingError,
  NetworkError,
  BadRequestError,
  NotFoundError,
  TimedOutError,
  DeviceAuthError,
  YnisonError,
} from './exceptions.js';

// Models — common value objects
export { Cover, CoverDerivedColors, Icon, Link, ContentRestrictions } from './models/common.js';
export { Pager } from './models/pager.js';

// Models — track
export { Track } from './models/track/track.js';
export {
  Major,
  Normalization,
  PoetryLoverMatch,
  LyricsInfo,
  Fade,
  SmartPreviewParams,
  MetaData,
  R128,
  LyricsMajor,
} from './models/track/nested.js';
export { DownloadInfo, TrackLyrics, SimilarTracks, TrackFullInfo, TrackTrailer } from './models/track/extras.js';

// Models — artist
export { Artist, Counts, Ratings, Description } from './models/artist/artist.js';
export { ArtistTracks } from './models/artist/artistTracks.js';

// Models — album
export { Album, Label, TrackPosition, Deprecation, AlbumActionButton } from './models/album/album.js';

// Models — account
export { Status, Account, PassportPhone } from './models/account/account.js';

// Models — playlist / user / video / track refs
export { Playlist } from './models/playlist/playlist.js';
export { User } from './models/user.js';
export { Video } from './models/video.js';
export { TrackShort, TrackId } from './models/trackShort.js';

// Models — search
export { Search, SearchResult, Best, Suggestions } from './models/search/search.js';
export type { SearchEntity } from './models/search/search.js';
export type { SearchType } from './methods/search.js';

// Models — likes / device auth
export { Like, TracksList } from './models/like.js';
export { DeviceCode, OAuthToken } from './models/deviceAuth.js';
export type { LikeableType } from './methods/likes.js';
export type { OnCodeCallback, DeviceAuthOptions } from './methods/deviceAuth.js';

// Models — landing
export { Landing, Block, BlockEntity, LandingList, ChartInfo, Chart, ChartItem } from './models/landing/landing.js';
export { Genre } from './models/genre.js';

// Models — rotor (radio)
export { Id, Station, StationResult, Dashboard, Sequence, StationTracksResult } from './models/rotor/rotor.js';

// Models — queue
export { Queue, QueueItem, Context } from './models/queue/queue.js';

// Models — music history
export {
  MusicHistory,
  MusicHistoryItems,
  MusicHistoryTab,
  MusicHistoryGroup,
  MusicHistoryItem,
  MusicHistoryItemData,
  MusicHistoryItemId,
} from './models/musicHistory/musicHistory.js';
