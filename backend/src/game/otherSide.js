const {
  ACHIEVEMENTS,
  createRounds,
  getRevealMessage,
  getOptions,
  getCompatibleCategories,
  localize
} = require('./content');

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

const MODES = new Set(['classic', 'comedy', 'romance', 'savage', 'mind-reader']);
const PACKS = new Set(['mixed', 'matatu-madness', 'choma-na-story', 'campus-chronicles', 'nairobi-vibes', 'mapenzi-na-drama', 'sheng-central']);
const CATEGORIES = new Set(['classic', 'mixed', 'funny-predictions', 'complete-story', 'truth-bluff', 'who-more-likely', 'sheng-battle', 'romantic-comedy', 'mini-challenge']);
const LANGUAGES = new Set(['english', 'swahili', 'sheng', 'mixed']);
const TIMER_VALUES = new Set([0, 10, 15, 20]);

function normalizeGameConfig(input = {}) {
  const experience = input.experience === undefined ? 'classic' : input.experience;
  if (!['classic', 'kenyan'].includes(experience)) {
    throw new Error('Invalid game configuration');
  }
  const defaults = experience === 'kenyan'
    ? { mode: 'comedy', category: 'mixed', pack: 'mixed', language: 'mixed', timerSeconds: 15 }
    : { mode: 'classic', category: 'classic', pack: 'mixed', language: 'english', timerSeconds: 0 };
  const config = {
    experience,
    mode: input.mode || defaults.mode,
    category: input.category || defaults.category,
    pack: input.pack || defaults.pack,
    language: input.language || defaults.language,
    timerSeconds: input.timerSeconds === undefined ? defaults.timerSeconds : input.timerSeconds
  };
  if (!MODES.has(config.mode) || !CATEGORIES.has(config.category) ||
      !PACKS.has(config.pack) || !LANGUAGES.has(config.language) ||
      !TIMER_VALUES.has(config.timerSeconds)) {
    throw new Error('Invalid game configuration');
  }
  if (experience === 'classic') {
    config.mode = 'classic';
    config.category = 'classic';
  } else if (!getCompatibleCategories(config.mode, config.pack).includes(config.category)) {
    throw new Error('This game mode, category, and content pack combination is unavailable');
  }
  return config;
}

function createGame(roomId, configInput, previousQuestionIds = [], random = Math.random) {
  const config = normalizeGameConfig(configInput);
  const rounds = createRounds(scenarios, config, previousQuestionIds, random);
  return {
    roomId,
    gameType: config.experience === 'classic' ? 'other-side' : 'kenyan-comedy',
    config,
    rounds,
    usedQuestionIds: rounds.map(round => round.id),
    currentRound: 0,
    currentPhase: 'INTRODUCTION',
    deadlineAt: null,
    playerStates: {},
    scores: {},
    readyForNext: {},
    roundResults: [],
    startedAt: new Date().toISOString(), completedAt: null
  };
}

function getCurrentRound(game) {
  return game.rounds?.[game.currentRound] || scenarios[game.currentRound] || null;
}

function publicRound(game) {
  const round = getCurrentRound(game);
  if (!round) return null;
  return {
    id: round.id,
    category: round.category,
    scenario: round.scenario,
    question: round.question,
    choices: round.choices || [],
    predictionChoices: round.predictionChoices || round.choices || [],
    answerType: round.answerType || 'choice',
    timerSeconds: round.timerSeconds || 0,
    isSurpriseRound: Boolean(round.isSurpriseRound)
  };
}

function publicGame(game, sessionId) {
  const ownState = game.playerStates[sessionId];
  const partnerState = Object.values(game.playerStates).find(state => state.sessionId !== sessionId);
  const currentRound = getCurrentRound(game);
  const latestResult = game.currentPhase === 'ROUND_RESULTS'
    ? game.roundResults.at(-1)
    : null;
  const roundResults = latestResult && ownState && partnerState ? {
    round: latestResult.round,
    yourAnswer: latestResult.answers[sessionId],
    partnerAnswer: latestResult.answers[partnerState.sessionId],
    yourPrediction: latestResult.predictions[sessionId],
    partnerPrediction: latestResult.predictions[partnerState.sessionId],
    yourRoundPoints: latestResult.scores[sessionId],
    partnerRoundPoints: latestResult.scores[partnerState.sessionId],
    explanation: latestResult.explanation,
    message: latestResult.message,
    correctAnswer: latestResult.correctAnswer,
    yourAnswerStyle: latestResult.answerStyles?.[sessionId] || null,
    partnerAnswerStyle: latestResult.answerStyles?.[partnerState.sessionId] || null
  } : null;

  return {
    gameType: game.gameType,
    config: game.config,
    currentRound: game.currentRound + 1,
    totalRounds: game.rounds?.length || scenarios.length,
    currentPhase: game.currentPhase,
    round: publicRound(game),
    privateInfo: currentRound?.privateInfo?.[ownState?.seat || 0]
      ?? (game.config?.experience !== 'kenyan' && game.currentRound < scenarios.length
        ? scenarios[game.currentRound].playerInfo[ownState?.seat || 0]
        : null),
    submittedAnswer: Boolean(ownState?.answerSubmitted),
    submittedPrediction: Boolean(ownState?.predictionSubmitted),
    readyForNext: Boolean(game.readyForNext[sessionId]),
    deadlineAt: game.deadlineAt,
    serverNow: Date.now(),
    achievements: (ownState?.achievements || [])
      .map(id => ACHIEVEMENTS.find(achievement => achievement.id === id))
      .filter(Boolean)
      .map(achievement => ({
        ...achievement,
        label: localize(achievement.label, game.config?.language || 'mixed'),
        description: localize(achievement.description, game.config?.language || 'mixed')
      })),
    scores: ownState && partnerState ? {
      you: game.scores[sessionId] || 0,
      partner: game.scores[partnerState.sessionId] || 0
    } : null,
    roundResults,
    completedAt: game.completedAt
  };
}

function addAchievement(player, id) {
  player.achievements ||= [];
  if (!player.achievements.includes(id)) player.achievements.push(id);
}

function awardRoundAchievements(game, player, round, correctPrediction) {
  player.achievementProgress ||= { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 };
  const progress = player.achievementProgress;
  if (correctPrediction) progress.correctPredictions += 1;
  if (progress.correctPredictions >= 3) addAchievement(player, 'professional-overthinker');

  const choiceIndex = player.answerIndex ?? round.choices?.indexOf(player.answer);
  const activeTags = player.answerSubmitted && player.answer !== null
    ? [...(round.tags || []), ...((round.choiceTags || {})[choiceIndex] || [])]
    : [];
  const selfChoice = round.choices?.[choiceIndex] === `PLAYER_${player.seat + 1}`;
  for (const tag of activeTags) {
    if ((tag === 'sleep' || tag === 'budget') && !selfChoice) continue;
    if (tag === 'excuses' && choiceIndex !== 0) continue;
    progress.actionTags[tag] = (progress.actionTags[tag] || 0) + 1;
  }
  if (progress.actionTags.drama >= 2) addAchievement(player, 'ceo-wa-drama');
  if (progress.actionTags.sleep >= 1) addAchievement(player, 'certified-sleep-champion');
  if (progress.actionTags.budget >= 1) addAchievement(player, 'budget-minister');
  if (progress.actionTags.excuses >= 1) addAchievement(player, 'master-wa-excuses');
  if (round.answerType === 'text' && player.answer?.trim().length >= 20) {
    addAchievement(player, 'msee-wa-story');
  }
  if (activeTags.includes('nairobi')) progress.nairobiRounds += 1;
}

function revealRound(game) {
  const entries = Object.values(game.playerStates);
  if (entries.length !== 2) return null;
  const [a, b] = entries;
  const round = getCurrentRound(game);
  const answerForPrediction = player => round.answerType === 'text' ? player.answerStyle : player.answer;
  const predictionCorrectA = Boolean(a.prediction && a.prediction === answerForPrediction(b));
  const predictionCorrectB = Boolean(b.prediction && b.prediction === answerForPrediction(a));
  const sharedPredictionPoints = Number(predictionCorrectA) + Number(predictionCorrectB);
  const answerIndexA = a.answerIndex ?? round.choices?.indexOf(a.answer);
  const answerIndexB = b.answerIndex ?? round.choices?.indexOf(b.answer);
  const quizPointsA = round.answerType === 'quiz' && answerIndexA === round.correctChoiceIndex ? 1 : 0;
  const quizPointsB = round.answerType === 'quiz' && answerIndexB === round.correctChoiceIndex ? 1 : 0;
  const pointsA = sharedPredictionPoints + quizPointsA;
  const pointsB = sharedPredictionPoints + quizPointsB;
  game.scores[a.sessionId] = (game.scores[a.sessionId] || 0) + pointsA;
  game.scores[b.sessionId] = (game.scores[b.sessionId] || 0) + pointsB;
  awardRoundAchievements(game, a, round, predictionCorrectA);
  awardRoundAchievements(game, b, round, predictionCorrectB);
  const language = game.config?.language || 'english';
  const result = {
    round: game.currentRound + 1,
    answers: { [a.sessionId]: a.answer, [b.sessionId]: b.answer },
    answerStyles: { [a.sessionId]: a.answerStyle || null, [b.sessionId]: b.answerStyle || null },
    predictions: { [a.sessionId]: a.prediction, [b.sessionId]: b.prediction },
    scores: { [a.sessionId]: pointsA, [b.sessionId]: pointsB },
    correctAnswer: round.answerType === 'quiz'
      ? round.choices[round.correctChoiceIndex]
      : null,
    message: getRevealMessage(language, sharedPredictionPoints),
    explanation: localize(round.explanation, language) || (round.category === 'Words left unsaid'
      ? 'Opening the same door can reveal how closely you read one another.'
      : 'You chose from the same moment, yet saw it through different hearts.')
  };
  game.roundResults.push(result);
  game.currentPhase = 'ROUND_RESULTS';
  game.deadlineAt = null;
  return result;
}

function expireTimedPhase(game, now = Date.now()) {
  if (!game.deadlineAt || now < game.deadlineAt) return null;
  if (game.currentPhase === 'ANSWERING') {
    for (const player of Object.values(game.playerStates)) {
      if (player.answerSubmitted) continue;
      player.answer = null;
      player.answerStyle = null;
      player.answerIndex = null;
      player.answerSubmitted = true;
    }
    game.currentPhase = 'PREDICTING';
    game.deadlineAt = game.config?.timerSeconds
      ? now + game.config.timerSeconds * 1000
      : null;
    return 'PREDICTING';
  }
  if (game.currentPhase === 'PREDICTING') {
    for (const player of Object.values(game.playerStates)) {
      if (player.predictionSubmitted) continue;
      player.prediction = null;
      player.predictionSubmitted = true;
    }
    game.deadlineAt = null;
    return 'REVEALING';
  }
  return null;
}

function awardCompletionAchievements(game) {
  for (const player of Object.values(game.playerStates)) {
    player.achievementProgress ||= { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 };
    if (player.achievementProgress.nairobiRounds >= 3) addAchievement(player, 'nairobi-survivor');
    if (game.config?.mode === 'romance' && player.achievementProgress.correctPredictions >= 1) {
      addAchievement(player, 'romantic-comedian');
    }
  }
}

module.exports = {
  scenarios,
  createGame,
  normalizeGameConfig,
  publicGame,
  publicRound,
  revealRound,
  expireTimedPhase,
  awardCompletionAchievements,
  getOptions,
  getCurrentRound
};
