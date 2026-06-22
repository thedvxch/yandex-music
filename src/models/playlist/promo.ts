/**
 * Typed sub-objects embedded in a {@link Playlist}.
 *
 * These cover the personalization, promo and theming payloads that a playlist
 * may carry: {@link MadeFor}, {@link PlayCounter}, {@link PlaylistAbsence},
 * {@link OpenGraphData}, {@link Brand}, {@link CustomWave} and {@link Contest}.
 *
 * @packageDocumentation
 */
import { YandexMusicModel, assign, isJsonObject } from '../../base.js';
import { Cover } from '../common.js';
import { User } from '../user.js';
import type { Client } from '../../client.js';
import type { JSONValue } from '../../types.js';

/**
 * Grammatical case forms of a name, used to inflect "made for {user}" labels in
 * Russian.
 */
export class CaseForms extends YandexMusicModel {
  /** Nominative case. */
  nominative?: string;
  /** Genitive case. */
  genitive?: string;
  /** Dative case. */
  dative?: string;
  /** Accusative case. */
  accusative?: string;
  /** Instrumental case. */
  instrumental?: string;
  /** Prepositional case. */
  prepositional?: string;

  /** @see {@link CaseForms} */
  static deJson(raw: JSONValue | undefined, client?: Client): CaseForms | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CaseForms(client);
    assign(model, raw, ['nominative', 'genitive', 'dative', 'accusative', 'instrumental', 'prepositional']);
    return model;
  }
}

/**
 * Personalization descriptor for a "made for you" playlist (such as the daily
 * playlist), naming the user it was generated for.
 */
export class MadeFor extends YandexMusicModel {
  /** The user the playlist was made for. */
  userInfo?: User;
  /** Inflected forms of the user's name. */
  caseForms?: CaseForms;

  /** @see {@link MadeFor} */
  static deJson(raw: JSONValue | undefined, client?: Client): MadeFor | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new MadeFor(client);
    model.userInfo = User.deJson(raw['userInfo'], client) ?? undefined;
    model.caseForms = CaseForms.deJson(raw['caseForms'], client) ?? undefined;
    return model;
  }
}

/**
 * Aggregate play counter shown on some personalized playlists.
 */
export class PlayCounter extends YandexMusicModel {
  /** Number of plays. */
  value?: number;
  /** Human-readable description. */
  description?: string;
  /** Whether the counter was updated in this period. */
  updated?: boolean;

  /** @see {@link PlayCounter} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlayCounter | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlayCounter(client);
    assign(model, raw, ['value', 'description', 'updated']);
    return model;
  }
}

/**
 * Explains why a previously available playlist is now absent.
 */
export class PlaylistAbsence extends YandexMusicModel {
  /** Kind of the absent playlist. */
  kind?: number;
  /** Reason the playlist is unavailable. */
  reason?: string;

  /** @see {@link PlaylistAbsence} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistAbsence | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistAbsence(client);
    assign(model, raw, ['kind', 'reason']);
    return model;
  }
}

/**
 * Open Graph metadata used when a playlist is shared as a link.
 */
export class OpenGraphData extends YandexMusicModel {
  /** Share title. */
  title?: string;
  /** Share description. */
  description?: string;
  /** Share image. */
  image?: Cover;

  /** @see {@link OpenGraphData} */
  static deJson(raw: JSONValue | undefined, client?: Client): OpenGraphData | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new OpenGraphData(client);
    assign(model, raw, ['title', 'description']);
    model.image = Cover.deJson(raw['image'], client) ?? undefined;
    return model;
  }
}

/**
 * Branding/theming applied to a sponsored or branded playlist.
 */
export class Brand extends YandexMusicModel {
  /** Brand image. */
  image?: string;
  /** Background image. */
  background?: string;
  /** Reference (target) URL. */
  reference?: string;
  /** Tracking pixel URLs. */
  pixels?: string[];
  /** Theme name. */
  theme?: string;
  /** Playlist-specific theme name. */
  playlistTheme?: string;
  /** Button label/color. */
  button?: string;

  /** @see {@link Brand} */
  static deJson(raw: JSONValue | undefined, client?: Client): Brand | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Brand(client);
    assign(model, raw, ['image', 'background', 'reference', 'pixels', 'theme', 'playlistTheme', 'button']);
    return model;
  }
}

/**
 * Availability of a playlist trailer.
 */
export class PlaylistAvailability extends YandexMusicModel {
  /** Whether the trailer is available. */
  available?: boolean;

  /** @see {@link PlaylistAvailability} */
  static deJson(raw: JSONValue | undefined, client?: Client): PlaylistAvailability | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new PlaylistAvailability(client);
    assign(model, raw, ['available']);
    return model;
  }
}

/**
 * Custom "wave" (radio) presentation attached to a playlist.
 */
export class CustomWave extends YandexMusicModel {
  /** Wave title. */
  title?: string;
  /** Animation URL. */
  animationUrl?: string;
  /** Title position. */
  position?: string;
  /** Header text. */
  header?: string;
  /** Background image URL. */
  backgroundImageUrl?: string;

  /** @see {@link CustomWave} */
  static deJson(raw: JSONValue | undefined, client?: Client): CustomWave | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new CustomWave(client);
    assign(model, raw, ['title', 'animationUrl', 'position', 'header', 'backgroundImageUrl']);
    return model;
  }
}

/**
 * Contest entry state for a playlist submitted to a Yandex Music contest.
 */
export class Contest extends YandexMusicModel {
  /** Contest id. */
  contestId?: string;
  /** Submission status. */
  status?: string;
  /** Whether the playlist can still be edited. */
  canEdit?: boolean;
  /** Submission timestamp. */
  sent?: string;
  /** Withdrawal timestamp. */
  withdrawn?: string;

  /** @see {@link Contest} */
  static deJson(raw: JSONValue | undefined, client?: Client): Contest | null {
    if (!isJsonObject(raw)) {
      return null;
    }
    const model = new Contest(client);
    assign(model, raw, ['contestId', 'status', 'canEdit', 'sent', 'withdrawn']);
    return model;
  }
}
