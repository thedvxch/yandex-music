/**
 * Playback-queue client methods.
 *
 * @packageDocumentation
 */
import { ClientBase } from '../clientBase.js';
import { deList, isJsonObject } from '../base.js';
import { Queue, QueueItem } from '../models/queue/queue.js';
import type { AbstractConstructor } from './mixin.js';
import type { Client } from '../client.js';

/** Header carrying the device descriptor for queue requests. */
const DEVICE_HEADER = 'X-Yandex-Music-Device';

/**
 * Adds playback-queue endpoints to the client.
 *
 * @remarks
 * Queues are device-scoped: only the device that created a queue may update it.
 *
 * @typeParam TBase - The base constructor being extended.
 * @param Base - The base class (ultimately {@link ClientBase}).
 * @returns A subclass with queue methods.
 */
export function QueueMixin<TBase extends AbstractConstructor<ClientBase>>(Base: TBase) {
  abstract class QueueMethods extends Base {
    /**
     * Fetch the list of the user's queues.
     *
     * @param device - Device descriptor. Defaults to the client device.
     * @returns The queue summaries.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async queuesList(device?: string): Promise<QueueItem[]> {
      this.request.headers[DEVICE_HEADER] = device ?? this.device;
      const result = await this.request.get(`${this.baseUrl}/queues`);
      const queues = isJsonObject(result) ? result['queues'] : result;
      return deList(QueueItem.deJson, queues, this as unknown as Client);
    }

    /**
     * Fetch a single queue by id.
     *
     * @param queueId - The queue id.
     * @returns The queue, or `null`.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async queue(queueId: string): Promise<Queue | null> {
      const result = await this.request.get(`${this.baseUrl}/queues/${queueId}`);
      return Queue.deJson(result, this as unknown as Client);
    }

    /**
     * Update the current playing position of a queue.
     *
     * @param queueId - The queue id.
     * @param currentIndex - The new current track index.
     * @param device - Device descriptor (must match the queue's creator). Defaults to the client device.
     * @returns Whether the update succeeded.
     * @throws {YandexMusicError} On any transport or API error.
     */
    async queueUpdatePosition(queueId: string, currentIndex: number, device?: string): Promise<boolean> {
      this.request.headers[DEVICE_HEADER] = device ?? this.device;
      const url = `${this.baseUrl}/queues/${queueId}/update-position?currentIndex=${currentIndex}`;
      const result = await this.request.post(url, { isInteractive: String(false) });
      return isJsonObject(result) && result['status'] === 'ok';
    }
  }

  return QueueMethods;
}
