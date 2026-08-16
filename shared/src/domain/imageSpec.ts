/**
 * Image requirements — VERIFIED from Perfect Corp's documentation.
 *
 * Checked in the browser before anything is submitted. A photograph that cannot work
 * should cost the shopper a friendly sentence, not a wasted API call and a wait.
 */

export const IMAGE_SPEC = {
  maxLongSide: 4096,
  minShortSideSd: 480,
  minShortSideHd: 1080,
} as const;

export type ImageCheckCode = 'tooSmall' | 'belowHd' | 'tooLarge' | 'ok';

export interface ImageCheck {
  readonly code: ImageCheckCode;
  /** `false` blocks submission; `true` with a message is advice, not a refusal. */
  readonly usable: boolean;
  readonly message: string;
}

/**
 * Judge a photograph by its dimensions.
 *
 * Below the SD floor is a genuine block. Between SD and HD is usable but worth a word,
 * because the shopper can usually just retake it. Above the long-side ceiling is a
 * block, since the API will reject it anyway.
 */
export function checkImageDimensions(width: number, height: number): ImageCheck {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);

  if (longSide > IMAGE_SPEC.maxLongSide) {
    return {
      code: 'tooLarge',
      usable: false,
      message: `This photograph is ${longSide}px on its longest side. Please use one no larger than ${IMAGE_SPEC.maxLongSide}px.`,
    };
  }

  if (shortSide < IMAGE_SPEC.minShortSideSd) {
    return {
      code: 'tooSmall',
      usable: false,
      message: `This photograph is only ${shortSide}px on its shortest side. Please use one of at least ${IMAGE_SPEC.minShortSideSd}px so the colours can be read accurately.`,
    };
  }

  if (shortSide < IMAGE_SPEC.minShortSideHd) {
    return {
      code: 'belowHd',
      usable: true,
      message: `This will work, though a photograph of at least ${IMAGE_SPEC.minShortSideHd}px on its shortest side reads more accurately.`,
    };
  }

  return { code: 'ok', usable: true, message: 'This photograph is a good size.' };
}
