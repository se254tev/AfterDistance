const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scrubRoomForDeletedPlayer,
  scrubGameSession,
  scrubGameResult,
  canDeleteRoom
} = require('../src/privacy-actions');

const deletedId = 'guest-session-to-delete';
const retainedId = 'other-players-independent-session';

test('deleting one player removes their membership and shared in-progress game, not the other player', () => {
  const room = {
    code: 'ABCDEF123456',
    hostSessionId: deletedId,
    status: 'PLAYING',
    players: [
      { sessionId: deletedId, nickname: 'Delete this name', ready: true },
      { sessionId: retainedId, nickname: 'Keep this name', ready: true }
    ],
    game: {
      playerStates: { [deletedId]: { answer: 'private' }, [retainedId]: { answer: 'partner-private' } },
      scores: { [deletedId]: 4, [retainedId]: 7 }
    }
  };

  const result = scrubRoomForDeletedPlayer(room, deletedId);
  assert.equal(result.hostSessionId, retainedId);
  assert.deepEqual(result.players, [{ sessionId: retainedId, nickname: 'Keep this name', ready: false }]);
  assert.equal(result.status, 'WAITING_FOR_PLAYER');
  assert.equal(result.game, null);
});

test('all session-keyed game activity is removed while the other player record is preserved', () => {
  const result = {
    answers: { [deletedId]: 'private answer', [retainedId]: 'partner answer' },
    predictions: { [deletedId]: 'private prediction', [retainedId]: 'partner prediction' },
    answerStyles: { [deletedId]: 'private style', [retainedId]: 'partner style' },
    scores: { [deletedId]: 3, [retainedId]: 5 }
  };
  const session = scrubGameSession({
    playerStates: { [deletedId]: { answer: 'private answer' }, [retainedId]: { answer: 'partner answer' } },
    scores: { [deletedId]: 3, [retainedId]: 5 },
    roundResults: [result]
  }, deletedId);
  const sharedResult = scrubGameResult({
    sessionId: deletedId,
    players: [
      { sessionId: deletedId, nickname: 'Delete this name' },
      { sessionId: retainedId, nickname: 'Keep this name' }
    ],
    roundResults: [result],
    finalScores: { [deletedId]: 3, [retainedId]: 5 }
  }, deletedId);

  assert.equal(Object.hasOwn(session.playerStates, deletedId), false);
  assert.equal(Object.hasOwn(session.scores, deletedId), false);
  assert.deepEqual(session.roundResults[0].answers, { [retainedId]: 'partner answer' });
  assert.deepEqual(sharedResult.$set.players, [
    { sessionId: retainedId, nickname: 'Keep this name' },
    { nickname: 'Former player' }
  ]);
  assert.equal(Object.hasOwn(sharedResult.$set.roundResults[0].predictions, deletedId), false);
  assert.equal(Object.hasOwn(sharedResult.$set.finalScores, deletedId), false);
  assert.equal(Object.hasOwn(sharedResult.$unset, 'sessionId'), true);
  assert.equal(JSON.stringify(sharedResult).includes('private answer'), false);
  assert.equal(JSON.stringify(sharedResult).includes(deletedId), false);
});

test('deletion scrubbing is safe to repeat and shared game deletion requires creator authority', () => {
  const room = {
    hostSessionId: deletedId,
    players: [
      { sessionId: deletedId, nickname: 'Player A' },
      { sessionId: retainedId, nickname: 'Player B' }
    ],
    game: { playerStates: {} }
  };
  const once = scrubRoomForDeletedPlayer(room, deletedId);
  assert.equal(scrubRoomForDeletedPlayer(once, deletedId), once);
  assert.equal(canDeleteRoom(room, deletedId), true);
  assert.equal(canDeleteRoom(room, retainedId), false);
  assert.equal(canDeleteRoom(room, undefined), false);
});

const originalNodeEnv = process.env.NODE_ENV;
const originalMongoUri = process.env.MONGODB_URI;
process.env.NODE_ENV = 'test';
delete process.env.MONGODB_URI;
const { server } = require('../src/server');
const persistence = require('../src/persistence');
let origin;

function request(path, body) {
  return fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function createRoom() {
  const response = await request('/api/rooms', { nickname: 'Test host' });
  assert.equal(response.status, 201);
  return response.json();
}

test('HTTP deletion endpoints authenticate session ownership, preserve a partner, and restrict room deletion to its creator', {
  concurrency: false
}, async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const host = await createRoom();
    const joinedResponse = await request('/api/rooms/join', {
      nickname: 'Test partner',
      roomCode: host.roomCode
    });
    assert.equal(joinedResponse.status, 200);
    const partner = await joinedResponse.json();

    const unauthorized = await request('/api/privacy/delete-all-my-data', {
      sessionId: 'not-an-authenticated-session-token-000000000',
      roomCode: host.roomCode
    });
    assert.equal(unauthorized.status, 401);

    const personalDelete = await request('/api/privacy/delete-my-data', {
      sessionId: partner.sessionId,
      roomCode: host.roomCode,
      targetSessionId: host.sessionId
    });
    assert.equal(personalDelete.status, 200);
    const repeatedPersonalDelete = await request('/api/privacy/delete-my-data', {
      sessionId: partner.sessionId,
      roomCode: host.roomCode
    });
    assert.equal(repeatedPersonalDelete.status, 200);
    const retainedPlayer = await request('/api/sessions/resume', {
      sessionId: host.sessionId,
      roomCode: host.roomCode
    });
    assert.equal(retainedPlayer.status, 200);
    const deletedPlayer = await request('/api/sessions/resume', {
      sessionId: partner.sessionId,
      roomCode: host.roomCode
    });
    assert.equal(deletedPlayer.status, 401);

    const secondRoom = await createRoom();
    const secondPartnerResponse = await request('/api/rooms/join', {
      nickname: 'Another partner',
      roomCode: secondRoom.roomCode
    });
    const secondPartner = await secondPartnerResponse.json();
    const codeOnlyDelete = await request('/api/rooms/delete', { roomCode: secondRoom.roomCode });
    assert.equal(codeOnlyDelete.status, 400);
    const forbiddenDelete = await request('/api/rooms/delete', {
      sessionId: secondPartner.sessionId,
      roomCode: secondRoom.roomCode
    });
    assert.equal(forbiddenDelete.status, 403);
    const ownerDelete = await request('/api/rooms/delete', {
      sessionId: secondRoom.sessionId,
      roomCode: secondRoom.roomCode
    });
    assert.equal(ownerDelete.status, 200);
    const repeatedDelete = await request('/api/rooms/delete', {
      sessionId: secondRoom.sessionId,
      roomCode: secondRoom.roomCode
    });
    assert.equal(repeatedDelete.status, 200);

    const leaveRoom = await createRoom();
    const leaveResponse = await request('/api/rooms/leave', {
      sessionId: leaveRoom.sessionId,
      roomCode: leaveRoom.roomCode
    });
    assert.equal(leaveResponse.status, 200);
    const stillRecoverable = await request('/api/sessions/resume', {
      sessionId: leaveRoom.sessionId,
      roomCode: leaveRoom.roomCode
    });
    assert.equal(stillRecoverable.status, 200);

    const retryRoom = await createRoom();
    const originalDeletePersonalData = persistence.deletePersonalData;
    persistence.deletePersonalData = async () => {
      throw new Error('simulated database failure');
    };
    try {
      const failedDeletion = await request('/api/privacy/delete-all-my-data', {
        sessionId: retryRoom.sessionId,
        roomCode: retryRoom.roomCode
      });
      assert.equal(failedDeletion.status, 503);
      const blockedResume = await request('/api/sessions/resume', {
        sessionId: retryRoom.sessionId,
        roomCode: retryRoom.roomCode
      });
      assert.equal(blockedResume.status, 423);
    } finally {
      persistence.deletePersonalData = originalDeletePersonalData;
    }
    const retriedDeletion = await request('/api/privacy/delete-all-my-data', {
      sessionId: retryRoom.sessionId,
      roomCode: retryRoom.roomCode
    });
    assert.equal(retriedDeletion.status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  }
});
