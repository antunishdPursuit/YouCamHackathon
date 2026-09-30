/**
 * Guards that run before Express starts consuming the request body at all.
 *
 * `express.json({ limit })` (requestBody.ts) already refuses an oversized body, but it does
 * so after it has begun reading the stream. This is a cheaper, earlier rejection based on
 * the `Content-Length` header alone — defense in depth, not a replacement.
 */

import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from '@yincol/shared';

export function rejectOversizedContentLength(maxBytes: number) {
  return function requestSizeGuard(req: Request, res: Response, next: NextFunction): void {
    const header = req.header('content-length');
    const length = header ? Number(header) : NaN;

    if (Number.isFinite(length) && length > maxBytes) {
      const body: ApiErrorBody = { code: 'general', error: 'That request is too large for this demo.' };
      res.status(413).json(body);
      return;
    }

    next();
  };
}
