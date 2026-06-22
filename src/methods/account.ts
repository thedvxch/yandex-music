/**
 * Account-related client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { Status } from '../models/account/account.js';
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
  }

  return AccountMethods;
}
