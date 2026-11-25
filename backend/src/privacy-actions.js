function removeFromMap(value, sessionId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = { ...value };
  delete copy[sessionId];
  return copy;
}

function scrubRoundResults(roundResults, sessionId) {
  return (roundResults || []).map(result => {
    const scrubbed = { ...result };
    for (const key of ['answers', 'answerStyles', 'predictions', 'scores']) {
      scrubbed[key] = removeFromMap(scrubbed[key], sessionId);
    }
    return scrubbed;
  });
}

function gameContainsSession(game, sessionId) {
  return Boolean(
    game?.playerStates?.[sessionId]
    || game?.scores?.[sessionId]
    || (game?.roundResults || []).some(result =>
      ['answers', 'answerStyles', 'predictions', 'scores'].some(key =>
        Object.hasOwn(result?.[key] || {}, sessionId)
      )
    )
  );
}

function scrubRoomForDeletedPlayer(room, sessionId) {
  if (!room || !Array.isArray(room.players)) return room;
  const hadMembership = room.players.some(player => player.sessionId === sessionId);
  const hadGameData = gameContainsSession(room.game, sessionId);
  if (!hadMembership && !hadGameData && room.hostSessionId !== sessionId) return room;
  const players = room.players
    .filter(player => player.sessionId !== sessionId)
    .map(player => ({ ...player, ready: false }));
  if (players.length === 0) return null;

  const scrubbed = {
    ...room,
    hostSessionId: room.hostSessionId === sessionId ? players[0].sessionId : room.hostSessionId,
    players,
    status: hadMembership || hadGameData ? 'WAITING_FOR_PLAYER' : room.status,
    game: hadMembership || hadGameData ? null : room.game
  };
  return scrubbed;
}

function scrubGameSession(document, sessionId) {
  const hasSession = Boolean(
    document?.playerStates?.[sessionId]
    || document?.scores?.[sessionId]
    || (document?.roundResults || []).some(result =>
      ['answers', 'answerStyles', 'predictions', 'scores'].some(key =>
        Object.hasOwn(result?.[key] || {}, sessionId)
      )
    )
  );
  if (!hasSession) return null;
  return {
    playerStates: removeFromMap(document.playerStates, sessionId),
    scores: removeFromMap(document.scores, sessionId),
    roundResults: scrubRoundResults(document.roundResults, sessionId)
  };
}

function scrubGameResult(document, sessionId) {
  const hasSession = document?.sessionId === sessionId
    || (document?.players || []).some(player => player.sessionId === sessionId)
    || (document?.roundResults || []).some(result =>
      ['answers', 'answerStyles', 'predictions', 'scores'].some(key =>
        Object.hasOwn(result?.[key] || {}, sessionId)
      )
    );
  if (!hasSession) return null;
  return {
    $set: {
      players: (document.players || [])
        .filter(player => player.sessionId !== sessionId)
        .concat((document.players || []).some(player => player.sessionId === sessionId)
          ? [{ nickname: 'Former player' }]
          : []),
      roundResults: scrubRoundResults(document.roundResults, sessionId),
      finalScores: removeFromMap(document.finalScores, sessionId)
    },
    $unset: { sessionId: 1 }
  };
}

function canDeleteRoom(room, sessionId) {
  return Boolean(room && typeof sessionId === 'string' && room.hostSessionId === sessionId);
}

module.exports = {
  scrubRoomForDeletedPlayer,
  scrubGameSession,
  scrubGameResult,
  canDeleteRoom
};
