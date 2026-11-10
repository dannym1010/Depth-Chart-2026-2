import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGeminiMediaPrompt,
  COMMON_TEAM_COLORS,
  parseGeminiMediaResponse,
  SYSTEM_PROMPT,
  VALID_CATEGORIES,
} from './geminiMediaService.ts';
import { tierOfScore } from './mediaData.ts';

describe('Gemini Media AI Vision: Response Parser', () => {
  it('parses elite action photo with offense sub-category and high curation score', () => {
    const raw = {
      detected_jerseys: [
        { jersey: '21', confidence: 0.96, obscured: false },
        { jersey: '77', confidence: 0.85, obscured: false },
      ],
      primary_category: 'Action',
      sub_category: 'Offense',
      subject_count: 'group',
      quality_metrics: {
        sharpness_and_focus: 9.4,
        composition_and_framing: 9.0,
        storytelling_and_emotion: 9.2,
        player_isolation: 8.8,
      },
      curation_score: 9.2,
      curation_tier: 'Elite',
      curation_rationale: 'Crisp capture of the running back hitting the hole behind an explosive pull block.',
    };

    const res = parseGeminiMediaResponse(raw);
    assert.equal(res.category, 'Action');
    assert.equal(res.side, 'Offense');
    assert.equal(res.group, 'group');
    assert.equal(res.score, 9.2);
    assert.equal(res.tier, 'Elite');
    assert.equal(res.qualityMetrics.sharpness_and_focus, 9.4);
    assert.deepEqual(res.kids, ['21', '77']);
    assert.equal(res.curationRationale, 'Crisp capture of the running back hitting the hole behind an explosive pull block.');
  });

  it('correctly maps all 4 curation tiers according to wish list thresholds', () => {
    // Elite: 8.5 - 10.0
    const elite = parseGeminiMediaResponse({ curation_score: 8.8 });
    assert.equal(elite.tier, 'Elite');

    // Good: 6.5 - 8.4
    const good = parseGeminiMediaResponse({ curation_score: 7.2 });
    assert.equal(good.tier, 'Good');

    // Archive: 4.0 - 6.4
    const archive = parseGeminiMediaResponse({ curation_score: 5.5 });
    assert.equal(archive.tier, 'Archive');

    // Reject: 1.0 - 3.9
    const reject = parseGeminiMediaResponse({ curation_score: 2.5 });
    assert.equal(reject.tier, 'Reject');
  });

  it('handles string input with markdown formatting or embedded JSON', () => {
    const text = '```json\n{\n  "detected_jerseys": [{"jersey": "12", "confidence": 0.9}],\n  "primary_category": "Celebration",\n  "subject_count": "single",\n  "curation_score": 8.0,\n  "curation_rationale": "Great emotional moment celebrating a touchdown."\n}\n```';
    const res = parseGeminiMediaResponse(text);
    assert.equal(res.category, 'Celebration');
    assert.equal(res.group, 'single');
    assert.equal(res.tier, 'Good');
    assert.deepEqual(res.kids, ['12']);
  });

  it('prioritizes roster players and sorts known numbers first', () => {
    const raw = {
      detected_jerseys: [
        { jersey: '99', confidence: 0.8 },
        { jersey: '21', confidence: 0.9 },
        { jersey: '5', confidence: 0.85 },
      ],
      curation_score: 7.0,
    };
    const roster = [
      { num: '5', firstName: 'Eli', lastName: 'M' },
      { num: '21', firstName: 'Nash', lastName: 'W' },
    ];

    const res = parseGeminiMediaResponse(raw, roster);
    // 5 and 21 are on roster, 99 is not -> 5 and 21 appear before 99
    assert.deepEqual(res.kids, ['5', '21', '99']);
  });

  it('filters out low-confidence numbers to prevent false hallucinations', () => {
    const raw = {
      detected_jerseys: [
        { jersey: '21', confidence: 0.92 },
        { jersey: '88', confidence: 0.2 }, // Ambiguous/obscured
      ],
      curation_score: 7.5,
    };

    const res = parseGeminiMediaResponse(raw);
    assert.deepEqual(res.kids, ['21']);
    // But keeps raw detected jerseys for inspection
    assert.equal(res.detectedJerseys.length, 2);
    assert.equal(res.detectedJerseys[1].confidence, 0.2);
  });

  it('maps all categories correctly including Sidelines, Warmups, Coaches, Portraits', () => {
    for (const cat of VALID_CATEGORIES) {
      const res = parseGeminiMediaResponse({ primary_category: cat, curation_score: 7.0 });
      assert.equal(res.category, cat);
    }
  });

  it('calculates fallback curation score from quality metrics when curation_score is omitted', () => {
    const raw = {
      quality_metrics: {
        sharpness_and_focus: 9.0,
        storytelling_and_emotion: 9.0,
        composition_and_framing: 8.0,
        player_isolation: 8.0,
      },
    };
    const res = parseGeminiMediaResponse(raw);
    // 9*0.35 + 9*0.3 + 8*0.2 + 8*0.15 = 3.15 + 2.7 + 1.6 + 1.2 = 8.65 -> 8.7
    assert.equal(res.score, 8.7);
    assert.equal(res.tier, 'Elite');
  });

  it('validates categories against wish list constants', () => {
    assert.ok(VALID_CATEGORIES.includes('Action'));
    assert.ok(VALID_CATEGORIES.includes('Sidelines and huddles'));
    assert.ok(VALID_CATEGORIES.includes('Warmups'));
    assert.ok(VALID_CATEGORIES.includes('Celebration'));
    assert.ok(VALID_CATEGORIES.includes('Post-game'));
    assert.ok(VALID_CATEGORIES.includes('Coaches'));
    assert.ok(VALID_CATEGORIES.includes('Fans'));
    assert.ok(VALID_CATEGORIES.includes('Portraits'));
  });

  it('builds prompt with target uniform color and opponent exclusions', () => {
    const prompt = buildGeminiMediaPrompt({
      photoName: 'week3-action.jpg',
      roster: [{ num: '21', firstName: 'Danny' }],
      targetJerseyColor: 'Navy / Blue',
      opponentJerseyColor: 'Red',
    });
    assert.ok(prompt.includes('TARGET TEAM JERSEY COLOR: "Navy / Blue"'));
    assert.ok(prompt.includes('The OPPONENT team is wearing "Red" jerseys'));
    assert.ok(prompt.includes('ONLY tag and extract jersey numbers for players wearing Navy / Blue'));
    assert.ok(prompt.includes('#21 (Danny )'));
  });

  it('omits color filtering when color is set to Any', () => {
    const prompt = buildGeminiMediaPrompt({
      photoName: 'celebration.jpg',
      targetJerseyColor: 'Any',
    });
    assert.ok(!prompt.includes('CRITICAL TEAM UNIFORM COLOR FILTER'));
  });

  it('provides standard preset team colors including Mahopac Home and Away', () => {
    const values = COMMON_TEAM_COLORS.map((c) => c.value);
    assert.ok(values.includes('Navy / Blue'));
    assert.ok(values.includes('White'));
    assert.ok(values.includes('Gold / Yellow'));
    assert.ok(values.includes('Any'));
  });
});

