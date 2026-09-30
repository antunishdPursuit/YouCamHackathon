import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { rejectOversizedContentLength } from './requestGuards.js';

function fakeReqRes(contentLength: string | undefined) {
  const req = { header: (name: string) => (name.toLowerCase() === 'content-length' ? contentLength : undefined) } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status } as unknown as Response;
  const next = vi.fn();
  return { req, res, status, json, next };
}

describe('rejectOversizedContentLength', () => {
  it('rejects a request whose declared Content-Length exceeds the limit, before any body is read', () => {
    const { req, res, status, json, next } = fakeReqRes('1000');
    rejectOversizedContentLength(999)(req, res, next);
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({ code: 'general', error: 'That request is too large for this demo.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through a request at or under the limit', () => {
    const { req, res, next, status } = fakeReqRes('999');
    rejectOversizedContentLength(999)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('passes through a request with no Content-Length header at all', () => {
    const { req, res, next } = fakeReqRes(undefined);
    rejectOversizedContentLength(10)(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
