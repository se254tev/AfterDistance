const scenarios = [
  {
    id: 'train',
    category: 'A quiet adventure',
    scenario: 'You are waiting at opposite ends of a midnight train. The doors close in one minute.',
    playerInfo: [
      'You know the final stop is a place you have both dreamed of visiting.',
      'You have a handwritten note tucked inside your bag with one last wish.'
    ],
    question: 'What do you do when the doors begin to close?',
    choices: ['Hold the doors and wait', 'Ride beside them', 'Leave a sign for later', 'Chase the train together']
  },
  {
    id: 'garden',
    category: 'A shared memory',
    scenario: 'A forgotten garden appears only on nights when it rains.',
    playerInfo: ['You remember planting something here.', 'You recognize the garden from a dream.'],
    question: 'Which flower do you choose for the first bloom?',
    choices: ['The wild rose', 'The silver orchid', 'The midnight jasmine', 'A seed you cannot name']
  },
  {
    id: 'city',
    category: 'The world outside',
    scenario: 'The city loses all power, leaving one rooftop visible beneath the stars.',
    playerInfo: ['You are holding a map with the way down.', 'You brought a small lantern and a blanket.'],
    question: 'How do you turn the outage into a memory?',
    choices: ['Share the view', 'Build a rooftop picnic', 'Call everyone you love', 'Wait for the first sunrise']
  },
  {
    id: 'letter',
    category: 'Words left unsaid',
    scenario: 'Two unopened letters arrive in the same unfamiliar handwriting.',
    playerInfo: ['One letter bears tomorrow’s date.', 'One letter smells faintly of home.'],
    question: 'Which letter do you open first?',
    choices: ['The one from tomorrow', 'The one that smells of home', 'Neither—open them together', 'Write another and begin']
  },
  {
    id: 'horizon',
    category: 'The long way home',
    scenario: 'At the edge of a harbor, a boat has room for only one journey.',
    playerInfo: ['You know exactly where the boat is going.', 'You brought only one warm coat.'],
    question: 'What journey do you choose?',
    choices: ['Toward familiar lights', 'Beyond the horizon', 'Back to where you began', 'Wherever the tide agrees']
  }
];

function createGame(roomId) {
  return {
    roomId, gameType: 'other-side', currentRound: 0, currentPhase: 'INTRODUCTION',
    playerStates: {}, scores: {}, readyForNext: {}, roundResults: [],
    startedAt: new Date().toISOString(), completedAt: null
  };
}

function publicRound(game) {
  const round = scenarios[game.currentRound];
  if (!round) return null;
  return { id: round.id, category: round.category, scenario: round.scenario, question: round.question, choices: round.choices };
}

function publicGame(game, sessionId) {
  return {
    gameType: game.gameType,
    currentRound: game.currentRound + 1,
    totalRounds: scenarios.length,
    currentPhase: game.currentPhase,
    round: publicRound(game),
    privateInfo: game.currentRound < scenarios.length ? scenarios[game.currentRound].playerInfo[game.playerStates[sessionId]?.seat || 0] : null,
    submittedAnswer: Boolean(game.playerStates[sessionId]?.answerSubmitted),
    submittedPrediction: Boolean(game.playerStates[sessionId]?.predictionSubmitted),
    readyForNext: Boolean(game.readyForNext[sessionId]),
    scores: game.scores,
    roundResults: game.currentPhase === 'ROUND_RESULTS' ? game.roundResults.at(-1) : null,
    completedAt: game.completedAt
  };
}

module.exports = { scenarios, createGame, publicGame, publicRound };
