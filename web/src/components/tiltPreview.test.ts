/** Guard the visible tilt behavior and avoid claims about unseen views. */
import { describe, expect, it } from 'vitest';
import {
  TILT_MAX_DEGREES, TILT_NONE, TILT_PREVIEW_NOTE, TILT_STEP_DEGREES,
  canTilt, clampTilt, isTilted, nextTilt, tiltStatus, tiltTransform,
} from './tiltPreview.js';

describe('bounded photo tilt', () => {
  it('clamps large angles and resolves invalid input to the resting state', () => {
    expect(clampTilt(90)).toBe(TILT_MAX_DEGREES);
    expect(clampTilt(-90)).toBe(-TILT_MAX_DEGREES);
    expect(clampTilt(6)).toBe(6);
    expect(clampTilt(-6)).toBe(-6);
    expect(clampTilt(Number.NaN)).toBe(TILT_NONE);
    expect(clampTilt(Number.POSITIVE_INFINITY)).toBe(TILT_NONE);
  });

  it('steps to both bounds, disables outward movement, and permits a return to rest', () => {
    expect(nextTilt(TILT_NONE, 1)).toBe(TILT_STEP_DEGREES);
    expect(nextTilt(TILT_NONE, -1)).toBe(-TILT_STEP_DEGREES);
    let angle: number = TILT_NONE;
    for (let press = 0; press < 20; press += 1) angle = nextTilt(angle, 1);
    expect(angle).toBe(TILT_MAX_DEGREES);
    expect(canTilt(angle, 1)).toBe(false);
    expect(canTilt(angle, -1)).toBe(true);
    for (let press = 0; press < 40; press += 1) angle = nextTilt(angle, -1);
    expect(angle).toBe(-TILT_MAX_DEGREES);
    expect(canTilt(angle, -1)).toBe(false);
    expect(canTilt(angle, 1)).toBe(true);
    expect(nextTilt(TILT_STEP_DEGREES, -1)).toBe(TILT_NONE);
  });

  it('leaves a resting image unchanged and only applies bounded vertical rotation', () => {
    expect(tiltTransform(TILT_NONE)).toBe('none');
    expect(tiltTransform(Number.NaN)).toBe('none');
    const transform = tiltTransform(6);
    expect(transform).toContain('rotateY(6deg)');
    expect(transform).toContain('perspective(');
    expect(transform).not.toMatch(/scale|translate/);
    expect(tiltTransform(400)).toContain(`rotateY(${TILT_MAX_DEGREES}deg)`);
  });

  it('announces the direction and resting state consistently', () => {
    expect(isTilted(TILT_NONE)).toBe(false);
    expect(isTilted(6)).toBe(true);
    expect(isTilted(-6)).toBe(true);
    expect(tiltStatus(6)).toBe('Tilted 6 degrees right');
    expect(tiltStatus(-12)).toBe('Tilted 12 degrees left');
    expect(tiltStatus(TILT_NONE)).toBe('Flat — no tilt applied');
  });
});

describe('honest tilt descriptions', () => {
  it('does not claim a shared image source or a 3D model in its visible note', () => {
    const note = TILT_PREVIEW_NOTE.toLowerCase();
    // Live images and saved captures can both use this control.
    expect(note).not.toMatch(/captured|api result|youcam|generated|photograph/);
    expect(note).toContain('image shown on a ready card');
    expect(note).toContain('not a 3d model');
    expect(note).toContain('side or rear');
  });

  it('describes a transform rather than a new viewpoint in spoken status', () => {
    for (const angle of [TILT_NONE, 6, -6, TILT_MAX_DEGREES, -TILT_MAX_DEGREES]) {
      expect(tiltStatus(angle).toLowerCase()).not.toMatch(/view|side|rear|back|3d|angle of/);
    }
  });
});
