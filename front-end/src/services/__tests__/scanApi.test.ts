/**
 * Scan confidence helpers (FDA match stays distinct from safety trust).
 * Run with: npm --prefix front-end run test:scan
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getConfidenceTier,
  type ConfidenceTelemetry,
} from '../scanConfidence.ts';

test('getConfidenceTier prefers trust_score thresholds over reported tiers', () => {
  assert.equal(getConfidenceTier({ trust_score: 0.9, confidence_tier: 'low' }), 'high');
  assert.equal(getConfidenceTier({ trust_score: 0.7 }), 'medium');
  assert.equal(getConfidenceTier({ trust_score: 0.4 }), 'low');
});

test('getConfidenceTier falls back to confidence_tier then trust_tier', () => {
  assert.equal(getConfidenceTier({ confidence_tier: 'high' }), 'high');
  assert.equal(getConfidenceTier({ trust_tier: 'medium' }), 'medium');
  assert.equal(getConfidenceTier({ confidence_tier: 'low' }), 'low');
});

test('getConfidenceTier uses dosage_match_status when no trust signal exists', () => {
  assert.equal(getConfidenceTier({ dosage_match_status: 'mismatch' }), 'low');
  assert.equal(getConfidenceTier({ dosage_match_status: 'dosage_conflict' }), 'low');
  assert.equal(getConfidenceTier({ dosage_match_status: 'not_detected' }), 'medium');
  assert.equal(getConfidenceTier({ dosage_match_status: 'missing_dosage' }), 'medium');
  assert.equal(getConfidenceTier({ dosage_match_status: 'unverified' }), 'medium');
  assert.equal(getConfidenceTier({}), null);
});

test('FDA match score stays distinct from safety trust in telemetry shape', () => {
  const telemetry: ConfidenceTelemetry = {
    fda_match_score: 0.95,
    trust_score: 0.6,
    confidence_tier: 'high',
  };
  assert.equal(telemetry.fda_match_score, 0.95);
  // Safety trust (0.60) maps to low even when FDA match is high.
  assert.equal(getConfidenceTier(telemetry), 'low');
});
