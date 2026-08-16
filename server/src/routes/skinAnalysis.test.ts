import { describe, expect, it } from 'vitest';
import { decodeImageBody } from './skinAnalysis.js';

describe('Skin Analysis browser payload', () => {
  it('decodes a supported base64 image without a data URL prefix', () => {
    expect(
      decodeImageBody({
        data: Buffer.from('portrait-bytes').toString('base64'),
        contentType: 'image/png',
        fileName: 'portrait.png',
      }),
    ).toEqual({
      bytes: Buffer.from('portrait-bytes'),
      contentType: 'image/png',
      fileName: 'portrait.png',
    });
  });

  it('rejects a data URL because the JSON contract carries raw base64', () => {
    expect(() =>
      decodeImageBody({
        data: 'data:image/png;base64,cG9ydHJhaXQ=',
        contentType: 'image/png',
      }),
    ).toThrow('valid base64');
  });

  it('rejects unsupported content types before any upload slot can be created', () => {
    expect(() =>
      decodeImageBody({
        data: Buffer.from('portrait-bytes').toString('base64'),
        contentType: 'image/webp',
      }),
    ).toThrow('JPEG and PNG');
  });
});
