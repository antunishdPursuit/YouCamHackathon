import { describe, expect, it } from 'vitest';
import { adaptColorTone, ColorToneShapeError } from './facialColorTone.js';
import { adaptSkinAnalysis } from './skinAnalysis.js';
import { adaptTryOn, tryOnFailure } from './tryOn.js';
import { extractResultUrls } from '../taskRunner.js';
import { loadConfig } from '../config.js';

describe('config', () => {
  it('defaults to fixture mode when nothing is set', () => {
    expect(loadConfig({}).fixtureMode).toBe(true);
  });

  it('leaves fixture mode ON for anything but the exact string "false"', () => {
    // A typo must never silently start spending credits.
    for (const value of ['true', 'TRUE', 'no', '0', 'False ', 'fasle', '']) {
      expect(loadConfig({ YINCOL_FIXTURE_MODE: value }).fixtureMode, value).toBe(true);
    }
    expect(loadConfig({ YINCOL_FIXTURE_MODE: 'false' }).fixtureMode).toBe(false);
    expect(loadConfig({ YINCOL_FIXTURE_MODE: 'FALSE' }).fixtureMode).toBe(false);
  });

  it('keeps live Skin Analysis opt-in while the demo remains on fixtures', () => {
    expect(loadConfig({}).liveSkinAnalysis).toBe(false);
    expect(loadConfig({ YINCOL_LIVE_SKIN_ANALYSIS: 'true' }).liveSkinAnalysis).toBe(true);
    expect(loadConfig({ YINCOL_FIXTURE_MODE: 'false' }).liveSkinAnalysis).toBe(true);
    expect(loadConfig({ YINCOL_LIVE_SKIN_ANALYSIS: 'TRUE' }).liveSkinAnalysis).toBe(true);
  });

  it('strips trailing slashes so path joining never doubles up', () => {
    expect(loadConfig({ YINCOL_API_BASE_URL: 'https://example.com//' }).baseUrl).toBe(
      'https://example.com',
    );
  });
});

describe('facial colour tone adapter', () => {
  it('reads hex-encoded colours', () => {
    const outcome = adaptColorTone({
      result: { skin_color: '#e0b492', hair_color: '#3b2a22', lip_color: '#bc7a72' },
    });
    expect(outcome.reading.skin.l).toBeGreaterThan(70);
    expect(outcome.reading.hair.l).toBeLessThan(30);
    expect(outcome.reading.lip).toBeDefined();
  });

  it('reads sRGB triples', () => {
    const outcome = adaptColorTone({
      result: { skin: { r: 224, g: 180, b: 146 }, hair: { r: 59, g: 42, b: 34 } },
    });
    expect(outcome.reading.skin.l).toBeGreaterThan(70);
  });

  it('reads L*a*b* triples unchanged', () => {
    const outcome = adaptColorTone({
      data: { skinTone: { l: 62, a: 12, b: 20 }, hairColor: { l: 24, a: 4, b: 6 } },
    });
    expect(outcome.reading.skin).toEqual({ l: 62, a: 12, b: 20 });
  });

  it('finds colours nested a level down', () => {
    const outcome = adaptColorTone({
      result: { colors: { skin_color: { hex: '#e0b492' }, hair_color: { hex: '#3b2a22' } } },
    });
    expect(outcome.reading.skin.l).toBeGreaterThan(70);
  });

  it('lets an API-supplied undertone through so it can override the classifier', () => {
    const outcome = adaptColorTone({
      result: { skin_color: '#e0b492', hair_color: '#3b2a22', undertone: 'Cool' },
    });
    expect(outcome.undertone).toBe('cool');
  });

  it('ignores an undertone value it does not recognise', () => {
    const outcome = adaptColorTone({
      result: { skin_color: '#e0b492', hair_color: '#3b2a22', undertone: 'olive' },
    });
    expect(outcome.undertone).toBeUndefined();
  });

  it('refuses to invent a hair colour, because contrast depends on it', () => {
    // Without hair there is no contrast axis, and a guessed contrast would quietly
    // corrupt the number the rule table leans on hardest. Fail loudly instead.
    expect(() => adaptColorTone({ result: { skin_color: '#e0b492' } })).toThrow(
      ColorToneShapeError,
    );
  });

  it('reports the keys it actually received, so the real shape can be written down', () => {
    try {
      adaptColorTone({ result: { unexpected_key: 1, another: 2 } });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ColorToneShapeError).rawKeys).toEqual(['unexpected_key', 'another']);
      expect((error as Error).message).toContain('api-findings.md');
    }
  });
});

describe('skin analysis adapter', () => {
  it('bands scores rather than grading them', () => {
    const appearance = adaptSkinAnalysis({
      result: { moisture: 20, evenness: 55, texture: 88 },
    });
    const bands = Object.fromEntries(appearance.signals.map((s) => [s.id, s.band]));
    expect(bands['hydrationAppearance']).toBe('soft');
    expect(bands['toneEvenness']).toBe('balanced');
    expect(bands['textureAppearance']).toBe('bright');
  });

  it('omits a signal it cannot read rather than inventing one', () => {
    const appearance = adaptSkinAnalysis({ result: { moisture: 50 } });
    expect(appearance.signals).toHaveLength(1);
    expect(appearance.signals[0]!.id).toBe('hydrationAppearance');
  });

  it('reads a score nested under a wrapper object', () => {
    const appearance = adaptSkinAnalysis({ result: { texture: { score: 90 } } });
    expect(appearance.signals[0]!.band).toBe('bright');
  });

  it('reads documented score records inside the output array', () => {
    const appearance = adaptSkinAnalysis({
      status: 200,
      data: {
        error: null,
        results: {
          output: [
            { ui_score: 71, raw_score: 64.9, type: 'texture' },
            { score: 30, type: 'skin_age' },
            { type: 'resize_image', mask_urls: ['https://cdn.example/mask.png'] },
          ],
        },
      },
    });

    expect(appearance.signals.map((signal) => signal.id)).toEqual(['textureAppearance']);
    expect(appearance.signals[0]!.band).toBe('bright');
  });

  it('normalizes the whole-face skin type into finish appearance context', () => {
    const appearance = adaptSkinAnalysis({
      status: 200,
      data: {
        results: {
          output: [
            { type: 'skin_type', region: 'whole', skin_type: 'Oily' },
            { type: 'skin_type', region: 't_zone', skin_type: 'Oily' },
            { type: 'skin_type', region: 'u_zone', skin_type: 'Oily' },
            { score: 0, type: 'all' },
            { score: 30, type: 'skin_age' },
          ],
        },
      },
    });

    expect(appearance.signals).toEqual([
      {
        id: 'finishAppearance',
        label: 'Finish appearance',
        band: 'bright',
        note: 'Light-reflecting colours may echo the natural light in this finish.',
      },
    ]);
    const prose = JSON.stringify(appearance).toLowerCase();
    expect(prose).not.toContain('oily');
    expect(prose).not.toContain('skin_age');
  });

  it('returns no signals at all for an unrecognisable payload', () => {
    expect(adaptSkinAnalysis({ result: { something_else: 'x' } }).signals).toEqual([]);
  });

  it('never emits clinical language, whatever the API called its fields', () => {
    const appearance = adaptSkinAnalysis({
      result: { moisture: 10, evenness: 95, texture: 45, severity: 9, problem_areas: ['x'] },
    });
    const prose = appearance.signals.map((s) => `${s.label} ${s.note}`).join(' ').toLowerCase();
    for (const word of ['severity', 'problem', 'condition', 'diagnos', 'treat', 'flaw', 'correct']) {
      expect(prose, word).not.toContain(word);
    }
    // …and the banned vendor fields do not become signals either.
    expect(appearance.signals.map((s) => s.id).sort()).toEqual([
      'hydrationAppearance',
      'textureAppearance',
      'toneEvenness',
    ]);
  });
});

describe('result URL extraction', () => {
  it('finds a URL under the documented-looking shape', () => {
    expect(extractResultUrls({ result: { data: [{ url: 'https://cdn.example/a.jpg' }] } })).toEqual([
      'https://cdn.example/a.jpg',
    ]);
  });

  it('finds a URL under alternative spellings', () => {
    expect(extractResultUrls({ data: { download_url: 'https://cdn.example/b.jpg' } })).toEqual([
      'https://cdn.example/b.jpg',
    ]);
    expect(extractResultUrls({ result: { image_src: 'https://cdn.example/c.jpg' } })).toEqual([
      'https://cdn.example/c.jpg',
    ]);
  });

  it('de-duplicates repeats', () => {
    const raw = {
      result: { data: [{ url: 'https://cdn.example/a.jpg' }, { url: 'https://cdn.example/a.jpg' }] },
    };
    expect(extractResultUrls(raw)).toHaveLength(1);
  });

  it('ignores strings that are not URLs', () => {
    expect(extractResultUrls({ result: { url: 'not-a-url', task_id: 'abc' } })).toEqual([]);
  });
});

describe('try-on result union', () => {
  it('reports ready with an image and alt text', () => {
    const result = adaptTryOn({ result: { data: [{ url: 'https://cdn.example/a.jpg' }] } }, 'alt');
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.imageUrl).toBe('https://cdn.example/a.jpg');
      expect(result.alt).toBe('alt');
    }
  });

  it('reports failed — with a reason — when a success carries no readable image', () => {
    const result = adaptTryOn({ result: { task_status: 'success' } }, 'alt');
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.reason.length).toBeGreaterThan(0);
  });

  it('makes a failure impossible to read as a success at compile time', () => {
    const result = tryOnFailure('nope');
    // @ts-expect-error — `imageUrl` does not exist on the failed branch. This line
    // failing to error would mean the union had been weakened to an optional field.
    expect(result.imageUrl).toBeUndefined();
  });
});
