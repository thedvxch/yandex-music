/**
 * Rotor (radio) client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { pathSegment } from '../utils/path.js';
import { deList, isJsonObject } from '../base.js';
import { Status } from '../models/account/account.js';
import {
  ClonedSession,
  CombinedSession,
  Dashboard,
  OfflineRecommender,
  RotorSession,
  RotorSessionTracks,
  StationResult,
  StationTracksResult,
  WaveInfo,
  WaveSettings,
} from '../models/rotor/rotor.js';
import { CombinedSessionLanding } from '../models/rotor/session.js';
import { GenerativeStream, GenerativeStreamFeedback } from '../models/rotor/stream.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';
import type { JsonInput, Params } from '../request.js';

/** Kind of feedback sent to the rotor while listening to a station. */
export type RotorFeedbackType = 'radioStarted' | 'trackStarted' | 'trackFinished' | 'skip';

/** Mood/energy preset accepted by `rotorStationSettings2`. */
export type RotorMoodEnergy = 'fun' | 'active' | 'calm' | 'sad' | 'all';

/** Diversity preset accepted by `rotorStationSettings2`. */
export type RotorDiversity = 'favorite' | 'popular' | 'discover' | 'default';

/** Language preset accepted by `rotorStationSettings2`. */
export type RotorLanguage = 'not-russian' | 'russian' | 'any';

/** Station type accepted by `rotorStationSettings2`. */
export type RotorStationType = 'rotor' | 'generative';

/**
 * Event time: an ISO 8601 string, a `Date`, or a Unix time number. Defaults to now (ISO, millisecond precision, `Z`).
 *
 * @remarks
 * A finite number below `1e11` is taken as Unix **seconds** (the 0.3.0 meaning; as milliseconds it would be a
 * date in 1973); any larger number is taken as **milliseconds**. Numbers and `Date`s are sent as ISO 8601 strings;
 * strings are sent as is.
 */
export type FeedbackTimestamp = string | number | Date;

/** Options shared by `rotorSessionNew` and `rotorSessionClone` (sent as the JSON body). */
export interface RotorSessionOptions {
  /** Already played tracks (`id` or `id:albumId`). */
  queue?: string[];
  /** Track to start the session from. */
  trackToStartFrom?: string;
  /** Whether the response includes tracks. */
  includeTracksInResponse?: boolean;
  /** Whether the response includes the wave model. */
  includeWaveModel?: boolean;
  /** Interactive session. */
  interactive?: boolean;
  /** Do not count listening in recommendations. */
  incognito?: boolean;
  /** Child mode. */
  child?: boolean;
  /** Allow explicit content. */
  allowExplicit?: boolean;
}

/** A session feedback event. */
export interface SessionEventInput {
  /** Event type (for example `trackStarted`). */
  type: RotorFeedbackType | string;
  /** Event time. Defaults to now (ISO). */
  timestamp?: FeedbackTimestamp;
  /** Track id (sent as a string). */
  trackId?: string | number;
  /** Seconds of the track played so far. */
  totalPlayedSeconds?: number;
  /** The object the event refers to (for `playableItem*` events). */
  playable?: { type: string; trackId?: string; id?: string };
}

/** One feedback entry of a session. */
export interface SessionFeedbackInput {
  /** The event. */
  event: SessionEventInput;
  /** Track batch id. */
  batchId?: string;
  /** Where playback started. */
  from?: string;
}

/** Feedback entries for one session, for `rotorSessionsFeedbacks`. */
export interface SessionFeedbacksInput {
  /** Session id. */
  sessionId: string;
  /** The entries. */
  feedbacks: SessionFeedbackInput[];
}

/** A combined-session queue entry. */
export interface CombinedSessionQueueInput {
  /** `TRACK` or `CLIP`. */
  type: string;
  /** Track or clip id. */
  id: string;
}

function timestampOrNow(timestamp: FeedbackTimestamp | undefined): string {
  if (timestamp === undefined || timestamp === '' || timestamp === 0) {
    return new Date().toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  const date = timestamp instanceof Date ? timestamp : new Date(Math.abs(timestamp) < 1e11 ? timestamp * 1000 : timestamp);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function eventBody(event: SessionEventInput): JsonInput {
  return {
    type: event.type,
    timestamp: timestampOrNow(event.timestamp),
    trackId: event.trackId === undefined ? undefined : String(event.trackId),
    totalPlayedSeconds: event.totalPlayedSeconds,
    playable: event.playable,
  };
}

function feedbackBody(feedback: SessionFeedbackInput): JsonInput {
  return { event: eventBody(feedback.event), batchId: feedback.batchId, from: feedback.from };
}

function sessionBody(options: RotorSessionOptions): { [k: string]: JsonInput } {
  return {
    queue: options.queue,
    trackToStartFrom: options.trackToStartFrom,
    includeTracksInResponse: options.includeTracksInResponse,
    includeWaveModel: options.includeWaveModel,
    interactive: options.interactive,
    incognito: options.incognito,
    child: options.child,
    allowExplicit: options.allowExplicit,
  };
}

function queueBody(queue: CombinedSessionQueueInput[]): JsonInput {
  return queue.map((item) => ({ type: item.type, id: item.id }));
}

/**
 * Adds rotor (radio) endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with rotor methods.
 */
export function RadioMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class RadioMethods extends Base {
    /**
     * Fetch the rotor account status.
     *
     * @returns The status, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorAccountStatus(): Promise<Status | null> {
      const result = await this.request.get(`${this.baseUrl}/rotor/account/status`);
      return Status.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the personalized station dashboard.
     *
     * @returns The dashboard, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationsDashboard(): Promise<Dashboard | null> {
      const result = await this.request.get(`${this.baseUrl}/rotor/stations/dashboard`);
      return Dashboard.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the full list of available stations.
     *
     * @param language - Language for station info. Defaults to the client language.
     * @returns The list of stations.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationsList(language?: string): Promise<StationResult[]> {
      const result = await this.request.get(`${this.baseUrl}/rotor/stations/list`, {
        language: language ?? this.language,
      });
      return deList(StationResult.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch information about a specific station.
     *
     * @param station - Station id in `type:tag` form (for example `genre:pop`).
     * @returns The matching station results.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationInfo(station: string): Promise<StationResult[]> {
      const result = await this.request.get(`${this.baseUrl}/rotor/station/${pathSegment(station)}/info`);
      return deList(StationResult.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch information about a generative station and its stream.
     *
     * @param station - Generative station (for example `generative:focus`).
     * @returns The stream info, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationStream(station: string): Promise<GenerativeStream | null> {
      const result = await this.request.get(`${this.baseUrl}/rotor/station/${pathSegment(station)}/stream`);
      return GenerativeStream.deJson(result, this as unknown as Client);
    }

    /**
     * Send feedback to a generative station.
     *
     * @param station - Generative station.
     * @param type - `streamStarted`, `streamPlay` or `streamPause`.
     * @param streamId - Stream id (`streamId` query parameter).
     * @param timestamp - Event time. Defaults to now (ISO).
     * @returns The stream state, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationStreamFeedback(
      station: string,
      type: 'streamStarted' | 'streamPlay' | 'streamPause' | string,
      streamId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<GenerativeStreamFeedback | null> {
      const params: Params = {};
      if (streamId) {
        params['streamId'] = streamId;
      }
      const result = await this.request.send('POST', `${this.baseUrl}/rotor/station/${pathSegment(station)}/feedback`, {
        params,
        json: { type, timestamp: timestampOrNow(timestamp) },
      });
      return GenerativeStreamFeedback.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the next batch of tracks from a station.
     *
     * @param station - Station id in `type:tag` form.
     * @param settings2 - Use the second settings set (as official clients do). Defaults to `true`.
     * @param queue - Id of the track that just played, to inform the next batch (ignored when `''` or `0`).
     * @returns The track batch, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationTracks(
      station: string,
      settings2 = true,
      queue?: string | number,
    ): Promise<StationTracksResult | null> {
      const url = `${this.baseUrl}/rotor/station/${pathSegment(station)}/tracks`;
      const params: Record<string, string | number> = {};
      if (queue !== undefined && queue !== '' && queue !== 0) {
        params['queue'] = queue;
      } else if (settings2) {
        params['settings2'] = String(true);
      }
      const result = await this.request.get(url, params);
      return StationTracksResult.deJson(result, this as unknown as Client);
    }

    /**
     * Send listening feedback for a station.
     *
     * @param station - Station id in `type:tag` form (for example `user:onyourwave`).
     * @param type - The kind of feedback.
     * @param options - Optional feedback fields.
     * @param options.timestamp - Event time: ISO string, Date, or Unix time (numbers below 1e11 are seconds, larger are milliseconds). Defaults to now (ISO).
     * @param options.from - Where playback started (for example `mobile-radio-user-123`).
     * @param options.batchId - Id of the track batch the event refers to (`batch-id` query parameter).
     * @param options.totalPlayedSeconds - Seconds of the track played before the event (omitted when `0`).
     * @param options.trackId - Id of the track the event refers to (omitted when empty or `0`).
     * @param options.streamId - Generative stream id (`streamId` query parameter).
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationFeedback(
      station: string,
      type: RotorFeedbackType | string,
      options: {
        timestamp?: FeedbackTimestamp;
        from?: string;
        batchId?: string;
        totalPlayedSeconds?: number;
        trackId?: string | number;
        streamId?: string;
      } = {},
    ): Promise<boolean> {
      const params: Params = {};
      if (options.batchId) {
        params['batch-id'] = options.batchId;
      }
      if (options.streamId) {
        params['streamId'] = options.streamId;
      }
      const data: { [k: string]: JsonInput } = { type, timestamp: timestampOrNow(options.timestamp) };
      if (options.trackId !== undefined && options.trackId !== '' && options.trackId !== 0) {
        data['trackId'] = options.trackId;
      }
      if (options.from) {
        data['from'] = options.from;
      }
      if (options.totalPlayedSeconds !== undefined && options.totalPlayedSeconds !== 0) {
        data['totalPlayedSeconds'] = options.totalPlayedSeconds;
      }
      const result = await this.request.send('POST', `${this.baseUrl}/rotor/station/${pathSegment(station)}/feedback`, {
        params,
        json: data,
      });
      return result === 'ok';
    }

    /**
     * Shortcut for `rotorStationFeedback(station, 'radioStarted', …)`.
     *
     * @param station - Station id.
     * @param from - Where playback started.
     * @param batchId - Track batch id.
     * @param timestamp - Event time: ISO string, Date, or Unix time (numbers below 1e11 are seconds, larger are milliseconds). Defaults to now.
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackRadioStarted(
      station: string,
      from: string,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorStationFeedback(station, 'radioStarted', { from, batchId, timestamp });
    }

    /**
     * Shortcut for `rotorStationFeedback(station, 'trackStarted', …)`.
     *
     * @param station - Station id.
     * @param trackId - The track that started playing.
     * @param batchId - Track batch id.
     * @param timestamp - Event time: ISO string, Date, or Unix time (numbers below 1e11 are seconds, larger are milliseconds). Defaults to now.
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackTrackStarted(
      station: string,
      trackId: string | number,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorStationFeedback(station, 'trackStarted', { trackId, batchId, timestamp });
    }

    /**
     * Shortcut for `rotorStationFeedback(station, 'trackFinished', …)`.
     *
     * @param station - Station id.
     * @param trackId - The track that finished.
     * @param totalPlayedSeconds - Seconds played before finishing.
     * @param batchId - Track batch id.
     * @param timestamp - Event time: ISO string, Date, or Unix time (numbers below 1e11 are seconds, larger are milliseconds). Defaults to now.
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackTrackFinished(
      station: string,
      trackId: string | number,
      totalPlayedSeconds: number,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorStationFeedback(station, 'trackFinished', {
        trackId,
        totalPlayedSeconds,
        batchId,
        timestamp,
      });
    }

    /**
     * Shortcut for `rotorStationFeedback(station, 'skip', …)`.
     *
     * @param station - Station id.
     * @param trackId - The track that was skipped.
     * @param totalPlayedSeconds - Seconds played before skipping.
     * @param batchId - Track batch id.
     * @param timestamp - Event time: ISO string, Date, or Unix time (numbers below 1e11 are seconds, larger are milliseconds). Defaults to now.
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackSkip(
      station: string,
      trackId: string | number,
      totalPlayedSeconds: number,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorStationFeedback(station, 'skip', { trackId, totalPlayedSeconds, batchId, timestamp });
    }

    /**
     * Change the settings of a station.
     *
     * @param station - Station id.
     * @param moodEnergy - The desired mood/energy.
     * @param diversity - The desired track diversity.
     * @param language - The desired language. Defaults to `'not-russian'`.
     * @param type - The station type. Defaults to `'rotor'`.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     * @remarks The method name keeps the historical "2" suffix used across
     * yandex-music client libraries even though the backend endpoint it calls is
     * `/settings3` — renaming it would be a breaking change for no functional gain.
     * The settings are sent as a JSON body.
     */
    async rotorStationSettings2(
      station: string,
      moodEnergy: RotorMoodEnergy,
      diversity: RotorDiversity,
      language: RotorLanguage = 'not-russian',
      type: RotorStationType = 'rotor',
    ): Promise<boolean> {
      const url = `${this.baseUrl}/rotor/station/${pathSegment(station)}/settings3`;
      const data: { [k: string]: JsonInput } = { moodEnergy, diversity, type };
      if (language) {
        data['language'] = language;
      }
      const result = await this.request.postJson(url, data);
      return result === 'ok';
    }

    /**
     * Fetch the "My Wave" default station and personalization options.
     *
     * @param seeds - Wave seeds (for example `user:onyourwave`); arrays are comma-joined.
     * @returns The wave settings, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorWaveSettings(seeds?: string | string[]): Promise<WaveSettings | null> {
      const params: Params = {};
      if (seeds !== undefined && seeds.length > 0) {
        params['seeds'] = typeof seeds === 'string' ? seeds : seeds.join(',');
      }
      const result = await this.request.get(`${this.baseUrl}/rotor/wave/settings`, params);
      return WaveSettings.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the "My Wave" station the user last listened to.
     *
     * @returns The wave, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorWaveLast(): Promise<WaveInfo | null> {
      const result = await this.request.get(`${this.baseUrl}/rotor/wave/last`);
      return WaveInfo.deJson(result, this as unknown as Client);
    }

    /**
     * Reset the "My Wave" last-listened station back to the default.
     *
     * @returns Whether the operation succeeded (`result` is `'ok'`).
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorWaveLastReset(): Promise<boolean> {
      const result = await this.request.post(`${this.baseUrl}/rotor/wave/last/reset`);
      return result === 'ok' || (isJsonObject(result) && result['result'] === 'ok');
    }

    /**
     * Start a new rotor listening session (`POST /rotor/session/new`).
     *
     * @param seeds - Session seeds (for example `user:onyourwave`, `genre:rock`, `track:123`).
     * @param options - Optional session settings.
     * @returns The session, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    rotorSessionNew(seeds: string | string[], options?: RotorSessionOptions): Promise<RotorSession | null>;
    /**
     * @deprecated Pass seeds: `rotorSessionNew('user:onyourwave', { includeWaveModel })`.
     * The legacy form now POSTs `{ seeds: ['user:onyourwave'], includeWaveModel }`.
     */
    rotorSessionNew(includeWaveModel?: boolean): Promise<RotorSession | null>;
    async rotorSessionNew(
      seedsOrFlag?: string | string[] | boolean,
      options: RotorSessionOptions = {},
    ): Promise<RotorSession | null> {
      let body: { [k: string]: JsonInput };
      if (typeof seedsOrFlag === 'string' || Array.isArray(seedsOrFlag)) {
        body = { ...sessionBody(options), seeds: typeof seedsOrFlag === 'string' ? [seedsOrFlag] : seedsOrFlag };
      } else {
        body = { seeds: ['user:onyourwave'], includeWaveModel: seedsOrFlag ?? true };
      }
      const result = await this.request.postJson(`${this.baseUrl}/rotor/session/new`, body);
      return RotorSession.deJson(result, this as unknown as Client);
    }

    /**
     * Start a new combined rotor session (tracks and clips) and fetch its first batch.
     *
     * @param options - Optional supported types, played queue, child mode and explicit flag.
     * @returns The session and its first batch, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorCombinedSessionNew(
      options: {
        supportedTypes?: string[];
        queue?: CombinedSessionQueueInput[];
        child?: boolean;
        allowExplicit?: boolean;
      } = {},
    ): Promise<CombinedSession | null> {
      const result = await this.request.postJson(`${this.baseUrl}/rotor/combined/session/new`, {
        supportedTypes: options.supportedTypes,
        queue: options.queue === undefined ? undefined : queueBody(options.queue),
        child: options.child,
        allowExplicit: options.allowExplicit,
      });
      return CombinedSession.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the landing of the combined rotor session (for example the clips time).
     *
     * @param options - Optional supported types, child mode and explicit flag.
     * @returns The landing, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorCombinedSessionLanding(
      options: { supportedTypes?: string[]; child?: boolean; allowExplicit?: boolean } = {},
    ): Promise<CombinedSessionLanding | null> {
      const result = await this.request.postJson(`${this.baseUrl}/rotor/combined/session/landing`, {
        supportedTypes: options.supportedTypes,
        child: options.child,
        allowExplicit: options.allowExplicit,
      });
      return CombinedSessionLanding.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the offline recommendation sources.
     *
     * @returns The sources, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorGetOfflineRecommender(): Promise<OfflineRecommender | null> {
      const result = await this.request.post(`${this.baseUrl}/rotor/get-offline-recommender`);
      return OfflineRecommender.deJson(result, this as unknown as Client);
    }

    /**
     * Send feedback for several rotor sessions at once (`POST /rotor/sessions/feedbacks`, JSON body).
     *
     * @param sessions - Feedback entries per session.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    rotorSessionsFeedbacks(sessions: SessionFeedbacksInput[]): Promise<boolean>;
    /** @deprecated Pass an array of {@link SessionFeedbacksInput}; this form posts form-encoded `data`. */
    rotorSessionsFeedbacks(data?: Params): Promise<boolean>;
    async rotorSessionsFeedbacks(arg: SessionFeedbacksInput[] | Params = {}): Promise<boolean> {
      const url = `${this.baseUrl}/rotor/sessions/feedbacks`;
      if (Array.isArray(arg)) {
        const result = await this.request.postJson(url, {
          sessions: arg.map((session) => ({
            sessionId: session.sessionId,
            feedbacks: session.feedbacks.map(feedbackBody),
          })),
        });
        return result === 'ok' || isJsonObject(result);
      }
      const result = await this.request.post(url, arg);
      return result === 'ok' || isJsonObject(result);
    }

    /**
     * Fetch the next track batch for a rotor session.
     *
     * @param sessionId - The session id, from {@link rotorSessionNew}.
     * @param options - Already received `queue` and `feedbacks` to send with the request.
     * @returns The track batch, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorSessionTracks(
      sessionId: string,
      options: { queue?: string[]; feedbacks?: SessionFeedbackInput[] } = {},
    ): Promise<RotorSessionTracks | null> {
      const body: { [k: string]: JsonInput } = { queue: options.queue ?? [] };
      if (options.feedbacks !== undefined && options.feedbacks.length > 0) {
        body['feedbacks'] = options.feedbacks.map(feedbackBody);
      }
      const result = await this.request.postJson(`${this.baseUrl}/rotor/session/${pathSegment(sessionId)}/tracks`, body);
      return RotorSessionTracks.deJson(result, this as unknown as Client);
    }

    /**
     * Clone a rotor session and fetch its first track batch.
     *
     * @param sessionId - The session id to clone, from {@link rotorSessionNew}.
     * @param options - Optional session settings.
     * @returns The cloned session and its first batch, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorSessionClone(sessionId: string, options: RotorSessionOptions = {}): Promise<ClonedSession | null> {
      const result = await this.request.postJson(
        `${this.baseUrl}/rotor/session/${pathSegment(sessionId)}/clone`,
        sessionBody(options),
      );
      return ClonedSession.deJson(result, this as unknown as Client);
    }

    /**
     * Send one feedback event to a rotor session.
     *
     * @param sessionId - The session id.
     * @param event - The event.
     * @param batchId - Track batch id.
     * @param from - Where playback started.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorSessionFeedback(
      sessionId: string,
      event: SessionEventInput,
      batchId?: string,
      from?: string,
    ): Promise<boolean> {
      const result = await this.request.postJson(
        `${this.baseUrl}/rotor/session/${pathSegment(sessionId)}/feedback`,
        feedbackBody({ event, batchId, from }),
      );
      return isJsonObject(result);
    }

    /**
     * Session feedback shortcut: radio started.
     *
     * @param sessionId - The session id.
     * @param from - Where playback started.
     * @param batchId - Track batch id.
     * @param timestamp - Event time. Defaults to now (ISO).
     * @returns Whether the operation succeeded.
     */
    rotorSessionFeedbackRadioStarted(
      sessionId: string,
      from?: string,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorSessionFeedback(sessionId, { type: 'radioStarted', timestamp }, batchId, from);
    }

    /**
     * Session feedback shortcut: track started.
     *
     * @param sessionId - The session id.
     * @param trackId - The track that started playing.
     * @param batchId - Track batch id.
     * @param timestamp - Event time. Defaults to now (ISO).
     * @returns Whether the operation succeeded.
     */
    rotorSessionFeedbackTrackStarted(
      sessionId: string,
      trackId: string | number,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorSessionFeedback(sessionId, { type: 'trackStarted', timestamp, trackId }, batchId);
    }

    /**
     * Session feedback shortcut: track finished.
     *
     * @param sessionId - The session id.
     * @param trackId - The track that finished.
     * @param totalPlayedSeconds - Seconds played.
     * @param batchId - Track batch id.
     * @param timestamp - Event time. Defaults to now (ISO).
     * @returns Whether the operation succeeded.
     */
    rotorSessionFeedbackTrackFinished(
      sessionId: string,
      trackId: string | number,
      totalPlayedSeconds: number,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorSessionFeedback(
        sessionId,
        { type: 'trackFinished', timestamp, trackId, totalPlayedSeconds },
        batchId,
      );
    }

    /**
     * Session feedback shortcut: track skipped.
     *
     * @param sessionId - The session id.
     * @param trackId - The track that was skipped.
     * @param totalPlayedSeconds - Seconds played before skipping.
     * @param batchId - Track batch id.
     * @param timestamp - Event time. Defaults to now (ISO).
     * @returns Whether the operation succeeded.
     */
    rotorSessionFeedbackSkip(
      sessionId: string,
      trackId: string | number,
      totalPlayedSeconds: number,
      batchId?: string,
      timestamp?: FeedbackTimestamp,
    ): Promise<boolean> {
      return this.rotorSessionFeedback(sessionId, { type: 'skip', timestamp, trackId, totalPlayedSeconds }, batchId);
    }

    /**
     * Send several feedback entries to one rotor session in one request.
     *
     * @param sessionId - The session id.
     * @param feedbacks - The entries.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorSessionFeedbacks(sessionId: string, feedbacks: SessionFeedbackInput[]): Promise<boolean> {
      const result = await this.request.postJson(`${this.baseUrl}/rotor/session/${pathSegment(sessionId)}/feedbacks`, {
        feedbacks: feedbacks.map(feedbackBody),
      });
      return isJsonObject(result);
    }

    /**
     * Fetch the next track batch for a combined rotor session.
     *
     * @param sessionId - The session id, from {@link rotorCombinedSessionNew}.
     * @param queue - Already received items.
     * @returns The next batch, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorCombinedSessionNext(
      sessionId: string,
      queue: CombinedSessionQueueInput[] = [],
    ): Promise<CombinedSession | null> {
      const result = await this.request.postJson(`${this.baseUrl}/rotor/combined/session/${pathSegment(sessionId)}/next`, {
        queue: queueBody(queue),
      });
      return CombinedSession.deJson(result, this as unknown as Client);
    }
  }

  return RadioMethods;
}
