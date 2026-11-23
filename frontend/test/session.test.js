import test from 'node:test';
import assert from 'node:assert/strict';
import { getStoredSession, saveStoredSession } from '../src/session.js';

test('session storage saves and restores room credentials', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); }
  };
  const session = { sessionId: 'guest-'.repeat(8), roomCode: 'ABCDEF123456', nickname: 'Alex' };
  assert.equal(saveStoredSession(session, storage), true);
  assert.deepEqual(getStoredSession(storage), session);
});

test('session storage safely handles malformed JSON', () => {
  const storage = { getItem() { return '{bad json'; } };
  assert.deepEqual(getStoredSession(storage), {});
});

test('session storage rejects incomplete sessions', () => {
  let written = false;
  const storage = { setItem() { written = true; } };
  assert.equal(saveStoredSession({ nickname: 'Alex' }, storage), false);
  assert.equal(written, false);
});
