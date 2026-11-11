import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encoderQuality, qualitySizes } from './videoQuality.ts';

describe('video quality', () => {
  it('Quick is 720p, Standard 1080p, Best 4K only where a wide video allows it', () => {
    assert.deepEqual(qualitySizes(1920, 1080, 'quick')[0], { w: 1280, h: 720 });
    assert.deepEqual(qualitySizes(1920, 1080, 'standard')[0], { w: 1920, h: 1080 });
    assert.deepEqual(qualitySizes(1920, 1080, 'best', true)[0], { w: 3840, h: 2160 });
    assert.deepEqual(qualitySizes(1080, 1920, 'best')[0], { w: 1080, h: 1920 });
    // Each falls back to smaller sizes for older devices.
    assert.deepEqual(qualitySizes(1080, 1350, 'standard')[1], { w: 720, h: 900 });
    assert.equal(encoderQuality({ QUALITY_MEDIUM: 'm', QUALITY_HIGH: 'h', QUALITY_VERY_HIGH: 'vh' }, 'best'), 'vh');
  });
});
