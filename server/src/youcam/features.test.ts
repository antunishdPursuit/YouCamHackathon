import { describe, expect, it } from 'vitest';
import { MAKEUP_LOOKS } from '@yincol/shared';
import {
  buildClothesVtoPayload,
  buildMakeupVtoPayload,
  makeupEffectsForLook,
} from './features.js';
import type { ImageReference } from './imageInput.js';

const portrait: ImageReference = { kind: 'publicUrl', url: 'https://example.com/portrait.jpg' };
const garment: ImageReference = { kind: 'fileId', fileId: 'garment-file-123' };

describe('current non-Skin YouCam payloads', () => {
  it('uses the Clothes V3 reference-file field', () => {
    expect(buildClothesVtoPayload(portrait, garment, 'upper_body')).toEqual({
      src_file_url: 'https://example.com/portrait.jpg',
      ref_file_id: 'garment-file-123',
      garment_category: 'upper_body',
    });
  });

  it('uses a public URL when the garment is not uploaded', () => {
    expect(
      buildClothesVtoPayload(
        { kind: 'fileId', fileId: 'portrait-file-123' },
        { kind: 'publicUrl', url: 'https://example.com/garment.jpg' },
        'full_body',
      ),
    ).toEqual({
      src_file_id: 'portrait-file-123',
      ref_file_url: 'https://example.com/garment.jpg',
      garment_category: 'full_body',
    });
  });

  it('uses the Makeup VTO effects contract and does not add a reference image', () => {
    const effects = makeupEffectsForLook(MAKEUP_LOOKS[0]!);
    const payload = buildMakeupVtoPayload(portrait, effects) as Record<string, unknown>;

    expect(payload).toMatchObject({
      src_file_url: 'https://example.com/portrait.jpg',
      version: '1.0',
      effects,
    });
    expect(payload).not.toHaveProperty('reference_image');
    expect(payload).not.toHaveProperty('reference_file_id');
    expect(effects.map((effect) => effect.category)).toEqual([
      'skin_smooth',
      'blush',
      'lip_color',
    ]);
  });
});
