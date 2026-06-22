/**
 * Account-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Status } from '../models/account/account.js';
import {
  Experiments,
  ExperimentsDetails,
  PermissionAlerts,
  PromoCodeStatus,
  Settings,
  UserSettings,
} from '../models/account/settings.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/**
 * Adds account endpoints to the client.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with account methods.
 */
export function AccountMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class AccountMethods extends Base {
    /**
     * Initialize the client by loading account status.
     *
     * Populates {@link ClientBase.me} and {@link ClientBase.accountUid}, which a
     * number of other endpoints rely on. Call this once after construction.
     *
     * @returns The same client, for chaining.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async init(): Promise<Client> {
      const status = await this.accountStatus();
      this.me = status ?? undefined;
      if (this.me?.account?.uid != null) {
        this.accountUid = this.me.account.uid;
      }
      return this as unknown as Client;
    }

    /**
     * Fetch the status of the authenticated account.
     *
     * @returns The account status, or `null` when the token is invalid.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async accountStatus(): Promise<Status | null> {
      const url = `${this.baseUrl}/account/status`;
      const result = await this.request.get(url);
      return Status.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the current user's settings.
     *
     * @returns The user settings, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async accountSettings(): Promise<UserSettings | null> {
      const result = await this.request.get(`${this.baseUrl}/account/settings`);
      return UserSettings.deJson(result, this as unknown as Client);
    }

    /**
     * Change one or many of the current user's settings.
     *
     * @param paramOrData - A single setting name, or a map of setting names to values.
     * @param value - The value, when `paramOrData` is a single setting name.
     * @returns The updated user settings, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async accountSettingsSet(
      paramOrData: string | Record<string, string | number | boolean>,
      value?: string | number | boolean,
    ): Promise<UserSettings | null> {
      const data =
        typeof paramOrData === 'string' ? { [paramOrData]: String(value) } : paramOrData;
      const result = await this.request.post(`${this.baseUrl}/account/settings`, data);
      return UserSettings.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch purchase offers and payment configuration.
     *
     * @returns The settings, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async settings(): Promise<Settings | null> {
      const result = await this.request.get(`${this.baseUrl}/settings`);
      return Settings.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch permission alert messages.
     *
     * @returns The alerts, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async permissionAlerts(): Promise<PermissionAlerts | null> {
      const result = await this.request.get(`${this.baseUrl}/permission-alerts`);
      return PermissionAlerts.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch the account's experiment buckets.
     *
     * @returns The experiments, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async accountExperiments(): Promise<Experiments | null> {
      const result = await this.request.get(`${this.baseUrl}/account/experiments`);
      return Experiments.deJson(result, this as unknown as Client);
    }

    /**
     * Fetch detailed experiment configuration for the account.
     *
     * @returns The detailed experiments, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async accountExperimentsDetails(): Promise<ExperimentsDetails | null> {
      const result = await this.request.get(`${this.baseUrl}/account/experiments/details`);
      return ExperimentsDetails.deJson(result, this as unknown as Client);
    }

    /**
     * Activate a promo code.
     *
     * @param code - The promo code.
     * @param language - Response language. Defaults to the client language.
     * @returns The activation result, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async consumePromoCode(code: string, language?: string): Promise<PromoCodeStatus | null> {
      const result = await this.request.post(`${this.baseUrl}/account/consume-promo-code`, {
        code,
        language: language ?? this.language,
      });
      return PromoCodeStatus.deJson(result, this as unknown as Client);
    }
  }

  return AccountMethods;
}
