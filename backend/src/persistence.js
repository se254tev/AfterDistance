const mongoose = require('mongoose');
const { createHash } = require('crypto');
const {
  GuestSession,
  GameRoom,
  GameSession,
  GameResult,
  PrivacyDeletion,
  RoomDeletion
} = require('./models');
const {
  scrubRoomForDeletedPlayer,
  scrubGameSession,
  scrubGameResult
} = require('./privacy-actions');

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

function hashSessionId(sessionId) {
  return createHash('sha256').update(sessionId).digest('hex');
}

async function getDeletionRecord(sessionId) {
  if (!isConnected()) return null;
  return PrivacyDeletion.findOne({ sessionHash: hashSessionId(sessionId) }).select('status').lean();
}

async function listDeletionHashes() {
  if (!isConnected()) return [];
  const records = await PrivacyDeletion.find({}).select('sessionHash').lean();
  return records.map(record => record.sessionHash);
}

async function isRoomDeleted(roomCode) {
  if (!isConnected()) return false;
  return Boolean(await RoomDeletion.exists({ roomCode }));
}

async function getRoomDeletion(roomCode) {
  if (!isConnected()) return null;
  return RoomDeletion.findOne({ roomCode }).select('ownerHash status').lean();
}

async function listDeletedRoomCodes() {
  if (!isConnected()) return [];
  const records = await RoomDeletion.find({}).select('roomCode').lean();
  return records.map(record => record.roomCode);
}

async function saveGuestSession(sessionId, nickname, roomCode) {
  if (!isConnected()) return;
  try {
    if (await PrivacyDeletion.exists({
      sessionHash: hashSessionId(sessionId),
      status: { $in: ['pending', 'completed'] }
    })) {
      throw new Error('Deleted guest sessions cannot be restored');
    }
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
    if (await RoomDeletion.exists({ roomCode: room.code })) {
      throw new Error('Deleted rooms cannot be restored');
    }
    const sessionIds = (room.players || []).map(player => player.sessionId).filter(Boolean);
    if (sessionIds.length) {
      const hashes = sessionIds.map(hashSessionId);
      if (await PrivacyDeletion.exists({
        sessionHash: { $in: hashes },
        status: 'completed'
      })) {
        throw new Error('Room contains a deleted guest session');
      }
    }
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
  if (await RoomDeletion.exists({ roomCode: room.code })) {
    throw new Error('Deleted rooms cannot be restored');
  }
  const sessionIds = (room.players || []).map(player => player.sessionId).filter(Boolean);
  if (sessionIds.length) {
    const hashes = sessionIds.map(hashSessionId);
    if (await PrivacyDeletion.exists({
      sessionHash: { $in: hashes },
      status: 'completed'
    })) {
      throw new Error('Game result contains a deleted guest session');
    }
  }
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

async function deletePersonalData(sessionId) {
  if (!isConnected()) {
    if (process.env.NODE_ENV === 'production' || process.env.MONGODB_URI) {
      throw new Error('MongoDB persistence is unavailable');
    }
    return;
  }
  const sessionHash = hashSessionId(sessionId);
  await PrivacyDeletion.updateOne(
    { sessionHash },
    { $set: { status: 'pending' }, $unset: { completedAt: 1 } },
    { upsert: true }
  );

  await GuestSession.deleteOne({ sessionId });

  const rooms = await GameRoom.find({}).lean();
  for (const document of rooms) {
    const storedState = document.state && typeof document.state === 'object'
      ? document.state
      : {};
    const storedPlayers = Array.isArray(storedState.players) ? storedState.players : [];
    const documentPlayers = Array.isArray(document.players) ? document.players : [];
    const playersBySession = new Map();
    for (const player of [...storedPlayers, ...documentPlayers]) {
      if (player?.sessionId) {
        playersBySession.set(player.sessionId, {
          ...(playersBySession.get(player.sessionId) || {}),
          ...player
        });
      }
    }
    const roomState = {
      ...storedState,
      code: storedState.code || document.roomCode,
      hostSessionId: document.hostSessionId || storedState.hostSessionId,
      players: [...playersBySession.values()],
      status: document.roomStatus || storedState.status,
      expiresAt: storedState.expiresAt || document.expiresAt
    };
    const room = scrubRoomForDeletedPlayer(roomState, sessionId);
    if (room === roomState) continue;
    if (!room) {
      await Promise.all([
        GameRoom.deleteOne({ _id: document._id }),
        GameSession.deleteMany({ roomCode: document.roomCode }),
        GameResult.deleteMany({ roomCode: document.roomCode })
      ]);
      continue;
    }
    await GameRoom.updateOne(
      { _id: document._id },
      {
        $set: {
          hostSessionId: room.hostSessionId,
          players: room.players,
          roomStatus: room.status,
          state: room
        }
      }
    );
    if (room.game === null) {
      await GameSession.deleteMany({ roomCode: document.roomCode });
    }
  }

  const gameSessions = await GameSession.find({}).lean();
  for (const document of gameSessions) {
    const scrubbed = scrubGameSession(document, sessionId);
    if (!scrubbed) continue;
    await GameSession.updateOne(
      { _id: document._id },
      { $set: scrubbed }
    );
  }

  const gameResults = await GameResult.find({}).lean();
  for (const document of gameResults) {
    const scrubbed = scrubGameResult(document, sessionId);
    if (!scrubbed) continue;
    await GameResult.updateOne({ _id: document._id }, scrubbed);
  }

  await PrivacyDeletion.updateOne(
    { sessionHash },
    { $set: { status: 'completed', completedAt: new Date() } }
  );
}

async function deleteSharedRoom(roomCode, ownerSessionId) {
  if (!isConnected()) {
    if (process.env.NODE_ENV === 'production' || process.env.MONGODB_URI) {
      throw new Error('MongoDB persistence is unavailable');
    }
    return;
  }
  const markerUpdate = {
    $set: { status: 'pending' },
    $unset: { completedAt: 1 }
  };
  if (ownerSessionId) {
    markerUpdate.$setOnInsert = { ownerHash: hashSessionId(ownerSessionId) };
  }
  await RoomDeletion.updateOne(
    { roomCode },
    markerUpdate,
    { upsert: true }
  );
  await Promise.all([
    GameRoom.deleteOne({ roomCode }),
    GameSession.deleteMany({ roomCode }),
    GameResult.deleteMany({ roomCode }),
    GuestSession.deleteMany({ roomCode })
  ]);
  await RoomDeletion.updateOne(
    { roomCode },
    { $set: { status: 'completed', completedAt: new Date() } }
  );
}

async function reconcileDeletionRecords() {
  if (!isConnected()) return;
  const deletionHashes = await listDeletionHashes();
  const hashes = new Set(deletionHashes);
  const sessionIds = new Map();
  const remember = sessionId => {
    if (typeof sessionId === 'string' && hashes.has(hashSessionId(sessionId))) {
      sessionIds.set(hashSessionId(sessionId), sessionId);
    }
  };
  const rememberMap = value => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.keys(value).forEach(remember);
    }
  };

  const [guests, rooms, gameSessions, gameResults] = await Promise.all([
    GuestSession.find({}).select('sessionId').lean(),
    GameRoom.find({}).select('hostSessionId players state').lean(),
    GameSession.find({}).select('playerStates scores roundResults').lean(),
    GameResult.find({}).select('sessionId players roundResults finalScores').lean()
  ]);
  guests.forEach(guest => remember(guest.sessionId));
  rooms.forEach(room => {
    remember(room.hostSessionId);
    (room.players || []).forEach(player => remember(player.sessionId));
    (room.state?.players || []).forEach(player => remember(player.sessionId));
    rememberMap(room.state?.game?.playerStates);
    rememberMap(room.state?.game?.scores);
    (room.state?.game?.roundResults || []).forEach(result => {
      ['answers', 'answerStyles', 'predictions', 'scores'].forEach(key => rememberMap(result[key]));
    });
  });
  gameSessions.forEach(game => {
    rememberMap(game.playerStates);
    rememberMap(game.scores);
    (game.roundResults || []).forEach(result => {
      ['answers', 'answerStyles', 'predictions', 'scores'].forEach(key => rememberMap(result[key]));
    });
  });
  gameResults.forEach(result => {
    remember(result.sessionId);
    (result.players || []).forEach(player => remember(player.sessionId));
    (result.roundResults || []).forEach(round => {
      ['answers', 'answerStyles', 'predictions', 'scores'].forEach(key => rememberMap(round[key]));
    });
    rememberMap(result.finalScores);
  });

  for (const sessionId of sessionIds.values()) {
    await deletePersonalData(sessionId);
  }
  const pending = await PrivacyDeletion.find({ status: 'pending' }).select('sessionHash').lean();
  for (const record of pending) {
    if (!sessionIds.has(record.sessionHash)) {
      await PrivacyDeletion.updateOne(
        { sessionHash: record.sessionHash },
        { $set: { status: 'completed', completedAt: new Date() } }
      );
    }
  }

  const roomDeletions = await RoomDeletion.find({}).select('roomCode').lean();
  for (const record of roomDeletions) {
    await deleteSharedRoom(record.roomCode);
  }
}

async function deleteExpiredRoom(roomCode) {
  if (!isConnected()) return;
  if (await RoomDeletion.exists({ roomCode })) return;
  await Promise.all([
    GameRoom.deleteOne({ roomCode }),
    GameSession.deleteMany({ roomCode }),
    GameResult.deleteMany({ roomCode }),
    GuestSession.deleteMany({ roomCode })
  ]);
}

async function recoverRooms() {
  if (!isConnected()) return [];
  const deletedRooms = await RoomDeletion.find({}).select('roomCode').lean();
  const deletedCodes = deletedRooms.map(room => room.roomCode);
  if (deletedCodes.length) {
    await Promise.all([
      GameRoom.deleteMany({ roomCode: { $in: deletedCodes } }),
      GameSession.deleteMany({ roomCode: { $in: deletedCodes } }),
      GameResult.deleteMany({ roomCode: { $in: deletedCodes } }),
      GuestSession.deleteMany({ roomCode: { $in: deletedCodes } })
    ]);
  }
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
  hashSessionId,
  getDeletionRecord,
  listDeletionHashes,
  isRoomDeleted,
  getRoomDeletion,
  listDeletedRoomCodes,
  saveGuestSession,
  saveRoom,
  saveGameResult,
  deletePersonalData,
  deleteSharedRoom,
  reconcileDeletionRecords,
  deleteExpiredRoom,
  recoverRooms,
  filterRecoverableRooms,
  disconnectDatabase
};
