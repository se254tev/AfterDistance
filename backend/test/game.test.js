const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scenarios,
  createGame,
  normalizeGameConfig,
  publicGame,
  revealRound,
  expireTimedPhase,
  awardCompletionAchievements
} = require('../src/game/otherSide');
const {
  roomPayloadSchema,
  answerPayloadSchema,
  gameConfigSchema,
  experienceSwitchRequestSchema,
  canJoinRoom,
  createSocketEventRateLimiter
} = require('../src/socket-validation');
const persistence = require('../src/persistence');
const { GameResult } = require('../src/models');
const { questionBank, getOptions, localize } = require('../src/game/content');

test('the game contains exactly five rounds', () => {
  assert.equal(scenarios.length, 5);
  const first = createGame('ABCDEF');
  const second = createGame('ABCDEF');
  assert.equal(first.rounds.length, 5);
  assert.notEqual(first.gameId, second.gameId);
});

test('completed results expose both players’ round results without exposing session identifiers', () => {
  const game = createGame('ABCDEF');
  const firstSession = 'first-player-private-session';
  const secondSession = 'second-player-private-session';
  game.currentPhase = 'COMPLETED';
  game.playerStates = {
    [firstSession]: { sessionId: firstSession, seat: 0, achievements: [] },
    [secondSession]: { sessionId: secondSession, seat: 1, achievements: [] }
  };
  game.scores = { [firstSession]: 7, [secondSession]: 4 };
  game.roundResults = [{
    round: 1,
    answers: { [firstSession]: 'answer one', [secondSession]: 'answer two' },
    predictions: { [firstSession]: 'prediction one', [secondSession]: 'prediction two' },
    scores: { [firstSession]: 2, [secondSession]: 1 },
    answerStyles: {},
    explanation: 'A shared result'
  }];
  const view = publicGame(game, firstSession);
  assert.equal(view.scores.you, 7);
  assert.equal(view.completedResults[0].yourAnswer, 'answer one');
  assert.equal(view.completedResults[0].partnerAnswer, 'answer two');
  assert.equal(JSON.stringify(view).includes(firstSession), false);
  assert.equal(JSON.stringify(view).includes(secondSession), false);
});

test('all four Kenyan modes select five unique questions from the requested mode', () => {
  for (const mode of ['comedy', 'romance', 'savage', 'mind-reader']) {
    const game = createGame('ABCDEF', {
      experience: 'kenyan',
      mode,
      category: 'mixed',
      pack: 'mixed',
      language: 'mixed',
      timerSeconds: 15
    }, [], () => 0.5);
    assert.equal(game.rounds.length, 5);
    assert.equal(new Set(game.rounds.map(round => round.id)).size, 5);
    assert.ok(game.rounds.every(round =>
      questionBank.find(question => question.id === round.id).modes.includes(mode)
    ));
  }
});

test('Kenyan category, pack, and language settings are honored', () => {
  const options = getOptions();
  for (const pack of ['matatu-madness', 'choma-na-story', 'campus-chronicles', 'nairobi-vibes', 'mapenzi-na-drama', 'sheng-central']) {
    assert.ok(options.categoryCompatibility[`comedy:${pack}`].includes('mixed'));
    const game = createGame('ABCDEF', {
      experience: 'kenyan', mode: 'comedy', category: 'mixed', pack, language: 'swahili', timerSeconds: 0
    }, [], () => 0.5);
    assert.ok(game.rounds.every(round => questionBank.find(question => question.id === round.id).pack === pack));
    assert.ok(game.rounds.every(round => typeof round.question === 'string'));
  }

  const invalid = { experience: 'kenyan', mode: 'romance', category: 'truth-bluff', pack: 'mixed', language: 'mixed', timerSeconds: 15 };
  assert.throws(() => normalizeGameConfig(invalid), /combination is unavailable/);
  assert.equal(gameConfigSchema.safeParse(invalid).success, false);
});

test('every Kenyan category supplies five unique rounds without silently switching category', () => {
  for (const category of [
    'funny-predictions',
    'complete-story',
    'truth-bluff',
    'who-more-likely',
    'sheng-battle',
    'romantic-comedy',
    'mini-challenge'
  ]) {
    const game = createGame('ABCDEF', {
      experience: 'kenyan', mode: 'comedy', category, pack: 'mixed', language: 'mixed', timerSeconds: 0
    }, [], () => 0.5);
    assert.equal(game.rounds.length, 5);
    assert.equal(new Set(game.rounds.map(round => round.id)).size, 5);
    assert.ok(game.rounds.every(round =>
      questionBank.find(question => question.id === round.id).category === category
    ));
  }
});

test('both players receive the same selected localized question', () => {
  const game = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'comedy', category: 'mixed', pack: 'mixed', language: 'sheng', timerSeconds: 15
  }, [], () => 0.5);
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: false, predictionSubmitted: false },
    b: { sessionId: 'b', seat: 1, answerSubmitted: false, predictionSubmitted: false }
  };
  const a = publicGame(game, 'a');
  const b = publicGame(game, 'b');
  assert.deepEqual(a.round, b.round);
  assert.equal(a.round.question, game.rounds[0].question);
});

test('all supported languages localize the selected prompt and choices', () => {
  for (const language of ['english', 'swahili', 'sheng', 'mixed']) {
    const game = createGame('ABCDEF', {
      experience: 'kenyan', mode: 'comedy', category: 'sheng-battle', pack: 'sheng-central', language, timerSeconds: 0
    }, [], () => 0.5);
    const question = questionBank.find(item => item.id === game.rounds[0].id);
    assert.equal(game.rounds[0].question, localize(question.prompt, language));
    assert.deepEqual(game.rounds[0].choices, question.choices[language]);
  }
  assert.equal(normalizeGameConfig({ experience: 'kenyan' }).language, 'mixed');
});

test('replays retain configuration and do not repeat questions while unseen content remains', () => {
  const config = {
    experience: 'kenyan', mode: 'comedy', category: 'mixed', pack: 'mixed', language: 'mixed', timerSeconds: 15
  };
  const first = createGame('ABCDEF', config, [], () => 0.5);
  const replay = createGame('ABCDEF', config, first.usedQuestionIds, () => 0.5);
  assert.deepEqual(replay.config, first.config);
  assert.equal(replay.rounds.length, 5);
  assert.ok(replay.rounds.every(round => !first.usedQuestionIds.includes(round.id)));
});

test('surprise round is selected by the server and marked in the public round', () => {
  const game = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'comedy', category: 'mixed', pack: 'mixed', language: 'mixed', timerSeconds: 15
  }, [], () => 0);
  assert.equal(game.rounds.filter(round => round.isSurpriseRound).length, 1);
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: false, predictionSubmitted: false },
    b: { sessionId: 'b', seat: 1, answerSubmitted: false, predictionSubmitted: false }
  };
  assert.equal(publicGame(game, 'a').round.isSurpriseRound, true);
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
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: false, answer: 'private-choice-a', prediction: null },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: false, answer: 'private-choice-b', prediction: null }
  };
  const view = publicGame(game, 'a');
  assert.equal(view.submittedAnswer, true);
  assert.equal(view.submittedPrediction, false);
  assert.equal(JSON.stringify(view).includes('private-choice-a'), false);
  assert.equal(JSON.stringify(view).includes('private-choice-b'), false);
});

test('revealing scores and transitions are server-derived', () => {
  const game = createGame('ABCDEF');
  const choices = game.rounds[0].choices;
  game.currentPhase = 'PREDICTING';
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: true, answer: choices[0], prediction: choices[1] },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: true, answer: choices[1], prediction: choices[0] }
  };
  game.scores = { a: 0, b: 0 };
  const result = revealRound(game);
  assert.equal(game.currentPhase, 'ROUND_RESULTS');
  assert.equal(result.round, 1);
  assert.equal(game.scores.a, 2);
  assert.equal(game.scores.b, 2);
});

test('reveal calculates points for asymmetric predictions', () => {
  const game = createGame('ABCDEF');
  const choices = game.rounds[0].choices;
  game.currentPhase = 'PREDICTING';
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: true, answer: choices[0], prediction: choices[2] },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: true, answer: choices[1], prediction: choices[3] }
  };
  game.scores = { a: 0, b: 0 };
  revealRound(game);
  assert.equal(game.scores.a, 0);
  assert.equal(game.scores.b, 0);
});

test('public game projection hides session ids and private selections', () => {
  const game = createGame('ABCDEF');
  game.currentPhase = 'PREDICTING';
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: false, answer: 'secret-a', prediction: null },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: false, answer: 'secret-b', prediction: null }
  };
  game.scores = { a: 1, b: 2 };
  const view = publicGame(game, 'a');
  const serialized = JSON.stringify(view);
  assert.equal(serialized.includes('secret-a'), false);
  assert.equal(serialized.includes('secret-b'), false);
  assert.equal(view.scores.you, 1);
  assert.equal(view.scores.partner, 2);
});

test('quiz scoring is calculated on the server and only revealed after both predictions', () => {
  const game = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'comedy', category: 'sheng-battle', pack: 'mixed', language: 'english', timerSeconds: 0
  }, [], () => 0.5);
  const round = game.rounds[0];
  assert.equal(round.answerType, 'quiz');
  game.currentPhase = 'PREDICTING';
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: true, answer: round.choices[round.correctChoiceIndex], answerIndex: round.correctChoiceIndex, prediction: 'same-answer' },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: true, answer: round.choices[0], answerIndex: 0, prediction: 'same-answer' }
  };
  game.scores = { a: 0, b: 0 };
  const privateView = publicGame(game, 'a');
  assert.equal(Object.hasOwn(privateView.round, 'correctChoiceIndex'), false);
  game.playerStates.a.prediction = round.choices[1];
  game.playerStates.b.answer = round.choices[1];
  game.playerStates.b.answerIndex = 1;
  game.playerStates.b.prediction = round.choices[0];
  const result = revealRound(game);
  assert.equal(result.correctAnswer, round.choices[round.correctChoiceIndex]);
  assert.equal(game.scores.a, 3);
  assert.equal(game.scores.b, 2);
});

test('answer and prediction timer expiry advances phases and marks unanswered players', () => {
  const game = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'comedy', category: 'mixed', pack: 'mixed', language: 'mixed', timerSeconds: 10
  }, [], () => 0.5);
  const now = Date.now();
  game.currentPhase = 'ANSWERING';
  game.deadlineAt = now - 1;
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, answer: game.rounds[0].choices[0], predictionSubmitted: false },
    b: { sessionId: 'b', seat: 1, answerSubmitted: false, answer: null, predictionSubmitted: false }
  };
  assert.equal(expireTimedPhase(game, now), 'PREDICTING');
  assert.equal(game.playerStates.b.answerSubmitted, true);
  assert.equal(game.playerStates.b.answer, null);
  assert.equal(game.deadlineAt, now + 10_000);

  game.deadlineAt = now - 1;
  game.playerStates.a.predictionSubmitted = true;
  game.playerStates.a.prediction = game.rounds[0].choices[0];
  game.playerStates.b.predictionSubmitted = false;
  assert.equal(expireTimedPhase(game, now), 'REVEALING');
  assert.equal(game.playerStates.b.predictionSubmitted, true);
  assert.equal(game.playerStates.b.prediction, null);
  revealRound(game);
  assert.equal(game.currentPhase, 'ROUND_RESULTS');
});

test('romance achievement requires a recorded correct prediction and game completion', () => {
  const game = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'romance', category: 'mixed', pack: 'mixed', language: 'mixed', timerSeconds: 0
  }, [], () => 0.5);
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, achievements: [], achievementProgress: { correctPredictions: 1, actionTags: {}, nairobiRounds: 0 } },
    b: { sessionId: 'b', seat: 1, achievements: [], achievementProgress: { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 } }
  };
  awardCompletionAchievements(game);
  assert.ok(game.playerStates.a.achievements.includes('romantic-comedian'));
  assert.deepEqual(game.playerStates.b.achievements, []);
});

test('achievements are awarded from recorded game answers and predictions', () => {
  const game = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'comedy', category: 'funny-predictions', pack: 'mixed', language: 'mixed', timerSeconds: 0
  }, [], () => 0.5);
  game.playerStates = {
    a: { sessionId: 'a', seat: 0, achievements: [], achievementProgress: { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 } },
    b: { sessionId: 'b', seat: 1, achievements: [], achievementProgress: { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 } }
  };
  game.scores = { a: 0, b: 0 };
  for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
    game.currentRound = roundIndex;
    game.currentPhase = 'PREDICTING';
    const choice = game.rounds[roundIndex].choices[0];
    game.playerStates.a.answer = choice;
    game.playerStates.b.answer = choice;
    game.playerStates.a.answerIndex = 0;
    game.playerStates.b.answerIndex = 0;
    game.playerStates.a.prediction = choice;
    game.playerStates.b.prediction = choice;
    game.playerStates.a.answerSubmitted = true;
    game.playerStates.b.answerSubmitted = true;
    game.playerStates.a.predictionSubmitted = true;
    game.playerStates.b.predictionSubmitted = true;
    revealRound(game);
  }
  assert.ok(game.playerStates.a.achievements.includes('professional-overthinker'));

  const story = createGame('ABCDEF', {
    experience: 'kenyan', mode: 'comedy', category: 'complete-story', pack: 'mixed', language: 'mixed', timerSeconds: 0
  }, [], () => 0.5);
  story.currentPhase = 'PREDICTING';
  story.playerStates = {
    a: { sessionId: 'a', seat: 0, answerSubmitted: true, predictionSubmitted: true, answer: 'A plot twist changed everything.', answerStyle: story.rounds[0].predictionChoices[0], prediction: story.rounds[0].predictionChoices[0], achievements: [] },
    b: { sessionId: 'b', seat: 1, answerSubmitted: true, predictionSubmitted: true, answer: 'A plot twist changed everything.', answerStyle: story.rounds[0].predictionChoices[0], prediction: story.rounds[0].predictionChoices[0], achievements: [] }
  };
  story.scores = { a: 0, b: 0 };
  revealRound(story);
  assert.ok(story.playerStates.a.achievements.includes('msee-wa-story'));
});
test('socket room and answer payloads reject malformed input', () => {
  assert.equal(roomPayloadSchema.safeParse({ roomCode: 'short', sessionId: 'x' }).success, false);
  assert.equal(roomPayloadSchema.safeParse({ roomCode: 'ABCDEF123456', sessionId: 'x'.repeat(32) }).success, true);
  assert.equal(answerPayloadSchema.safeParse({ roomCode: 'ABCDEF123456', sessionId: 'x'.repeat(32), answer: 42 }).success, false);
  const switchRequest = {
    roomCode: 'ABCDEF123456',
    sessionId: 'x'.repeat(32),
    kind: 'switch',
    config: { experience: 'classic', mode: 'classic', category: 'classic', pack: 'mixed', language: 'english', timerSeconds: 0 }
  };
  assert.equal(experienceSwitchRequestSchema.safeParse(switchRequest).success, true);
  assert.equal(experienceSwitchRequestSchema.safeParse({
    roomCode: switchRequest.roomCode,
    sessionId: switchRequest.sessionId,
    kind: 'switch'
  }).success, false);
  assert.equal(experienceSwitchRequestSchema.safeParse({
    roomCode: switchRequest.roomCode,
    sessionId: switchRequest.sessionId,
    kind: 'replay'
  }).success, true);
});

test('experience catalog reports only implemented experiences as available', () => {
  const options = getOptions();
  assert.ok(options.experiences.length > 0);
  assert.ok(options.experiences.every(experience =>
    typeof experience.description === 'string'
    && typeof experience.category === 'string'
    && Array.isArray(experience.modes)
    && Array.isArray(experience.languages)
    && experience.available === true
  ));
});

test('completed results are uniquely keyed by game session, not by room', () => {
  const indexes = GameResult.schema.indexes();
  assert.ok(indexes.some(([keys, options]) =>
    keys.gameId === 1 && options.unique && options.sparse
  ));
  assert.equal(indexes.some(([keys, options]) => keys.roomCode === 1 && options.unique), false);
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
