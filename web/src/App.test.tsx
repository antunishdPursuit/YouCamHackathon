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
  saveStatus: 'saved' as 'saved' | 'failed',
}));
vi.mock('./state/useSavedLooks.js', () => ({ useSavedLooks: () => ({
  ...mocks, loading: false, error: null,
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
  mocks.saveStatus = 'saved';
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
  it('opens the saved demo even when every API readiness request would fail', async () => {
    vi.mocked(checkRuntimeHealth).mockRejectedValue(new Error('API offline'));
    vi.mocked(requestBudgetAvailability).mockRejectedValue(new Error('API offline'));
    await click('Try the demo');
    expect([...container.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual([
      '/fixtures/demo-original-portrait.png', '/fixtures/demo-garment-a.jpg', '/fixtures/demo-garment-b.jpg',
    ]);
    await click('Generate demo previews');
    expect([...container.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(['Compare makeup', 'Compare outfits']);
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Compare makeup');
    expect(container.textContent).toContain('Rose Veil video example');
    expect(container.querySelector('img[src="/fixtures/demo-portrait-champagne-halo.png"]')).not.toBeNull();
    expect(container.textContent).not.toContain('could not generate');
    expect(container.textContent).not.toContain('does not yet include');
    await click('Compare outfits');
    expect(container.textContent).toContain('Full body — shared trousers and makeup');
    expect(container.querySelector('#video-example-heading')).toBeNull();
    expect(checkRuntimeHealth).not.toHaveBeenCalled();
    expect(requestBudgetAvailability).not.toHaveBeenCalled();
    expect(requestTryOn).not.toHaveBeenCalled();
  });

  it('keeps results and downloads after a save failure and retries storage without generating', async () => {
    mocks.looks = [];
    mocks.saveStatus = 'failed';
    await click('Try the demo');
    await click('Generate demo previews');
    expect(container.textContent).toContain('Not saved: browser storage is full, unavailable, or a media download failed.');
    expect(container.textContent).toContain('With Champagne Halo makeup');
    expect(container.textContent).toContain('Download your current results');
    await click('Retry saving — no new generation');
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(requestAnalysis).not.toHaveBeenCalled();
    expect(requestTryOn).not.toHaveBeenCalled();
  });
  it('opens history without the API, then checks readiness and generates from new inputs', async () => {
    await click('Open look');
    expect(checkRuntimeHealth).not.toHaveBeenCalled();
    expect(requestBudgetAvailability).not.toHaveBeenCalled();
    await click('Back to inputs');
    expect(checkRuntimeHealth).toHaveBeenCalledTimes(1);
    expect(button('Generate previews').disabled).toBe(true);
    // A saved full-body comparison must remain editable when that live feature is
    // unavailable: the user can turn it off and continue with close-up inputs.
    const fullBody = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(fullBody.checked).toBe(true);
    expect(fullBody.disabled).toBe(false);
    await act(async () => fullBody.click());
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
