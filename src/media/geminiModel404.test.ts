import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePhotoWithGemini, NO_MODELS_MESSAGE } from './geminiMediaService.ts';
import { aiErrorKind } from './aiCooldown.ts';

/** Gemini answers by model: a status and body for each one (missing = 404). */
function fakeGemini(answers: Record<string, { status: number; body: string }>) {
  const asked: string[] = [];
  globalThis.fetch = (async (url: string) => {
    const m = String(url).match(/models\/([^:]+):/)?.[1] || '';
    asked.push(m);
    const a = answers[m] || { status: 404, body: '{"error":{"code":404,"message":"models/' + m + ' is not found"}}' };
    return new Response(a.body, { status: a.status });
  }) as typeof fetch;
  return asked;
}

const photo = () => ({ driveId: 'p1', blob: new Blob([new Uint8Array(2000)], { type: 'image/jpeg' }), apiKey: 'k', modelName: 'gemini-flash-latest', targetJerseyColor: 'red', opponentJerseyColor: 'blue' });

describe('AI photo tagging when a model is retired (404)', () => {
  it('every model missing: stops with what to do, not a skipped photo', async () => {
    fakeGemini({});
    await assert.rejects(analyzePhotoWithGemini(photo()), (e: Error) => e.message === NO_MODELS_MESSAGE);
    assert.equal(aiErrorKind(NO_MODELS_MESSAGE), 'key');
  });

  it('a retired model doesn’t hide the real reason (out of quota), so the batch cools down', async () => {
    const asked = fakeGemini({ 'gemini-flash-latest': { status: 429, body: '{"error":{"code":429,"message":"quota"}}' }, 'gemini-flash-lite-latest': { status: 429, body: '{"error":{"code":429}}' } });
    await assert.rejects(analyzePhotoWithGemini(photo()), (e: Error) => aiErrorKind(e.message) === 'limit' && !/404/.test(e.message));
    assert.ok(asked.includes('gemini-2.5-flash'));
  });

  it('a model found missing isn’t asked again for the next photo', async () => {
    const ok = JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ kids: [], detected_jerseys: [], score: 7 }) }] } }] });
    const asked = fakeGemini({ 'gemini-flash-lite-latest': { status: 200, body: ok } });
    await analyzePhotoWithGemini({ ...photo(), modelName: 'gemini-2.5-flash' });
    assert.ok(!asked.includes('gemini-2.5-flash'), asked.join(','));
  });
});
