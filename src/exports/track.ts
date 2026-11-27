/** Public exports: track. */
export { Track } from '../models/track/track.js';
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
} from '../models/track/nested.js';
export { DownloadInfo, LosslessDownloadInfo, FileDownloadInfo, FileInfo, decryptEncraw, encrawDecipher, TrackLyrics, SimilarTracks, TrackFullInfo, TrackTrailer } from '../models/track/extras.js';
export type { DownloadOptions } from '../models/track/extras.js';
export { Supplement, Lyrics, VideoSupplement } from '../models/supplement.js';
export { Shot, ShotData, ShotType, ShotEvent } from '../models/shot.js';
export { TrailerInfo } from '../models/trailerInfo.js';
export {
  AlbumTrailer,
  AlbumSimilarEntities,
  AlbumDonations,
  AlbumRelatedContent,
  AlbumRelatedContentBlock,
} from '../models/album/albumExtras.js';
