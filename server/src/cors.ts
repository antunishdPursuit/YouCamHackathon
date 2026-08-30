import type { NextFunction, Request, Response } from 'express';

const ALLOWED_METHODS = 'GET,POST,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type';

function normaliseOrigin(origin: string | undefined): string | undefined {
  const value = origin?.trim().replace(/\/+$/, '');
  return value || undefined;
}

/**
 * Allow the static site to call the API without opening the API to every browser origin.
 *
 * Requests without an Origin header still pass through for local tooling and direct
 * health checks. Once an origin is configured, browser origins must match exactly.
 */
export function createCorsMiddleware(configuredOrigin?: string) {
  const allowedOrigin = normaliseOrigin(configuredOrigin);

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.get('Origin');

    if (!allowedOrigin || !requestOrigin) {
      next();
      return;
    }

    if (requestOrigin !== allowedOrigin) {
      res.status(403).json({
        code: 'general',
        error: 'This origin is not allowed.',
      });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
