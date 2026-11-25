import test from 'node:test';
import assert from 'node:assert/strict';
import { clearStoredSession, getStoredSession, saveStoredSession } from '../src/session.js';

test('browser storage saves and restores only room recovery credentials', () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, value); }
  };
  const session = { sessionId: 'guest-'.repeat(8), roomCode: 'ABCDEF123456', nickname: 'Alex' };
  assert.equal(saveStoredSession(session, storage), true);
  assert.deepEqual(getStoredSession(storage), session);
  assert.equal(JSON.stringify([...values.values()]).includes('answer'), false);
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

test('legacy tab storage is migrated to durable browser storage', () => {
  const saved = new Map();
  const legacy = new Map([['ad-session', JSON.stringify({
    sessionId: 'guest-'.repeat(8), roomCode: 'ABCDEF123456', nickname: 'Alex'
  })]]);
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key) { return saved.get(key) || null; },
    setItem(key, value) { saved.set(key, value); },
    removeItem(key) { saved.delete(key); }
  } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem(key) { return legacy.get(key) || null; },
    removeItem(key) { legacy.delete(key); }
  } });
  try {
    assert.deepEqual(getStoredSession(), JSON.parse(legacy.get('ad-session')));
    assert.equal(saved.has('ad-session'), true);
    assert.equal(clearStoredSession(), true);
    assert.equal(saved.has('ad-session'), false);
    assert.equal(legacy.has('ad-session'), false);
  } finally {
    if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal);
    else delete globalThis.localStorage;
    if (originalSession) Object.defineProperty(globalThis, 'sessionStorage', originalSession);
    else delete globalThis.sessionStorage;
  }
});
