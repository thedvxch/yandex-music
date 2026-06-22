/**
 * The public {@link Client} entry point.
 *
 * @packageDocumentation
 */
import { ClientBase, type ClientOptions } from './clientBase.js';
import { AccountMixin } from './methods/account.js';
import { AlbumsMixin } from './methods/albums.js';
import { ArtistsMixin } from './methods/artists.js';
import { DeviceAuthMixin } from './methods/deviceAuth.js';
import { LandingMixin } from './methods/landing.js';
import { LikesMixin } from './methods/likes.js';
import { MusicHistoryMixin } from './methods/musicHistory.js';
import { PlaylistsMixin } from './methods/playlists.js';
import { QueueMixin } from './methods/queue.js';
import { RadioMixin } from './methods/radio.js';
import { SearchMixin } from './methods/search.js';
import { TracksMixin } from './methods/tracks.js';

/**
 * The method groups layered onto {@link ClientBase}. Splitting them into mixins
 * keeps each domain in its own file while preserving a single flat client API.
 */
const ComposedClient = AccountMixin(
  TracksMixin(
    SearchMixin(
      AlbumsMixin(
        ArtistsMixin(
          PlaylistsMixin(
            LandingMixin(
              RadioMixin(
                QueueMixin(MusicHistoryMixin(LikesMixin(DeviceAuthMixin(ClientBase)))),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);

/**
 * Typed, async client for the Yandex Music API.
 *
 * @example
 * ```ts
 * import { Client } from 'yamuse';
 *
 * const client = await new Client({ token: process.env.YM_TOKEN }).init();
 * const [track] = await client.tracks(2);
 * console.log(track?.title);
 *
 * const [info] = await track!.getDownloadInfo();
 * await info.download('track.mp3');
 * ```
 *
 * @remarks
 * Construct with an OAuth `token` and call {@link Client.init} once to load
 * account information used by some endpoints. Supported response languages are
 * `en`, `uz`, `uk`, `us`, `ru`, `kk` and `hy`.
 */
export class Client extends ComposedClient {
  /**
   * @param options - Client configuration (token, base URL, language, ...).
   */
  constructor(options: ClientOptions = {}) {
    super(options);
  }
}

export type { ClientOptions } from './clientBase.js';
