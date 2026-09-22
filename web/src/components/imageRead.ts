import type { CapturedImage } from '../state/session.js';

/** Owns one pending decode. Completed object URLs transfer to the session. */
export function createImageReader() {
  let cancelPending: (() => void) | null = null;

  const cancel = () => {
    cancelPending?.();
    cancelPending = null;
  };

  const read = (file: File, onReady: (image: CapturedImage) => void, onError: () => void) => {
    cancel();
    const previewUrl = URL.createObjectURL(file);
    const image = new Image();
    let pending = true;
    const detach = () => { image.onload = null; image.onerror = null; };
    cancelPending = () => {
      if (!pending) return;
      pending = false;
      detach();
      URL.revokeObjectURL(previewUrl);
    };
    image.onload = () => {
      if (!pending) return;
      pending = false;
      cancelPending = null;
      detach();
      onReady({ file, previewUrl, width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      if (!pending) return;
      cancel();
      onError();
    };
    image.src = previewUrl;
  };

  return { read, cancel };
}
