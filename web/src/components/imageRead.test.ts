import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageReader } from './imageRead.js';

class DeferredImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1000;
  naturalHeight = 1500;
  src = '';
  constructor() { images.push(this); }
}
let images: DeferredImage[] = [];
const first = new File(['first'], 'first.png', { type: 'image/png' });
const second = new File(['second'], 'second.png', { type: 'image/png' });
beforeEach(() => {
  images = [];
  vi.stubGlobal('Image', DeferredImage);
  let id = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++id}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('pending image ownership', () => {
  it('keeps the latest selection when an earlier image decodes last', () => {
    const reader = createImageReader();
    const ready = vi.fn();
    reader.read(first, ready, vi.fn());
    const staleLoad = images[0]!.onload!;
    reader.read(second, ready, vi.fn());
    images[1]!.onload!();
    staleLoad();
    expect(ready).toHaveBeenCalledExactlyOnceWith({
      file: second, previewUrl: 'blob:test-2', width: 1000, height: 1500,
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:test-1');
    // The parent session now owns the completed URL, so disposing the picker keeps it.
    reader.cancel();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:test-2');
  });

  it('does not restore a removed input or call back after its picker is discarded', () => {
    const reader = createImageReader();
    const ready = vi.fn();
    const failed = vi.fn();
    reader.read(first, ready, failed);
    const staleLoad = images[0]!.onload!;
    const staleError = images[0]!.onerror!;
    reader.cancel();
    reader.cancel();
    staleLoad();
    staleError();
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:test-1');
  });

  it('releases an unreadable image and lets the next selection succeed', () => {
    const reader = createImageReader();
    const ready = vi.fn();
    const failed = vi.fn();
    reader.read(first, ready, failed);
    images[0]!.onerror!();
    expect(failed).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
    reader.read(second, ready, failed);
    images[1]!.onload!();
    expect(ready).toHaveBeenCalledOnce();
    expect(failed).toHaveBeenCalledOnce();
  });
});
