function findSessionMember(room, sessions, sessionId) {
  if (!room || typeof sessionId !== 'string') return null;
  const session = sessions.get(sessionId);
  if (!session || session.roomCode !== room.code) return null;
  const member = room.players.find(player => player.sessionId === sessionId);
  if (!member || member.nickname !== session.nickname) return null;
  return member;
}

module.exports = { findSessionMember };
