import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiErrorKind, cooldownFor, limitReason, mmssLeft } from './aiCooldown.ts';

describe('AI tagging cool down', () => {
  it('waits out limits, stops for the key, skips a bad photo', () => {
    assert.equal(aiErrorKind('Google Gemini error (402 Payment Required): Your Google AI Studio prepayment balance is depleted'), 'limit');
    assert.equal(aiErrorKind('AI Photo analysis failed: Gemini quota reached'), 'limit');
    assert.equal(aiErrorKind('AI Photo analysis failed: all models busy'), 'limit');
    assert.equal(aiErrorKind('Gemini (503): The model is overloaded'), 'limit');
    assert.equal(aiErrorKind('Google refused this Gemini API key. Check or re-paste your key in AI settings.'), 'key');
    assert.equal(aiErrorKind('No Gemini API key on this device.'), 'key');
    assert.equal(aiErrorKind('The image could not be decoded'), 'photo');
    assert.equal(aiErrorKind('AI Photo analysis failed: Failed to fetch'), 'limit');
    assert.equal(aiErrorKind('Sign in with Google to watch this film.'), 'signin');
    assert.equal(aiErrorKind('Your Google sign-in expired. Sign in again.'), 'signin');
    assert.match(limitReason('Failed to fetch'), /No internet/);
  });
  it('waits longer each time, then gives up', () => {
    assert.deepEqual([0, 1, 2, 3, 4].map(cooldownFor), [30, 60, 120, 300, null]);
    assert.equal(mmssLeft(65), '1:05');
    assert.equal(mmssLeft(0), '0:00');
    assert.match(limitReason('402 Payment Required'), /out of credits/);
  });
});
