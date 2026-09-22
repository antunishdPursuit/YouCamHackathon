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
 * health checks. A comma-separated list can allow both local and private preview
 * addresses. Every browser origin must still match one configured value exactly.
 */
export function createCorsMiddleware(configuredOrigin?: string) {
  const configured = Boolean(configuredOrigin?.trim());
  const allowedOrigins = new Set(
    (configuredOrigin ?? '').split(',').map(normaliseOrigin).filter(
      (origin): origin is string => Boolean(origin) && origin !== '*',
    ),
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.get('Origin');

    if (!configured || !requestOrigin) {
      next();
      return;
    }

    if (!allowedOrigins.has(requestOrigin)) {
      res.status(403).json({
        code: 'general',
        error: 'This origin is not allowed.',
      });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
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
