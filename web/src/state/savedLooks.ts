import type { AnalyzeResponse, TryOnPanel, TryOnResponse } from '@yincol/shared';
import type { CachedGeneration } from './generationCache.js';
import { GARMENT_A_MOTION_URL, motionSampleKind } from '../components/motionSample.js';

export interface LookSettings {
  readonly garmentIds: readonly string[];
  readonly makeupLookId: string | null;
  readonly portraitSize?: { width: number; height: number };
  readonly fullBodySize?: { width: number; height: number };
}
export interface SavedMedia {
  readonly id: string;
  readonly blob: Blob;
  readonly label: string;
  readonly kind: 'image' | 'video';
  readonly motionKind?: 'video' | 'still';
}
export interface SavedLook extends LookSettings {
  readonly key: string;
  readonly savedAt: number;
  readonly analysis: AnalyzeResponse;
  readonly tryOn: TryOnResponse;
  readonly media: readonly SavedMedia[];
  /** Which saved image each saved video belongs to. At most one entry per `imageId`: a
   * later `attachVideoToSavedLook` call for the same image replaces its entry (and its old
   * video's media blob) rather than adding a second one. */
  readonly motion: readonly { readonly imageId: string; readonly videoId: string }[];
}
export interface OpenedLook {
  readonly look: SavedLook;
  readonly tryOn: TryOnResponse;
  readonly downloads: readonly (SavedMedia & { url: string })[];
  readonly motionKindByImage: Readonly<Record<string, 'video' | 'still'>>;
  readonly videoByImage: Readonly<Record<string, string>>;
  readonly dispose: () => void;
}
const DB_NAME = 'yincol-saved-looks';
const STORE = 'looks';

/** Version 1 records from PR #13 stored a single relationship as an object. */
export function normalizeMotion(value: unknown): SavedLook['motion'] {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  return entries.filter((entry): entry is SavedLook['motion'][number] =>
    entry !== null && typeof entry === 'object' &&
    typeof entry.imageId === 'string' && typeof entry.videoId === 'string');
}

export function savedImageIdFor(response: TryOnResponse, imageUrl: string): string | undefined {
  const ids = new Map<string, string>();
  mapPanels(response, panel => {
    if (panel.result.status === 'ready' && !ids.has(panel.result.imageUrl)) {
      ids.set(panel.result.imageUrl, `image-${ids.size + 1}`);
    }
    return panel;
  });
  return ids.get(imageUrl);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Browser storage is unavailable.')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    let settled = false;
    const fail = () => { settled = true; clearTimeout(timeout); reject(new Error('Could not open browser storage.')); };
    const timeout = setTimeout(fail, 4_000);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
      if (!request.result.objectStoreNames.contains('meta')) request.result.createObjectStore('meta');
    };
    request.onerror = fail;
    request.onblocked = fail;
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      clearTimeout(timeout);
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** Resolve only after the transaction commits, including quota/abort failures. */
async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, meta: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction([STORE, 'meta'], mode); } catch (error) { db.close(); reject(error); return; }
    const timeout = setTimeout(() => { try { tx.abort(); } catch { /* Already finished. */ } }, 5_000);
    let result: T;
    tx.oncomplete = () => { clearTimeout(timeout); db.close(); resolve(result); };
    tx.onabort = () => { clearTimeout(timeout); db.close(); reject(tx.error ?? new Error('Saving was interrupted.')); };
    tx.onerror = () => { /* The abort handler reports failed transactions. */ };
    try { operation(tx.objectStore(STORE), tx.objectStore('meta')).onsuccess = event => { result = (event.target as IDBRequest<T>).result; }; }
    catch (error) { clearTimeout(timeout); tx.abort(); db.close(); reject(error); }
  });
}
export async function listSavedLooks(): Promise<SavedLook[]> {
  const looks = await transaction<SavedLook[]>('readonly', store => store.getAll());
  return looks.sort((a, b) => b.savedAt - a.savedAt);
}
export const readSavedLook = (key: string): Promise<SavedLook | undefined> =>
  transaction('readonly', store => store.get(key));
export async function historyRevision(): Promise<number> {
  return (await transaction<number | undefined>('readonly', (_store, meta) => meta.get('revision'))) ?? 0;
}
export async function claimLegacyMigration(): Promise<boolean> {
  const claimed = await transaction<boolean | undefined>('readwrite', (_store, meta) => {
    const request = meta.get('legacyImported');
    request.addEventListener('success', () => {
      try { meta.put(true, 'legacyImported'); } catch { meta.transaction.abort(); }
    });
    return request;
  });
  return !claimed;
}
export async function putSavedLook(look: SavedLook, isCurrent: () => boolean, revision: number): Promise<void> {
  await transaction('readwrite', (store, meta) => {
    const request = meta.get('revision');
    request.addEventListener('success', () => {
      // Deletion in any tab invalidates work that was still preparing its media.
      if (!isCurrent() || (request.result ?? 0) !== revision) { store.transaction.abort(); return; }
      try { store.put(look); } catch { store.transaction.abort(); }
    });
    return request;
  });
}
async function removeSaved(key?: string): Promise<void> {
  await transaction('readwrite', (store, meta) => {
    const request = meta.get('revision');
    request.addEventListener('success', () => {
      try {
        meta.put((request.result ?? 0) + 1, 'revision');
        meta.put(true, 'legacyImported');
        if (key) store.delete(key); else store.clear();
      } catch { store.transaction.abort(); }
    });
    return request;
  });
}
export const deleteSavedLook = (key: string): Promise<void> => removeSaved(key);
export const clearSavedLooks = (): Promise<void> => removeSaved();

function mapPanels(response: TryOnResponse, convert: (panel: TryOnPanel, label: string) => TryOnPanel): TryOnResponse {
  const map = (panels: Readonly<Record<string, TryOnPanel>>, view: string) =>
    Object.fromEntries(Object.entries(panels).map(([key, panel], index) => {
      const stage = panel.stage === 'completeLook' ? 'with makeup' : panel.stage === 'garmentOnly' ? 'without makeup' : 'preview';
      return [key, convert(panel, `${view} garment ${index === 0 ? 'A' : 'B'} ${stage}`)];
    }));
  return { ...response, garments: map(response.garments, 'Close-up'), completeLooks: map(response.completeLooks, 'Close-up'),
    // The API echoes the source portrait. It is not a generated output and is never persisted.
    portrait: { provenance: response.portrait.provenance, result: { status: 'failed', reason: 'Source photos are not saved.' } },
    // Unlike the bare portrait, this IS a generated output — the makeup task's own result —
    // so it is saved/restored the same way garments and complete looks are.
    ...(response.portraitMadeUp ? { portraitMadeUp: convert(response.portraitMadeUp, 'Portrait with makeup') } : {}),
    ...(response.fullBody ? { fullBody: { ...response.fullBody,
      garments: map(response.fullBody.garments, 'Full-body'), completeLooks: map(response.fullBody.completeLooks, 'Full-body') } } : {}) };
}
export function hasUsablePreviews(response: TryOnResponse): boolean {
  let usable = false;
  mapPanels(response, panel => {
    if (panel.result.status === 'ready' && panel.provenance !== 'placeholder') usable = true;
    return panel;
  });
  return usable;
}

/** Fetch only output data or shipped fixture assets, never a provider URL or source upload. */
async function mediaBytes(source: string, kind: SavedMedia['kind']): Promise<Blob> {
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(source) &&
      !/^\/fixtures\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|svg|mp4)$/.test(source)) {
    throw new Error('This preview cannot be saved safely.');
  }
  const response = await fetch(source, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('A preview could not be downloaded for saving.');
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith(`${kind}/`)) throw new Error('The saved media was unavailable.');
  return blob;
}

export async function prepareSavedLook(cache: CachedGeneration, settings: LookSettings): Promise<SavedLook> {
  const tasks: Promise<SavedMedia>[] = [];
  const ids = new Map<string, string>();
  const motion: { imageId: string; videoId: string }[] = [];
  const tryOn = mapPanels(cache.tryOn, (panel, label) => {
    if (panel.result.status !== 'ready') return panel;
    const source = panel.result.imageUrl;
    let id = ids.get(source);
    if (!id) {
      id = `image-${ids.size + 1}`;
      ids.set(source, id);
      const imageId = id;
      tasks.push(mediaBytes(source, 'image').then(blob => ({ id: imageId, blob, label, kind: 'image', motionKind: motionSampleKind(panel, cache.tryOn.mode) })));
      if (motionSampleKind(panel, cache.tryOn.mode) === 'video') {
        motion.push({ imageId, videoId: 'motion-sample' });
        tasks.push(mediaBytes(GARMENT_A_MOTION_URL, 'video').then(blob => ({ id: 'motion-sample', blob, label: 'Saved Garment A motion sample', kind: 'video' })));
      }
    }
    return { ...panel, result: { ...panel.result, imageUrl: `saved:${id}` } };
  });
  return { key: cache.key, savedAt: cache.savedAt, analysis: cache.analysis, ...settings, tryOn,
    media: await Promise.all(tasks), motion };
}

/** Restored media is served from browser-owned bytes, independent of API and expiring URLs. */
export function openSavedLook(look: SavedLook): OpenedLook {
  const downloads = look.media.map(media => ({ ...media, url: URL.createObjectURL(media.blob) }));
  const urls = new Map(downloads.map(media => [media.id, media.url]));
  const tryOn = mapPanels(look.tryOn, panel => {
    if (panel.result.status !== 'ready') return panel;
    const url = urls.get(panel.result.imageUrl.replace(/^saved:/, ''));
    return url ? { ...panel, result: { ...panel.result, imageUrl: url } }
      : { ...panel, result: { status: 'failed', reason: 'This saved image is unavailable.' } };
  });
  const motionKindByImage: Record<string, 'video' | 'still'> = {};
  downloads.forEach(media => { if (media.motionKind) motionKindByImage[media.url] = media.motionKind; });
  const videoByImage: Record<string, string> = {};
  // `?? []` guards a look saved by an earlier version of this module, before `motion`
  // became a required array — IndexedDB records are never migrated in place.
  for (const entry of normalizeMotion(look.motion)) {
    const imageUrl = urls.get(entry.imageId), videoUrl = urls.get(entry.videoId);
    if (imageUrl && videoUrl) videoByImage[imageUrl] = videoUrl;
  }
  return { look, tryOn, downloads, videoByImage, motionKindByImage, dispose: () => downloads.forEach(media => URL.revokeObjectURL(media.url)) };
}

/**
 * Attach a generated video to an already-saved image, replacing any earlier video for that
 * same image (and dropping its now-orphaned blob) rather than accumulating one per attempt.
 * Reuses `putSavedLook`'s existing optimistic-concurrency guard unchanged.
 */
export async function attachVideoToSavedLook(
  key: string,
  imageId: string,
  videoBlob: Blob,
  isCurrent: () => boolean,
): Promise<void> {
  const revision = await historyRevision();
  await transaction('readwrite', (store, meta) => {
    const request = meta.get('revision');
    request.addEventListener('success', () => {
      if (!isCurrent() || (request.result ?? 0) !== revision) { store.transaction.abort(); return; }
      const read = store.get(key);
      read.addEventListener('success', () => {
        const look = read.result as SavedLook | undefined;
        if (!look || !isCurrent() || !look.media.some(item => item.id === imageId && item.kind === 'image')) {
          store.transaction.abort(); return;
        }
        const videoId = 'video-' + imageId;
        const motion = [...normalizeMotion(look.motion).filter(entry => entry.imageId !== imageId), { imageId, videoId }];
        const media = [...look.media.filter(item => item.id !== videoId),
          { id: videoId, blob: videoBlob, label: 'Generated video', kind: 'video' as const }];
        try { store.put({ ...look, motion, media }); } catch { store.transaction.abort(); }
      });
    });
    return request;
  });
}

export function mediaFileName(media: SavedMedia, savedAt: number): string {
  const subtype = media.blob.type.split('/')[1]?.split(';')[0];
  const extension = subtype === 'svg+xml' ? 'svg' : subtype === 'jpeg' ? 'jpg' : subtype ?? 'bin';
  return `yincol-${new Date(savedAt).toISOString().slice(0, 10)}-${media.id}.${extension}`;
}

/** Downloads remain available even when IndexedDB cannot save a result. */
export function currentMediaLinks(response: TryOnResponse): { url: string; label: string; kind: 'image' | 'video' }[] {
  const links: { url: string; label: string; kind: 'image' | 'video' }[] = [];
  const seen = new Set<string>();
  mapPanels(response, (panel, label) => {
    if (panel.result.status !== 'ready' || panel.provenance === 'placeholder' || seen.has(panel.result.imageUrl)) return panel;
    seen.add(panel.result.imageUrl);
    links.push({ url: panel.result.imageUrl, label, kind: 'image' });
    if (motionSampleKind(panel, response.mode) === 'video') links.push({ url: GARMENT_A_MOTION_URL, label: 'Garment A motion sample', kind: 'video' });
    return panel;
  });
  return links;
}
