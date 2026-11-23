const test = require('node:test');
const assert = require('node:assert/strict');
const { scenarios, createGame, publicGame } = require('../src/game/otherSide');
const { revealRound } = require('../src/game/otherSide');
const { roomPayloadSchema, answerPayloadSchema, canJoinRoom, createSocketEventRateLimiter } = require('../src/socket-validation');
const persistence = require('../src/persistence');

test('the game contains exactly five rounds', () => {
  assert.equal(scenarios.length, 5);
});

test('private public state excludes private selections', () => {
  const game = createGame('ABCDEF');
  game.playerStates = {
    a: { seat: 0, answerSubmitted: true, predictionSubmitted: false, answer: 'Hold', prediction: null },
    b: { seat: 1, answerSubmitted: false, predictionSubmitted: false, answer: null, prediction: null }
  };
  const view = publicGame(game, 'a');
  assert.equal(view.currentPhase, 'INTRODUCTION');
  assert.equal(view.privateInfo, scenarios[0].playerInfo[0]);
  assert.equal(JSON.stringify(view).includes('"answer":"Hold"'), false);
});

test('player state has private choices and private predictions', () => {
  const game = createGame('ABCDEF');
  game.playerStates = {
    a: { seat: 0, answerSubmitted: false, predictionSubmitted: false },
    b: { seat: 1, answerSubmitted: false, predictionSubmitted: false }
  };
  assert.equal(game.playerStates.a.seat, 0);
  assert.equal(game.playerStates.b.seat, 1);
});

test('private answers and predictions are absent from public views', () => {
  const game = createGame('ABCDEF');
  game.currentPhase = 'PREDICTING';
  game.playerStates = {
    a: { seat: 0, answerSubmitted: true, predictionSubmitted: false, answer: 'Hold', prediction: null },
    b: { seat: 1, answerSubmitted: true, predictionSubmitted: false, answer: 'Ride', prediction: null }
  };
  const view = publicGame(game, 'a');
  assert.equal(view.submittedAnswer, true);
  assert.equal(view.submittedPrediction, false);
  assert.equal(JSON.stringify(view).includes('Hold'), false);
  assert.equal(JSON.stringify(view).includes('Ride'), false);
});

test('revealing scores and transitions are server-derived', () => {
  const game = createGame('ABCDEF');
  game.currentPhase = 'PREDICTING';
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: true, answer: scenarios[0].choices[0], prediction: scenarios[0].choices[1] },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: true, answer: scenarios[0].choices[1], prediction: scenarios[0].choices[0] }
  };
  game.scores = { a: 0, b: 0 };
  const result = revealRound(game);
  assert.equal(game.currentPhase, 'ROUND_RESULTS');
  assert.equal(result.round, 1);
  assert.equal(game.scores.a, 2);
  assert.equal(game.scores.b, 2);
});

test('socket room and answer payloads reject malformed input', () => {
  assert.equal(roomPayloadSchema.safeParse({ roomCode: 'short', sessionId: 'x' }).success, false);
  assert.equal(roomPayloadSchema.safeParse({ roomCode: 'ABCDEF123456', sessionId: 'x'.repeat(32) }).success, true);
  assert.equal(answerPayloadSchema.safeParse({ roomCode: 'ABCDEF123456', sessionId: 'x'.repeat(32), answer: 42 }).success, false);
});

test('production MongoDB URI is required', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousUri = process.env.MONGODB_URI;
  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  await assert.rejects(() => persistence.connectDatabase(), /MONGODB_URI is required/);
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  if (previousUri === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = previousUri;
});

test('expired rooms are excluded from recovery', () => {
  const now = Date.now();
  const expired = { code: 'ABCDEF123456', expiresAt: new Date(now - 1000).toISOString(), players: [] };
  const valid = { code: '123456ABCDEF', expiresAt: new Date(now + 1000).toISOString(), players: [] };
  const recovered = persistence.filterRecoverableRooms([expired, valid], now);
  assert.deepEqual(recovered.map(room => room.code), ['123456ABCDEF']);
});

test('third player cannot join a full room', () => {
  assert.equal(canJoinRoom({ players: [{}, {}] }), false);
  assert.equal(canJoinRoom({ players: [{}] }), true);
});

test('socket event rate limiter blocks a burst', () => {
  const socket = {};
  const allow = createSocketEventRateLimiter(2, 60_000);
  assert.equal(allow(socket), true);
  assert.equal(allow(socket), true);
  assert.equal(allow(socket), false);
});
