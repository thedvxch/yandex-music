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
  }

  return RadioMethods;
}
