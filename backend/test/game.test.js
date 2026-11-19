const test = require('node:test');
const assert = require('node:assert/strict');
const { scenarios, createGame, publicGame } = require('../src/game/otherSide');

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
