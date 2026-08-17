import { afterEach, describe, expect, it, vi } from 'vitest';
import { filePathFor, loadConfig } from './config.js';
import {
  fileUploadStrategy,
  ImageUploadError,
  MAX_FILE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  uploadFile,
} from './imageInput.js';

const config = loadConfig({
  YINCOL_API_BASE_URL: 'https://yce-api-01.makeupar.com',
  YINCOL_API_KEY: 'test-key',
  YINCOL_FIXTURE_MODE: 'false',
});

const source = {
  bytes: Buffer.from([1, 2, 3]),
  contentType: 'image/png',
  fileName: 'portrait.png',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('YouCam File API upload', () => {
  it('uses the documented feature-specific File API paths', () => {
    expect(filePathFor('skinAnalysis')).toBe('/s2s/v2.0/file/skin-analysis');
    expect(filePathFor('clothesVto')).toBe('/s2s/v2.0/file/cloth-v3');
    expect(filePathFor('makeupVto')).toBe('/s2s/v2.0/file/makeup-vto');
  });

  it('creates an upload slot, puts the bytes, and returns the file id', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 200,
            data: {
              files: [
                {
                  file_id: 'file-123',
                  requests: [
                    {
                      method: 'PUT',
                      url: 'https://uploads.example/file-123',
                      headers: { 'Content-Type': 'image/png' },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadFile(config, source, 'skinAnalysis')).resolves.toEqual({
      kind: 'fileId',
      fileId: 'file-123',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [metadataUrl, metadataInit] = fetchMock.mock.calls[0]!;
    expect(metadataUrl).toBe('https://yce-api-01.makeupar.com/s2s/v2.0/file/skin-analysis');
    expect(metadataInit?.method).toBe('POST');
    expect(metadataInit?.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(metadataInit?.body))).toEqual({
      files: [{ content_type: 'image/png', file_name: 'portrait.png', file_size: 3 }],
    });

    const [uploadUrl, uploadInit] = fetchMock.mock.calls[1]!;
    expect(uploadUrl).toBe('https://uploads.example/file-123');
    expect(uploadInit?.method).toBe('PUT');
    expect(uploadInit?.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(uploadInit?.headers).not.toHaveProperty('Authorization');
    expect(uploadInit?.body).toBe(source.bytes);
  });

  it('does not call the File API for invalid input', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fileUploadStrategy.prepare({ contentType: 'image/png', bytes: Buffer.alloc(0) }, 'skinAnalysis', config),
    ).rejects.toMatchObject({ name: 'ImageUploadError' });
    await expect(
      uploadFile(config, { ...source, contentType: 'text/plain' }, 'skinAnalysis'),
    ).rejects.toMatchObject({ name: 'ImageUploadError' });
    await expect(
      uploadFile(config, { ...source, bytes: Buffer.alloc(MAX_FILE_BYTES) }, 'skinAnalysis'),
    ).rejects.toMatchObject({ name: 'ImageUploadError' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the supported image types explicit', () => {
    expect([...SUPPORTED_IMAGE_TYPES]).toEqual(['image/jpeg', 'image/png']);
  });

  it('reports a metadata failure without exposing response contents', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('provider secret-shaped body', { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadFile(config, source, 'skinAnalysis')).rejects.toEqual(
      expect.objectContaining({
        name: 'ImageUploadError',
        message: 'File metadata request failed: 401',
        detail: { feature: 'skinAnalysis', stage: 'metadata', status: 401 },
      }),
    );
  });
});
