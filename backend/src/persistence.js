const mongoose = require('mongoose');
const {
  GuestSession,
  GameRoom,
  GameSession,
  GameResult
} = require('./models');

let connected = false;
let lastWriteError = null;

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (process.env.NODE_ENV === 'production' && !uri) {
    throw new Error('MONGODB_URI is required in production');
  }
  if (!uri) return false;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000
  });
  connected = true;
  return true;
}

function isConnected() {
  return connected && mongoose.connection.readyState === 1;
}

function assertProductionPersistence() {
  if (process.env.NODE_ENV === 'production' && !isConnected()) {
    throw new Error('MongoDB persistence is unavailable');
  }
  if (lastWriteError) throw lastWriteError;
}

async function saveGuestSession(sessionId, nickname, roomCode) {
  if (!isConnected()) return;
  try {
    await GuestSession.findOneAndUpdate(
      { sessionId },
      { sessionId, nickname, lastSeen: new Date(), roomCode },
      { upsert: true, setDefaultsOnInsert: true }
    );
    lastWriteError = null;
  } catch (error) {
    lastWriteError = error;
    throw error;
  }
}

async function saveRoom(room) {
  if (!isConnected()) return;
  try {
    await GameRoom.findOneAndUpdate(
      { roomCode: room.code },
      {
        roomCode: room.code,
        hostSessionId: room.hostSessionId,
        players: room.players,
        roomStatus: room.status,
        expiresAt: new Date(room.expiresAt),
        state: room
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (room.game) {
      await GameSession.findOneAndUpdate(
        { roomCode: room.code },
        {
          roomCode: room.code,
          gameType: room.game.gameType,
          currentRound: room.game.currentRound,
          currentPhase: room.game.currentPhase,
          config: room.game.config,
          rounds: room.game.rounds,
          usedQuestionIds: room.game.usedQuestionIds,
          deadlineAt: room.game.deadlineAt ? new Date(room.game.deadlineAt) : null,
          playerStates: room.game.playerStates,
          scores: room.game.scores,
          startedAt: room.game.startedAt ? new Date(room.game.startedAt) : new Date(),
          completedAt: room.game.completedAt ? new Date(room.game.completedAt) : null,
          roundResults: room.game.roundResults
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    lastWriteError = null;
  } catch (error) {
    lastWriteError = error;
    throw error;
  }
}

async function saveGameResult(room) {
  if (!isConnected() || !room.game) return;
  await GameResult.findOneAndUpdate(
    { roomCode: room.code },
    {
      roomCode: room.code,
      players: room.players.map(({ sessionId, nickname }) => ({ sessionId, nickname })),
      roundResults: room.game.roundResults,
      finalScores: room.game.scores,
      completedAt: room.game.completedAt ? new Date(room.game.completedAt) : new Date()
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

async function deleteExpiredRoom(roomCode) {
  if (!isConnected()) return;
  await Promise.all([
    GameRoom.deleteOne({ roomCode }),
    GameSession.deleteMany({ roomCode }),
    GameResult.deleteMany({ roomCode }),
    GuestSession.deleteMany({ roomCode })
  ]);
}

async function recoverRooms() {
  if (!isConnected()) return [];
  const now = new Date();
  const expiredRooms = await GameRoom.find({ expiresAt: { $lte: now } }).select('roomCode').lean();
  const expiredCodes = expiredRooms.map(room => room.roomCode);
  if (expiredCodes.length > 0) {
    await Promise.all([
      GameRoom.deleteMany({ roomCode: { $in: expiredCodes } }),
      GameSession.deleteMany({ roomCode: { $in: expiredCodes } }),
      GameResult.deleteMany({ roomCode: { $in: expiredCodes } }),
      GuestSession.deleteMany({ roomCode: { $in: expiredCodes } })
    ]);
  }
  const documents = await GameRoom.find({ expiresAt: { $gt: now } }).lean();
  return filterRecoverableRooms(documents.map(document => document.state), now.getTime());
}

function filterRecoverableRooms(states, now = Date.now()) {
  return (states || [])
    .filter(room => room && room.code && new Date(room.expiresAt).getTime() > now);
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connected = false;
}

module.exports = {
  connectDatabase,
  isConnected,
  assertProductionPersistence,
  saveGuestSession,
  saveRoom,
  saveGameResult,
  deleteExpiredRoom,
  recoverRooms,
  filterRecoverableRooms,
  disconnectDatabase
};
