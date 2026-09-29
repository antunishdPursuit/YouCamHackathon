/**
 * The safety property of the public deployment, asserted rather than assumed.
 *
 * The deployment ships with no API key. These tests say what that guarantees: no live
 * path can be reached, whichever way the three environment flags are set — including the
 * ways a tired person sets them at midnight. A regression here spends real credits from a
 * public URL, so the cases are deliberately unglamorous and exhaustive.
 */

import { describe, expect, it } from 'vitest';
import { loadConfig, liveWasRequestedWithoutKey } from './config.js';

/** A bare environment: nothing set, which is what a fresh host looks like. */
const EMPTY: NodeJS.ProcessEnv = {};

describe('loadConfig — fail closed without a key', () => {
  it('defaults to fixture mode with no live paths', () => {
    const config = loadConfig(EMPTY);

    expect(config.fixtureMode).toBe(true);
    expect(config.liveSkinAnalysis).toBe(false);
    expect(config.liveTryOn).toBe(false);
  });

  it('keeps fixture mode even when fixture mode is explicitly turned off', () => {
    const config = loadConfig({ YINCOL_FIXTURE_MODE: 'false' });

    expect(config.fixtureMode).toBe(true);
    expect(config.liveSkinAnalysis).toBe(false);
    expect(config.liveTryOn).toBe(false);
  });

  it('ignores both live increment flags', () => {
    const config = loadConfig({
      YINCOL_LIVE_SKIN_ANALYSIS: 'true',
      YINCOL_LIVE_TRY_ON: 'true',
    });

    expect(config.liveSkinAnalysis).toBe(false);
    expect(config.liveTryOn).toBe(false);
  });

  it('ignores every flag at once — the worst-case misconfiguration', () => {
    const config = loadConfig({
      YINCOL_FIXTURE_MODE: 'false',
      YINCOL_LIVE_SKIN_ANALYSIS: 'true',
      YINCOL_LIVE_TRY_ON: 'true',
    });

    expect(config.fixtureMode).toBe(true);
    expect(config.liveSkinAnalysis).toBe(false);
    expect(config.liveTryOn).toBe(false);
  });

  it('treats a whitespace-only key as no key', () => {
    const config = loadConfig({ YINCOL_API_KEY: '   ', YINCOL_FIXTURE_MODE: 'false' });

    expect(config.apiKey).toBe('');
    expect(config.fixtureMode).toBe(true);
    expect(config.liveTryOn).toBe(false);
  });
});

describe('loadConfig — with a key present', () => {
  const KEY = { YINCOL_API_KEY: 'test-key' };

  it('still defaults to fixture mode', () => {
    const config = loadConfig(KEY);

    expect(config.fixtureMode).toBe(true);
    expect(config.liveSkinAnalysis).toBe(false);
    expect(config.liveTryOn).toBe(false);
  });

  it('honours an explicit opt-in increment while staying fixture-backed elsewhere', () => {
    const config = loadConfig({ ...KEY, YINCOL_LIVE_SKIN_ANALYSIS: 'true' });

    expect(config.fixtureMode).toBe(true);
    expect(config.liveSkinAnalysis).toBe(true);
    expect(config.liveTryOn).toBe(false);
  });

  it('turns both increments on when fixture mode is explicitly off', () => {
    const config = loadConfig({ ...KEY, YINCOL_FIXTURE_MODE: 'false' });

    expect(config.fixtureMode).toBe(false);
    expect(config.liveSkinAnalysis).toBe(true);
    expect(config.liveTryOn).toBe(true);
  });

  it('leaves fixture mode on for anything that is not exactly "false"', () => {
    // A typo must not start spending credits.
    for (const value of ['true', 'TRUE', 'no', '0', 'off', 'False ', 'fasle', '']) {
      expect(loadConfig({ ...KEY, YINCOL_FIXTURE_MODE: value }).fixtureMode, value).toBe(true);
    }
  });

  it('accepts "false" in any case, since only the exact word is meant to work', () => {
    expect(loadConfig({ ...KEY, YINCOL_FIXTURE_MODE: 'false' }).fixtureMode).toBe(false);
    expect(loadConfig({ ...KEY, YINCOL_FIXTURE_MODE: 'FALSE' }).fixtureMode).toBe(false);
  });

  it('honours an opt-in flag in any case', () => {
    expect(loadConfig({ ...KEY, YINCOL_LIVE_SKIN_ANALYSIS: 'TRUE' }).liveSkinAnalysis).toBe(true);
    expect(loadConfig({ ...KEY, YINCOL_LIVE_TRY_ON: 'TRUE' }).liveTryOn).toBe(true);
  });

  it('strips trailing slashes so path joining never doubles up', () => {
    expect(loadConfig({ YINCOL_API_BASE_URL: 'https://example.com//' }).baseUrl).toBe(
      'https://example.com',
    );
  });

  it('trims the key rather than sending a padded Authorization header', () => {
    expect(loadConfig({ YINCOL_API_KEY: '  test-key\n' }).apiKey).toBe('test-key');
  });
});

describe('loadConfig — simulated states', () => {
  it('ignores a simulated state in live mode', () => {
    const config = loadConfig({
      YINCOL_API_KEY: 'test-key',
      YINCOL_FIXTURE_MODE: 'false',
      YINCOL_SIMULATE: 'noFace',
    });

    expect(config.simulate).toBe('none');
  });

  it('keeps a simulated state in fixture mode', () => {
    expect(loadConfig({ YINCOL_SIMULATE: 'noFace' }).simulate).toBe('noFace');
  });

  it('rejects an unknown simulated state', () => {
    expect(loadConfig({ YINCOL_SIMULATE: 'notAState' }).simulate).toBe('none');
  });
});

describe('loadConfig — budget', () => {
  it('defaults the KV URL to empty and the caps to the README-documented values', () => {
    const config = loadConfig(EMPTY);
    expect(config.kvUrl).toBe('');
    expect(config.siteDailyUnitCap).toBe(100);
    expect(config.browserWindowUnitCap).toBe(40);
  });

  it('trims a configured KV URL', () => {
    expect(loadConfig({ YINCOL_KV_URL: '  redis://example:6379  ' }).kvUrl).toBe('redis://example:6379');
  });

  it('honours configured caps', () => {
    const config = loadConfig({ YINCOL_SITE_DAILY_UNIT_CAP: '50', YINCOL_BROWSER_WINDOW_UNIT_CAP: '15' });
    expect(config.siteDailyUnitCap).toBe(50);
    expect(config.browserWindowUnitCap).toBe(15);
  });

  it('falls back to the default for a malformed or non-positive cap, never to 0 or NaN', () => {
    for (const value of ['not-a-number', '0', '-5', '']) {
      expect(loadConfig({ YINCOL_SITE_DAILY_UNIT_CAP: value }).siteDailyUnitCap, value).toBe(100);
      expect(loadConfig({ YINCOL_BROWSER_WINDOW_UNIT_CAP: value }).browserWindowUnitCap, value).toBe(40);
    }
  });
});

describe('liveWasRequestedWithoutKey', () => {
  it('is false when nothing live was asked for', () => {
    expect(liveWasRequestedWithoutKey(EMPTY)).toBe(false);
  });

  it('is false once a key is present, whatever the flags say', () => {
    expect(
      liveWasRequestedWithoutKey({ YINCOL_API_KEY: 'test-key', YINCOL_FIXTURE_MODE: 'false' }),
    ).toBe(false);
  });

  it.each([
    ['fixture mode off', { YINCOL_FIXTURE_MODE: 'false' }],
    ['live skin analysis', { YINCOL_LIVE_SKIN_ANALYSIS: 'true' }],
    ['live try-on', { YINCOL_LIVE_TRY_ON: 'true' }],
  ])('reports %s asked for without a key', (_label, env) => {
    expect(liveWasRequestedWithoutKey(env)).toBe(true);
  });
});
