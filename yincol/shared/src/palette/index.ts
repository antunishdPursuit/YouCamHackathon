/**
 * The palette engine — pure, deterministic, and openable in front of judges.
 *
 * Nothing under `palette/` imports a framework or performs I/O. If you ever need to
 * add `fetch` here, the thing you are adding belongs in `server/` instead.
 */

export * from './color.js';
export * from './axes.js';
export * from './ruleTable.js';
export * from './shadeNames.js';
export * from './engine.js';
export * from './fit.js';
