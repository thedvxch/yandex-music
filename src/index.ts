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
export type { Params, ParamValue, RequestInit, FetchLike, ResponseLike } from './request.js';

// Signing
export {
  getSignRequest,
  getFileInfoSign,
  convertTrackIdToNumber,
  DEFAULT_SIGN_KEY,
  FILE_INFO_CODECS,
  FILE_INFO_TRANSPORT,
} from './signRequest.js';
export type { Sign, FileInfoSign } from './signRequest.js';

// Base model machinery
export { YandexMusicModel, deList, isJsonObject, assign, reportUnknown } from './base.js';
export type { JSONObject, JSONValue, DeJson } from './types.js';
export type { UnknownFieldsReport, UnknownFieldReporter } from './base.js';

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
export { DownloadInfo, LosslessDownloadInfo, decryptEncraw, encrawDecipher, TrackLyrics, SimilarTracks, TrackFullInfo, TrackTrailer } from './models/track/extras.js';

// Models — artist
export { Artist, Counts, Ratings, Description } from './models/artist/artist.js';
export { ArtistTracks } from './models/artist/artistTracks.js';
export {
  ArtistLink,
  ArtistLinks,
  ArtistAlbums,
  ArtistSimilar,
  ArtistTrailer,
  BriefInfo,
} from './models/artist/artistExtras.js';
export { Stats } from './models/artist/stats.js';
export { Vinyl } from './models/artist/vinyl.js';
export type { ArtistAlbumsSortBy, SortOrder } from './methods/artists.js';

// Models — album
export { Album, Label, TrackPosition, Deprecation, AlbumActionButton } from './models/album/album.js';

// Models — account
export { Status, Account, PassportPhone } from './models/account/account.js';
export {
  Permissions,
  Plus,
  Price,
  LicenceTextPart,
  Product,
  AutoRenewable,
  NonAutoRenewable,
  RenewableRemainder,
  Deactivation,
  Operator,
  Subscription,
} from './models/account/subscription.js';
export {
  UserSettings,
  Settings,
  PermissionAlerts,
  PromoCodeStatus,
  Experiments,
  ExperimentsDetails,
} from './models/account/settings.js';

// Models — supplement / shot / trailer
export { Supplement, Lyrics, VideoSupplement } from './models/supplement.js';
export { Shot, ShotData, ShotType, ShotEvent } from './models/shot.js';
export { TrailerInfo } from './models/trailerInfo.js';
export { AlbumTrailer, AlbumSimilarEntities } from './models/album/albumExtras.js';

// Models — playlist / user / video / track refs
export { Playlist } from './models/playlist/playlist.js';
export { PlaylistId } from './models/playlist/playlistId.js';
export {
  MadeFor,
  CaseForms,
  PlayCounter,
  PlaylistAbsence,
  OpenGraphData,
  Brand,
  CustomWave,
  Contest,
  PlaylistAvailability,
} from './models/playlist/promo.js';
export {
  PlaylistRecommendations,
  PlaylistSimilarEntities,
  PlaylistsList,
  PlaylistTrailer,
  GeneratedPlaylist,
} from './models/playlist/playlistExtras.js';
export type { PlaylistVisibility } from './methods/playlists.js';
export { Difference } from './utils/difference.js';
export type { DiffTrack } from './utils/difference.js';
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
export type { LikeableType, DislikeableType } from './methods/likes.js';
export type { OnCodeCallback, DeviceAuthOptions } from './methods/deviceAuth.js';
export type { PlayAudioOptions } from './methods/tracks.js';

// Models — landing
export { Landing, Block, BlockEntity, LandingList, ChartInfo, Chart, ChartItem } from './models/landing/landing.js';
export type { BlockEntityData } from './models/landing/landing.js';
export { Promotion, PlayContext, MixLink, TrackShortOld } from './models/landing/entities.js';
export { Genre } from './models/genre.js';

// Models — rotor (radio)
export {
  Id,
  Station,
  StationResult,
  Dashboard,
  Sequence,
  TrackParameters,
  StationTracksResult,
  Restrictions,
  Enum,
  DiscreteScale,
  Value,
  AdParams,
} from './models/rotor/rotor.js';
export type {
  RotorFeedbackType,
  RotorMoodEnergy,
  RotorDiversity,
  RotorLanguage,
  RotorStationType,
} from './methods/radio.js';

// Models — queue
export { Queue, QueueItem, Context } from './models/queue/queue.js';

// Models — concerts
export {
  Concert,
  ConcertMinPrice,
  ConcertCashback,
  ConcertEventInfo,
  ConcertDescription,
  ArtistConcerts,
  ConcertInfo,
  ConcertFeed,
  ConcertFeedItem,
  ConcertFeedItemData,
  ConcertLocation,
  ConcertLocations,
  ConcertTabConfig,
  ConcertTabConfigData,
  ConcertTabRange,
  ConcertSkeleton,
} from './models/concert/concert.js';

// Models — clips / credits / disclaimers / labels / metatags / pins / presaves
export { Clip, ClipsWillLike } from './models/clip.js';
export { Credit, Credits } from './models/credit.js';
export { Disclaimer, ForeignAgent } from './models/disclaimer.js';
export { LabelAlbums, LabelArtists } from './models/label/labelExtras.js';
export {
  Metatags,
  Metatag,
  MetatagTree,
  MetatagLeaf,
  MetatagTitle,
  MetatagSortByValue,
  MetatagArtistEntry,
  MetatagAlbums,
  MetatagArtists,
  MetatagPlaylists,
} from './models/metatag/metatag.js';
export type { MetatagOptions } from './methods/metatags.js';
export { Pin, PinData, PinsList } from './models/pin.js';
export { Presaves } from './models/presaves.js';

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
export type { MusicHistoryItemsQuery } from './methods/musicHistory.js';

// Realtime — Ynison (requires the optional `ws` package)
export { RealtimeClient, liveProgressMs } from './ynison/realtime.js';
export type { RealtimeOptions, RealtimeEvents, TrackChangeEvent, NowPlaying } from './ynison/realtime.js';
export { YnisonClient, parseStateFrame, parseRedirectFrame } from './ynison/client.js';
export type { YnisonState, RedirectResponse, StateListener, YnisonClientOptions } from './ynison/client.js';
export {
  generateDeviceId,
  generateRequestId,
  buildUpdateFullStateRequest,
  ANDROID_DEVICE_INFO,
} from './ynison/messages.js';
export type { DeviceInfoOverride, UpdateFullStateRequest } from './ynison/messages.js';
