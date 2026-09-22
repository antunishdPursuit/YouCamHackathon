import { useCallback, useEffect, useRef, useState } from 'react';
import { findMakeupLook } from '@yincol/shared';
import { readLatestGenerationCache, type CachedGeneration } from './generationCache.js';
import { hasUsablePreviews, listSavedLooks, prepareSavedLook, putSavedLook, readSavedLook,
  deleteSavedLook, clearSavedLooks, historyRevision, claimLegacyMigration, type LookSettings, type SavedLook } from './savedLooks.js';

export type SaveStatus = 'saving' | 'saved' | 'failed' | 'empty' | null;

/** Persistent output history, with stale-save guards and explicit storage failures. */
export function useSavedLooks() {
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const epoch = useRef(0);
  const readVersion = useRef(0);
  const mounted = useRef(false);
  const saveVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      const rows = await listSavedLooks();
      if (mounted.current && version === readVersion.current) { setLooks(rows); setError(null); }
    } catch {
      if (mounted.current && version === readVersion.current) setError('Could not load saved looks. Check browser storage, then retry.');
    } finally {
      if (mounted.current && version === readVersion.current) setLoading(false);
    }
  }, []);

  const save = useCallback(async (cache: CachedGeneration, settings: LookSettings, current: () => boolean) => {
    const saveEpoch = epoch.current;
    const version = ++saveVersion.current;
    const isCurrent = () => mounted.current && saveEpoch === epoch.current && current();
    if (!hasUsablePreviews(cache.tryOn)) { if (isCurrent()) setSaveStatus('empty'); return; }
    if (isCurrent()) setSaveStatus('saving');
    try {
      // Matching records never re-download media or add another history item.
      const revision = await historyRevision();
      let look = await readSavedLook(cache.key);
      if (!isCurrent()) return;
      if (!look) {
        look = await prepareSavedLook(cache, settings);
        if (!isCurrent()) return;
        await putSavedLook(look, isCurrent, revision);
      }
      if (!isCurrent()) return;
      if (version === saveVersion.current) setSaveStatus('saved');
      await refresh();
    } catch {
      if (isCurrent() && version === saveVersion.current) setSaveStatus('failed');
    }
  }, [refresh]);

  const remove = useCallback(async (key?: string) => {
    epoch.current += 1;
    readVersion.current += 1;
    // Invalidate pending saves before deletion, including media still downloading.
    try {
      if (key) await deleteSavedLook(key); else await clearSavedLooks();
      if (mounted.current) { setLooks(items => key ? items.filter(item => item.key !== key) : []); setSaveStatus(null); setError(null); }
    } catch {
      if (mounted.current) setError('Saved media could not be deleted. It may still be on this browser. Try deleting it again.');
      throw new Error('Saved media could not be deleted.');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const lifecycle = ++epoch.current;
    void (async () => {
      await refresh();
      if (!mounted.current || lifecycle !== epoch.current) return;
      // Rescue the one completed result retained by the old session-only cache.
      const previous = readLatestGenerationCache();
      if (!previous) return;
      try {
        const key = JSON.parse(previous.key) as { makeupLookId?: string };
        if (!key.makeupLookId || !findMakeupLook(key.makeupLookId)) return;
        if (!(await claimLegacyMigration())) return;
        await save(previous, { makeupLookId: key.makeupLookId, garmentIds: Object.keys(previous.tryOn.completeLooks) }, () => lifecycle === epoch.current);
      } catch { /* Unknown legacy records are never relabelled or regenerated. */ }
    })();
    const sync = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { mounted.current = false; epoch.current += 1; window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [refresh, save]);

  return { looks, loading, error, saveStatus, setSaveStatus, save, remove, refresh };
}
