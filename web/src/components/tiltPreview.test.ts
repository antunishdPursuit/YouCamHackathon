/**
 * The 2.5D preview's bounds and its wording.
 *
 * Two things are worth guarding here. The bound, because the honesty of the feature
 * rests on the tilt staying small enough to read as "the same picture, angled" — and the
 * wording, because the one thing this must never say is that it is showing a view the app
 * does not have.
 */

import { describe, expect, it } from 'vitest';
import {
  TILT_MAX_DEGREES,
  TILT_NONE,
  TILT_STEP_DEGREES,
  canTilt,
  clampTilt,
  isTilted,
  nextTilt,
  tiltStatus,
  tiltTransform,
} from './tiltPreview.js';

describe('clampTilt', () => {
  it('holds the angle inside the approved bound in both directions', () => {
    expect(clampTilt(90)).toBe(TILT_MAX_DEGREES);
    expect(clampTilt(-90)).toBe(-TILT_MAX_DEGREES);
    expect(clampTilt(TILT_MAX_DEGREES)).toBe(TILT_MAX_DEGREES);
  });

  it('leaves an in-range angle alone', () => {
    expect(clampTilt(0)).toBe(0);
    expect(clampTilt(6)).toBe(6);
    expect(clampTilt(-6)).toBe(-6);
  });

  it('resolves nonsense to the resting state instead of leaking NaN into a style', () => {
    // `transform: rotateY(NaNdeg)` is ignored silently, which would look like the feature
    // was off rather than broken.
    expect(clampTilt(Number.NaN)).toBe(TILT_NONE);
    expect(clampTilt(Number.POSITIVE_INFINITY)).toBe(TILT_NONE);
  });
});

describe('nextTilt', () => {
  it('steps by one increment from rest', () => {
    expect(nextTilt(TILT_NONE, 1)).toBe(TILT_STEP_DEGREES);
    expect(nextTilt(TILT_NONE, -1)).toBe(-TILT_STEP_DEGREES);
  });

  it('stops at the bound rather than running away', () => {
    let angle: number = TILT_NONE;
    for (let press = 0; press < 20; press += 1) angle = nextTilt(angle, 1);
    expect(angle).toBe(TILT_MAX_DEGREES);

    for (let press = 0; press < 40; press += 1) angle = nextTilt(angle, -1);
    expect(angle).toBe(-TILT_MAX_DEGREES);
  });

  it('always comes back to exactly rest, so Reset is reachable by stepping too', () => {
    expect(nextTilt(TILT_STEP_DEGREES, -1)).toBe(TILT_NONE);
  });
});

describe('canTilt', () => {
  it('is false at the bound in that direction and true coming back', () => {
    expect(canTilt(TILT_MAX_DEGREES, 1)).toBe(false);
    expect(canTilt(TILT_MAX_DEGREES, -1)).toBe(true);
    expect(canTilt(-TILT_MAX_DEGREES, -1)).toBe(false);
    expect(canTilt(-TILT_MAX_DEGREES, 1)).toBe(true);
  });

  it('is true in both directions at rest', () => {
    expect(canTilt(TILT_NONE, 1)).toBe(true);
    expect(canTilt(TILT_NONE, -1)).toBe(true);
  });
});

describe('tiltTransform', () => {
  it('applies no transform at rest, so a resting card is untouched', () => {
    expect(tiltTransform(TILT_NONE)).toBe('none');
  });

  it('rotates about the vertical axis only, so nothing is cropped or moved', () => {
    const transform = tiltTransform(6);

    expect(transform).toContain('rotateY(6deg)');
    expect(transform).toContain('perspective(');
    // A scale or translate would push the image around inside a frame that clips.
    expect(transform).not.toContain('scale');
    expect(transform).not.toContain('translate');
  });

  it('never emits an angle outside the bound, whatever it is handed', () => {
    expect(tiltTransform(400)).toContain(`rotateY(${TILT_MAX_DEGREES}deg)`);
    expect(tiltTransform(Number.NaN)).toBe('none');
  });
});

describe('isTilted', () => {
  it('distinguishes a resting card from a tilted one', () => {
    expect(isTilted(TILT_NONE)).toBe(false);
    expect(isTilted(6)).toBe(true);
    expect(isTilted(-6)).toBe(true);
  });
});

describe('tiltStatus', () => {
  it('describes the transform, never a viewpoint', () => {
    for (const angle of [TILT_NONE, 6, -6, TILT_MAX_DEGREES, -TILT_MAX_DEGREES]) {
      const status = tiltStatus(angle).toLowerCase();

      // The whole honesty requirement of the feature, asserted directly: this is one
      // photograph being tilted, and it must never be announced as another camera angle.
      expect(status).not.toContain('view');
      expect(status).not.toContain('side');
      expect(status).not.toContain('rear');
      expect(status).not.toContain('back');
      expect(status).not.toContain('3d');
      expect(status).not.toContain('angle of');
    }
  });

  it('says which way and how far', () => {
    expect(tiltStatus(6)).toBe('Tilted 6 degrees right');
    expect(tiltStatus(-12)).toBe('Tilted 12 degrees left');
  });

  it('names the resting state plainly', () => {
    expect(tiltStatus(TILT_NONE)).toBe('Flat — no tilt applied');
  });
});
