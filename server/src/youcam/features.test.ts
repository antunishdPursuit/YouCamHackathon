import { describe, expect, it } from 'vitest';
import { buildSkinAnalysisPayload } from './features.js';

describe('Skin Analysis task payload', () => {
  it('uses the documented file reference and SD actions', () => {
    expect(buildSkinAnalysisPayload({ kind: 'fileId', fileId: 'file-123' })).toEqual({
      src_file_id: 'file-123',
      dst_actions: ['wrinkle', 'pore', 'texture', 'acne', 'skin_type'],
      format: 'json',
    });
  });

  it('uses the documented public URL field when a URL path is selected', () => {
    expect(buildSkinAnalysisPayload({ kind: 'publicUrl', url: 'https://example.com/face.png' })).toEqual({
      src_file_url: 'https://example.com/face.png',
      dst_actions: ['wrinkle', 'pore', 'texture', 'acne', 'skin_type'],
      format: 'json',
    });
  });
});
