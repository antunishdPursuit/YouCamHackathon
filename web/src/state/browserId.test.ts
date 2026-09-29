import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateBrowserId } from './browserId.js';

/** This workspace runs vitest in a plain Node environment — no jsdom, no real
 * `localStorage` — so a minimal in-memory stand-in is stubbed globally, the same way
 * savedLooks.test.ts stubs `indexedDB`. */
function fakeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: () => null,
    get length() { return store.size; },
  } as Storage;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('getOrCreateBrowserId', () => {
  it('creates an id once and reuses it on later calls', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
    const first = getOrCreateBrowserId();
    const second = getOrCreateBrowserId();
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it('persists it under its storage key', () => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
    const id = getOrCreateBrowserId();
    expect(localStorage.getItem('yincol:browser-id')).toBe(id);
  });

  it('falls back to a per-call id, without throwing, when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(() => getOrCreateBrowserId()).not.toThrow();
    expect(getOrCreateBrowserId().length).toBeGreaterThan(0);
  });
});
