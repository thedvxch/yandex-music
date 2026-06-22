/**
 * Builder for the `diff` payload used by the playlist-change endpoint.
 *
 * @packageDocumentation
 */

/** A track reference used when inserting into a playlist. */
export interface DiffTrack {
  /** Track id. */
  id: string | number;
  /** Album id the track belongs to. */
  albumId: string | number;
}

/** A single insert or delete operation in a playlist diff. */
type Operation =
  | { op: 'insert'; at: number; tracks: Array<{ id: string | number; albumId: string | number }> }
  | { op: 'delete'; from: number; to: number };

/**
 * Accumulates playlist edit operations and serializes them to the `diff`
 * string expected by `users/{uid}/playlists/{kind}/change`.
 */
export class Difference {
  private readonly operations: Operation[] = [];

  /**
   * Append a delete operation removing tracks in the half-open range `[from, to)`.
   *
   * @param from - Start index (inclusive).
   * @param to - End index (exclusive).
   * @returns This builder, for chaining.
   */
  addDelete(from: number, to: number): this {
    this.operations.push({ op: 'delete', from, to });
    return this;
  }

  /**
   * Append an insert operation placing tracks at the given index.
   *
   * @param at - Insertion index.
   * @param tracks - A single track reference or a list of them.
   * @returns This builder, for chaining.
   */
  addInsert(at: number, tracks: DiffTrack | DiffTrack[]): this {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    this.operations.push({
      op: 'insert',
      at,
      tracks: list.map((t) => ({ id: t.id, albumId: t.albumId })),
    });
    return this;
  }

  /** Serialize the accumulated operations to a JSON string. */
  toJson(): string {
    return JSON.stringify(this.operations);
  }
}
