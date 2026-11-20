import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sanitizeEmergencyContactName,
  sanitizeEmergencyContactNumber,
} from '../healthInfoInput.ts';

test('emergency contact names remove ASCII digits and respect the text limit', () => {
  assert.equal(sanitizeEmergencyContactName('Maria2 Santos9'), 'Maria Santos');
  assert.equal(sanitizeEmergencyContactName('A'.repeat(151)).length, 150);
});

test('emergency contact numbers retain only digits and at most 11 characters', () => {
  assert.equal(sanitizeEmergencyContactNumber('+63 (917) 123-4567'), '63917123456');
  assert.equal(sanitizeEmergencyContactNumber('09171234567890'), '09171234567');
  assert.equal(sanitizeEmergencyContactNumber('abc-()'), '');
});
