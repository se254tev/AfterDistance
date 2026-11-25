const test = require('node:test');
const assert = require('node:assert/strict');
const { findSessionMember } = require('../src/session-recovery');

test('session recovery requires a registered token matching the room player', () => {
  const room = {
    code: 'ABCDEF123456',
    players: [{ sessionId: 'guest-token', nickname: 'Alex' }]
  };
  const sessions = new Map([['guest-token', { roomCode: room.code, nickname: 'Alex' }]]);

  assert.equal(findSessionMember(room, sessions, 'guest-token'), room.players[0]);
  assert.equal(findSessionMember(room, sessions, 'unknown-token'), null);
  sessions.set('guest-token', { roomCode: 'OTHERROOM123', nickname: 'Alex' });
  assert.equal(findSessionMember(room, sessions, 'guest-token'), null);
  sessions.set('guest-token', { roomCode: room.code, nickname: 'Impersonator' });
  assert.equal(findSessionMember(room, sessions, 'guest-token'), null);
});
