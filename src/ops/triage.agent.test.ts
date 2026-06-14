/**
 * Tests for the ops triage agent — Sprint 10
 * ============================================================================
 * Covers the JSON parsing, normalization, and feature-request text
 * guard. The full triage flow (DB + Anthropic API) is tested at the
 * service integration level in fix-pipeline.service.test.ts.
 * ============================================================================
 */

import { __test__ } from './triage.agent';

describe('triage.agent: JSON parser', () => {
  it('parses plain JSON object', () => {
    const out = __test__.parseTriageJson('{"classification":"user_error","confidence":85,"userFacingMessage":"try this","internalNotes":"n"}');
    expect(out).not.toBeNull();
    expect(out!.classification).toBe('user_error');
    expect(out!.confidence).toBe(85);
  });

  it('parses JSON wrapped in a markdown fence', () => {
    const text = 'Here is the result:\n```json\n{"classification":"data_fix","confidence":92,"userFacingMessage":"fixed","internalNotes":"x","suggestedFix":"x"}\n```';
    const out = __test__.parseTriageJson(text);
    expect(out).not.toBeNull();
    expect(out!.classification).toBe('data_fix');
    expect(out!.suggestedFix).toBe('x');
  });

  it('returns null on invalid input', () => {
    expect(__test__.parseTriageJson('not json at all')).toBeNull();
    expect(__test__.parseTriageJson('{"wrong":"shape"}')).toBeNull();
  });

  it('clamps confidence to 0-100', () => {
    const a = __test__.parseTriageJson('{"classification":"code_change","confidence":150,"userFacingMessage":"x","internalNotes":"x"}');
    expect(a!.confidence).toBe(100);
    const b = __test__.parseTriageJson('{"classification":"code_change","confidence":-50,"userFacingMessage":"x","internalNotes":"x"}');
    expect(b!.confidence).toBe(0);
  });
});

describe('triage.agent: classification normalization', () => {
  it.each([
    ['user_error', 'user_error'],
    ['USER_ERROR', 'user_error'],
    ['User Error', 'user_error'],
    ['user-error', 'user_error'],
    ['feature_request', 'feature_request'],
    ['data_fix', 'data_fix'],
    ['code_change', 'code_change'],
    ['unknown', null],
  ])('normalizes %p → %p', (input, expected) => {
    expect(__test__.normalizeClassification(input)).toBe(expected);
  });
});

describe('triage.agent: FEATURE_REQUEST text guard', () => {
  it('uses the exact required text', () => {
    expect(__test__.FEATURE_REQUEST_REQUIRED_TEXT).toBe(
      'That is a cool idea for a new feature. Let me see if this is possible for a future build.'
    );
  });
});

describe('triage.agent: sanitization', () => {
  it('sanitizes PII and tokens out of user input', () => {
    const input = 'I tried to log in with Bearer abc123def456ghi789== and got an error at user@example.com';
    const out = __test__.sanitizeTriageInput(input);
    expect(out).not.toContain('abc123def456ghi789');
    expect(out).toContain('[redacted-email]');
    expect(out).toContain('Bearer [redacted]');
  });

  it('strips credit card shaped digit runs', () => {
    const out = __test__.sanitizeTriageInput('charged 4111 1111 1111 1111 twice');
    expect(out).toContain('[redacted-cc]');
  });

  it('strips JWT-shaped tokens', () => {
    const jwt = 'eyJabcdefghij.eyJklmnopqrst.signatureVALUE1234567890';
    const out = __test__.sanitizeTriageInput(`auth was ${jwt}`);
    expect(out).toContain('[redacted-jwt]');
  });
});
