/**
 * @yincol/shared — framework-free domain layer.
 *
 * Nothing in this package imports a framework, an SDK, or `fetch`. Vendor response
 * shapes are translated in the server adapters and never reach here; the front end
 * only ever sees the types exported below.
 *
 * Domain types and the palette engine land in Phase 1.
 */

export const SHARED_PACKAGE_NAME = '@yincol/shared' as const;
