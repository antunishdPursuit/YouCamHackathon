import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createCorsMiddleware } from './cors.js';

function fakeRequest(origin?: string, method = 'GET') {
  return {
    method,
    get(name: string) {
      return name.toLowerCase() === 'origin' ? origin : undefined;
    },
  } as unknown as Request;
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
    headers,
  };
  return res;
}

function run(configuredOrigin: string | undefined, origin?: string, method = 'GET') {
  const req = fakeRequest(origin, method);
  const res = fakeResponse();
  const next = vi.fn() as unknown as NextFunction;
  createCorsMiddleware(configuredOrigin)(req, res as unknown as Response, next);
  return { res, next };
}

describe('createCorsMiddleware', () => {
  it('leaves local and direct requests alone when no origin is configured', () => {
    const { res, next } = run(undefined, 'https://static.example');

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.headers).toEqual({});
  });

  it('allows the exact configured origin and exposes the required headers', () => {
    const { res, next } = run('https://static.example/', 'https://static.example');

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers).toEqual({
      'Access-Control-Allow-Origin': 'https://static.example',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Yincol-Browser-Id',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
  });

  it('answers an exact-origin preflight without passing it to an API route', () => {
    const { res, next } = run('https://static.example', 'https://static.example', 'OPTIONS');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Headers']?.toLowerCase().split(',')).toEqual(['content-type', 'x-yincol-browser-id']);
  });

  it('rejects a different browser origin without revealing route details', () => {
    const { res, next } = run('https://static.example', 'https://other.example');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      code: 'general',
      error: 'This origin is not allowed.',
    });
  });
});


describe('multiple exact preview origins', () => {
  const privateOrigin = 'https://preview.example.ts.net:8443';
  const localOrigin = 'http://localhost:8787';
  const configured = ` ${privateOrigin}/, ${localOrigin}/ `;

  it.each([privateOrigin, localOrigin])('accepts %s and returns only that origin', (origin) => {
    const { res, next } = run(configured, origin);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers['Access-Control-Allow-Origin']).toBe(origin);
    expect(res.headers['Vary']).toBe('Origin');
  });

  it.each([privateOrigin, localOrigin])('allows preflight for %s', (origin) => {
    const { res, next } = run(configured, origin, 'OPTIONS');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe(origin);
  });

  it.each([
    'https://other.example',
    'http://localhost:8788',
    'https://localhost:8787',
    'https://preview.example.ts.net:8443.other.example',
  ])('rejects unlisted origin %s', (origin) => {
    const { res, next } = run(configured, origin);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it.each([', ,', '*'])('does not open access for an invalid list %s', (origins) => {
    const { res, next } = run(origins, 'https://other.example');
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
