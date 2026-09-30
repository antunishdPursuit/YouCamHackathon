// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { loadDemoLook } from './state/demoLook.js';
import type { SavedLook } from './state/savedLooks.js';
import { checkRuntimeHealth, requestAnalysis, requestTryOn, requestBudgetAvailability } from './api/client.js';

const mocks = vi.hoisted(() => ({
  read: vi.fn(), save: vi.fn(), refresh: vi.fn(), remove: vi.fn(),
  setSaveStatus: vi.fn(), attachVideo: vi.fn(), looks: [] as SavedLook[],
}));
vi.mock('./state/useSavedLooks.js', () => ({ useSavedLooks: () => ({
  ...mocks, loading: false, error: null, saveStatus: 'saved',
}) }));
vi.mock('./state/savedLooks.js', async importOriginal => ({
  ...await importOriginal<typeof import('./state/savedLooks.js')>(),
  readSavedLook: mocks.read,
}));
vi.mock('./state/generationCache.js', async importOriginal => ({
  ...await importOriginal<typeof import('./state/generationCache.js')>(),
  generationCacheKey: vi.fn(async () => 'new-photos'),
  readGenerationCache: vi.fn(() => null),
}));
vi.mock('./api/client.js', async importOriginal => ({
  ...await importOriginal<typeof import('./api/client.js')>(),
  checkRuntimeHealth: vi.fn(), requestBudgetAvailability: vi.fn(),
  requestAnalysis: vi.fn(), requestTryOn: vi.fn(), requestSkinAnalysis: vi.fn(async () => null),
}));
// jsdom cannot decode images; keep the real file-picker and App callbacks while
// supplying the successful decode a browser produces for valid 1024px JPEGs.
vi.mock('./components/imageRead.js', () => ({ createImageReader: () => ({
  cancel: vi.fn(),
  read: (file: File, ready: (image: unknown) => void) => ready({
    file, previewUrl: `blob:${file.name}`, width: 1024, height: 1024,
  }),
}) }));

let root: Root;
let container: HTMLDivElement;
const demo = loadDemoLook();
const saved: SavedLook = { ...demo, key: 'saved-demo-v2', savedAt: 1, media: [], motion: [] };
const button = (label: string) => {
  const found = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label);
  expect(found, `button ${label}`).toBeDefined();
  return found!;
};
const click = async (label: string) => { await act(async () => button(label).click()); };

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: vi.fn() }));
  mocks.looks = [saved];
  mocks.read.mockImplementation(async key => key === saved.key ? saved : undefined);
  mocks.save.mockResolvedValue(undefined);
  vi.mocked(checkRuntimeHealth).mockResolvedValue({
    liveTryOn: false, liveSkinAnalysis: false, liveVideo: false, fullBodyTryOn: false,
  });
  vi.mocked(requestBudgetAvailability).mockResolvedValue({ available: true, siteRemaining: 100, browserRemaining: 40 });
  vi.mocked(requestAnalysis).mockResolvedValue(demo.analysis);
  vi.mocked(requestTryOn).mockResolvedValue(demo.tryOn);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('editing saved history', () => {
  it('opens history without the API, then checks readiness and generates from new inputs', async () => {
    await click('Open look');
    expect(checkRuntimeHealth).not.toHaveBeenCalled();
    expect(requestBudgetAvailability).not.toHaveBeenCalled();
    await click('Back to inputs');
    expect(checkRuntimeHealth).toHaveBeenCalledTimes(1);
    expect(button('Generate previews').disabled).toBe(true);
    const files = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')];
    expect(files).toHaveLength(3);
    for (const [index, input] of files.entries()) {
      Object.defineProperty(input, 'files', { value: [new File(['jpeg'], `photo-${index}.jpg`, { type: 'image/jpeg' })] });
      await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    }
    expect(button('Generate previews').disabled).toBe(false);
    await click('Generate previews');
    expect(requestAnalysis).toHaveBeenCalledTimes(1);
    expect(requestTryOn).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the current demo editing flow API-free', async () => {
    await click('Try the demo');
    await click('Generate demo previews');
    await click('Back to inputs');
    expect(button('Generate demo previews')).toBeDefined();
    expect(checkRuntimeHealth).not.toHaveBeenCalled();
    expect(requestTryOn).not.toHaveBeenCalled();
  });

  it('does not inherit demo mode when a different saved session is opened', async () => {
    await click('Try the demo');
    await click('Back to Start');
    await click('Open look');
    expect(checkRuntimeHealth).not.toHaveBeenCalled();
    await click('Add inputs');
    expect(button('Generate previews')).toBeDefined();
    expect(checkRuntimeHealth).toHaveBeenCalledTimes(1);
  });
});
