/**
 * Rotor (radio) client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList } from '../base.js';
import { Status } from '../models/account/account.js';
import { Dashboard, StationResult, StationTracksResult } from '../models/rotor/rotor.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';
import type { Params } from '../request.js';

/** Kind of feedback sent to the rotor while listening to a station. */
export type RotorFeedbackType = 'radioStarted' | 'trackStarted' | 'trackFinished' | 'skip';

/** Mood/energy preset accepted by {@link RadioMixin.rotorStationSettings2}. */
export type RotorMoodEnergy = 'fun' | 'active' | 'calm' | 'sad' | 'all';

/** Diversity preset accepted by {@link RadioMixin.rotorStationSettings2}. */
export type RotorDiversity = 'favorite' | 'popular' | 'discover' | 'default';

/** Language preset accepted by {@link RadioMixin.rotorStationSettings2}. */
export type RotorLanguage = 'not-russian' | 'russian' | 'any';

/** Station type accepted by {@link RadioMixin.rotorStationSettings2}. */
export type RotorStationType = 'rotor' | 'generative';

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
      const result = await this.request.get(`${this.baseUrl}/rotor/station/${station}/info`);
      return deList(StationResult.deJson, result, this as unknown as Client);
    }

    /**
     * Fetch the next batch of tracks from a station.
     *
     * @param station - Station id in `type:tag` form.
     * @param settings2 - Use the second settings set (as official clients do). Defaults to `true`.
     * @param queue - Id of the track that just played, to inform the next batch.
     * @returns The track batch, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationTracks(
      station: string,
      settings2 = true,
      queue?: string | number,
    ): Promise<StationTracksResult | null> {
      const url = `${this.baseUrl}/rotor/station/${station}/tracks`;
      const params: Record<string, string | number> = {};
      if (queue !== undefined) {
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
     * @param options.timestamp - Event time (seconds since the epoch). Defaults to now.
     * @param options.from - Where playback started (for example `mobile-radio-user-123`).
     * @param options.batchId - Id of the track batch the event refers to.
     * @param options.totalPlayedSeconds - Seconds of the track played before the event.
     * @param options.trackId - Id of the track the event refers to.
     * @returns Whether the operation succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async rotorStationFeedback(
      station: string,
      type: RotorFeedbackType,
      options: {
        timestamp?: number;
        from?: string;
        batchId?: string;
        totalPlayedSeconds?: number;
        trackId?: string | number;
      } = {},
    ): Promise<boolean> {
      let url = `${this.baseUrl}/rotor/station/${station}/feedback`;
      if (options.batchId) {
        url += `?${new URLSearchParams({ 'batch-id': options.batchId }).toString()}`;
      }
      const data: Params = { type, timestamp: options.timestamp ?? Date.now() / 1000 };
      if (options.trackId !== undefined) {
        data['trackId'] = options.trackId;
      }
      if (options.from) {
        data['from'] = options.from;
      }
      if (options.totalPlayedSeconds !== undefined) {
        data['totalPlayedSeconds'] = options.totalPlayedSeconds;
      }
      const result = await this.request.post(url, data);
      return result === 'ok';
    }

    /**
     * Shortcut for `rotorStationFeedback(station, 'radioStarted', …)`.
     *
     * @param station - Station id.
     * @param from - Where playback started.
     * @param batchId - Track batch id.
     * @param timestamp - Event time (seconds since the epoch).
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackRadioStarted(
      station: string,
      from: string,
      batchId?: string,
      timestamp?: number,
    ): Promise<boolean> {
      return this.rotorStationFeedback(station, 'radioStarted', { from, batchId, timestamp });
    }

    /**
     * Shortcut for `rotorStationFeedback(station, 'trackStarted', …)`.
     *
     * @param station - Station id.
     * @param trackId - The track that started playing.
     * @param batchId - Track batch id.
     * @param timestamp - Event time (seconds since the epoch).
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackTrackStarted(
      station: string,
      trackId: string | number,
      batchId?: string,
      timestamp?: number,
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
     * @param timestamp - Event time (seconds since the epoch).
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackTrackFinished(
      station: string,
      trackId: string | number,
      totalPlayedSeconds: number,
      batchId?: string,
      timestamp?: number,
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
     * @param timestamp - Event time (seconds since the epoch).
     * @returns Whether the operation succeeded.
     */
    rotorStationFeedbackSkip(
      station: string,
      trackId: string | number,
      totalPlayedSeconds: number,
      batchId?: string,
      timestamp?: number,
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
     */
    async rotorStationSettings2(
      station: string,
      moodEnergy: RotorMoodEnergy,
      diversity: RotorDiversity,
      language: RotorLanguage = 'not-russian',
      type: RotorStationType = 'rotor',
    ): Promise<boolean> {
      const url = `${this.baseUrl}/rotor/station/${station}/settings3`;
      const data: Params = { moodEnergy, diversity, type };
      if (language) {
        data['language'] = language;
      }
      const result = await this.request.post(url, data);
      return result === 'ok';
    }
  }

  return RadioMethods;
}
