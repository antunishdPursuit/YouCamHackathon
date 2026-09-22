import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { findMakeupLook, type TryOnResponse } from '@yincol/shared';
import { loadConfig } from '../youcam/config.js';
import { generateFullBodyLooks } from './fullBody.js';
import { tryOnRouter } from './tryOn.js';

const provider = vi.hoisted(() => ({
  prepare: vi.fn(), run: vi.fn(), capture: vi.fn(),
}));
vi.mock('../youcam/imageInput.js', async original => ({
  ...await original<typeof import('../youcam/imageInput.js')>(),
  fileUploadStrategy: { prepare: provider.prepare },
}));
vi.mock('../youcam/taskRunner.js', async original => ({
  ...await original<typeof import('../youcam/taskRunner.js')>(), runTask: provider.run,
}));
vi.mock('../youcam/adapters/tryOn.js', async original => ({
  ...await original<typeof import('../youcam/adapters/tryOn.js')>(), captureTryOnLive: provider.capture,
}));
const source = (name: string) => ({ bytes: Buffer.from(name), contentType: 'image/png', fileName: name + '.png' });
const ids = ['rosewater-cardigan', 'sage-linen-shirt'];
const image = (name: string) => ({ data: Buffer.from(name).toString('base64'), contentType: 'image/png', fileName: name });
const request = () => ({
  config: loadConfig(), portrait: source('full-portrait'), trousers: source('trousers'),
  garmentIds: ids, garmentImages: { [ids[0]!]: source('top-a'), [ids[1]!]: source('top-b') },
  look: findMakeupLook('champagne-halo')!,
});
let server: Server | undefined;
beforeEach(() => {
  vi.stubEnv('YINCOL_FIXTURE_MODE', 'true');
  vi.stubEnv('YINCOL_LIVE_TRY_ON', 'true');
  vi.stubEnv('YINCOL_API_KEY', 'test-only');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  provider.prepare.mockImplementation(async (s: { bytes: Buffer }) => ({ kind: 'fileId', fileId: s.bytes.toString() }));
  provider.run.mockImplementation(async (_config, feature, payload) => ({
    taskId: 'test-task', raw: { feature: feature.id, payload },
  }));
  provider.capture.mockImplementation(async (raw: { feature: string; payload: Record<string, string> }) => {
    const bytes = Buffer.from('output:' + (raw.payload.garment_category ?? 'makeup') + ':' +
      (raw.payload.ref_file_id ?? raw.payload.src_file_id));
    return { status: 'ready', image: { bytes, contentType: 'image/png' },
      result: { status: 'ready', imageUrl: 'data:image/png;base64,' + bytes.toString('base64'), alt: 'Mock test output' } };
  });
});
afterEach(async () => {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
  vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs();
});
async function post(body: unknown) {
  const app = express(); app.use(express.json()); app.use('/api', tryOnRouter);
  await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  return fetch('http://127.0.0.1:' + (server!.address() as AddressInfo).port + '/api/try-on', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
const fullRequest = () => ({
  portraitRef: 'fixture:portrait', portrait: image('closeup'),
  garmentIds: ids, makeupLookId: 'champagne-halo',
  garmentImages: { [ids[0]!]: image('top-a'), [ids[1]!]: image('top-b') },
  fullBody: { portrait: image('full-portrait'), trousers: image('trousers') },
});

describe('uploaded full-body sequence', () => {
  it('runs trousers once, then both tops on that result, then makeup on each top result', async () => {
    const result = await generateFullBodyLooks(request());
    const payloads = provider.run.mock.calls.map(call => call[2]);
    expect(payloads).toHaveLength(5);
    expect(payloads[0]).toMatchObject({ src_file_id: 'full-portrait', ref_file_id: 'trousers', garment_category: 'lower_body', change_shoes: false });
    const tops = payloads.filter(p => p.garment_category === 'upper_body');
    expect(tops.map(p => p.ref_file_id).sort()).toEqual(['top-a', 'top-b']);
    expect(tops.every(p => p.src_file_id === 'output:lower_body:trousers')).toBe(true);
    expect(payloads.filter(p => p.effects).map(p => p.src_file_id).sort())
      .toEqual(['output:upper_body:top-a', 'output:upper_body:top-b']);
    for (const id of ids) expect(result.completeLooks[id]).toMatchObject({ stage: 'completeLook', provenance: 'live' });
  });
  it('stops both full-body branches if trousers fail, with no saved fallback or resubmission', async () => {
    provider.run.mockRejectedValueOnce(new Error('trousers failed'));
    const result = await generateFullBodyLooks(request());
    expect(provider.run).toHaveBeenCalledTimes(1);
    for (const id of ids) expect(result.completeLooks[id]!.result.status).toBe('failed');
  });
  it('keeps B when top A fails', async () => {
    provider.run.mockImplementation(async (_c, feature, payload) => {
      if (payload.ref_file_id === 'top-a') throw new Error('A failed');
      return { taskId: 'test', raw: { feature: feature.id, payload } };
    });
    const result = await generateFullBodyLooks(request());
    expect(result.completeLooks[ids[0]!]!.result.status).toBe('failed');
    expect(result.completeLooks[ids[1]!]!.stage).toBe('completeLook');
    expect(provider.run).toHaveBeenCalledTimes(4);
  });
  it('retains the dressed image when makeup fails', async () => {
    provider.run.mockImplementation(async (_c, feature, payload) => {
      if (feature.id === 'makeupVto') throw new Error('makeup failed');
      return { taskId: 'test', raw: { feature: feature.id, payload } };
    });
    const result = await generateFullBodyLooks(request());
    expect(result.garments[ids[0]!]!.stage).toBe('garmentOnly');
    expect(result.completeLooks[ids[0]!]!.stage).toBeUndefined();
    expect(result.completeLooks[ids[0]!]!.result.status).toBe('failed');
  });
});
describe('full-body request boundary', () => {
  it('passes current uploads through the route and retains both views', async () => {
    const input = fullRequest();
    input.portrait.fileName = 'p'.repeat(300);
    const response = await post(input);
    expect(response.status).toBe(200);
    expect(provider.prepare.mock.calls.some(([source]) => source.fileName === 'p'.repeat(255))).toBe(true);
    expect(provider.prepare.mock.calls.every(([source]) => source.fileName.length <= 255)).toBe(true);
    const body = await response.json() as TryOnResponse;
    expect(body.completeLooks[ids[0]!]!.stage).toBe('completeLook');
    expect(body.fullBody!.completeLooks[ids[1]!]!.stage).toBe('completeLook');
    expect(provider.run).toHaveBeenCalledTimes(9); // 4 close-up + 5 full-body tasks
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('preserves close-up results when the trousers task fails', async () => {
    provider.run.mockImplementation(async (_c, feature, payload) => {
      if (payload.garment_category === 'lower_body') throw new Error('trousers failed');
      return { taskId: 'test', raw: { feature: feature.id, payload } };
    });
    const response = await post(fullRequest());
    const body = await response.json() as TryOnResponse;
    expect(body.completeLooks[ids[0]!]!.stage).toBe('completeLook');
    expect(body.fullBody!.completeLooks[ids[0]!]!.result.status).toBe('failed');
  });
  it.each([null, {}, { portrait: image('full') }, { portrait: image('full'), trousers: { ...image('pants'), contentType: 'image/webp' } }])
  ('rejects missing or unsupported full-body inputs before any provider call', async fullBody => {
    const response = await post({ ...fullRequest(), fullBody });
    expect(response.status).toBe(400);
    expect(provider.prepare).not.toHaveBeenCalled();
    expect(provider.run).not.toHaveBeenCalled();
  });
  it.each([
    ['portrait', 'data:image/png;base64,AAAA'],
    ['garment', '%%%AAAA###'],
    ['fullBodyPortrait', 'AAA'],
    ['trousers', 'data:image/png;base64,AAAA'],
  ])('rejects malformed base64 in %s before any provider call', async (field, data) => {
    const input = fullRequest();
    const target = field === 'portrait' ? input.portrait
      : field === 'garment' ? input.garmentImages[ids[0]!]!
      : field === 'fullBodyPortrait' ? input.fullBody.portrait : input.fullBody.trousers;
    target.data = data!;
    const response = await post(input);
    expect(response.status).toBe(400);
    expect(provider.prepare).not.toHaveBeenCalled();
    expect(provider.run).not.toHaveBeenCalled();
  });
  it('rejects full-body bytes in fixture mode instead of serving examples', async () => {
    vi.stubEnv('YINCOL_LIVE_TRY_ON', 'false');
    const response = await post({ garmentIds: ids, makeupLookId: 'champagne-halo', fullBody: fullRequest().fullBody });
    expect(response.status).toBe(400);
    expect(provider.prepare).not.toHaveBeenCalled();
  });
});
