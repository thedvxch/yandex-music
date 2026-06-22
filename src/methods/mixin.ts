/**
 * Mixin plumbing.
 *
 * The client is assembled by layering method groups ("mixins") on top of
 * {@link ClientBase}. Each mixin is a function that takes a base constructor and
 * returns a subclass adding a group of related API methods, mirroring the flat
 * method surface of the original library (`client.tracks(...)`, `client.search(...)`).
 *
 * @packageDocumentation
 */

/**
 * Constructor type accepted by mixins.
 *
 * Allows abstract bases (such as {@link ClientBase}) to be passed through the
 * mixin chain while still composing into a concrete client class.
 *
 * @typeParam T - The instance type produced.
 */
// `any[]` (not `never[]`) is required so the base constructor signature survives
// composition and `super(options)` type-checks inside the assembled client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AbstractConstructor<T = object> = abstract new (...args: any[]) => T;
