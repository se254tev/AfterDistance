const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  nickname: { type: String, required: true },
  roomCode: { type: String, index: true },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: { createdAt: true, updatedAt: false } });

const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  createRequestId: { type: String },
  hostSessionId: String,
  players: [{ sessionId: String, nickname: String, ready: Boolean, online: Boolean }],
  roomStatus: String,
  expiresAt: { type: Date, required: true, index: true, expires: 0 },
  state: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: { createdAt: true, updatedAt: true } });
gameRoomSchema.index({ createRequestId: 1 }, { unique: true, sparse: true, name: 'createRequestId_unique_sparse' });

const gameSessionSchema = new mongoose.Schema({
  gameId: { type: String, index: true, sparse: true },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRoom', index: true },
  roomCode: { type: String, required: true, index: true },
  gameType: String,
  currentRound: Number,
  currentPhase: String,
  config: mongoose.Schema.Types.Mixed,
  rounds: mongoose.Schema.Types.Mixed,
  usedQuestionIds: [String],
  deadlineAt: Date,
  playerStates: mongoose.Schema.Types.Mixed,
  scores: mongoose.Schema.Types.Mixed,
  roundResults: mongoose.Schema.Types.Mixed,
  startedAt: Date,
  completedAt: Date
});

const gameResultSchema = new mongoose.Schema({
  gameId: { type: String },
  roomCode: { type: String, required: true },
  sessionId: { type: String, index: true },
  players: [{ sessionId: String, nickname: String }],
  roundResults: mongoose.Schema.Types.Mixed,
  finalScores: mongoose.Schema.Types.Mixed,
  completedAt: Date
});
gameResultSchema.index({ gameId: 1 }, { unique: true, sparse: true, name: 'gameId_unique_sparse' });

const privacyDeletionSchema = new mongoose.Schema({
  sessionHash: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'completed'], required: true },
  completedAt: Date
}, { timestamps: true });

const roomDeletionSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  ownerHash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed'], required: true },
  completedAt: Date
}, { timestamps: true });

module.exports = {
  GuestSession: mongoose.model('GuestSession', guestSessionSchema),
  GameRoom: mongoose.model('GameRoom', gameRoomSchema),
  GameSession: mongoose.model('GameSession', gameSessionSchema),
  GameResult: mongoose.model('GameResult', gameResultSchema),
  PrivacyDeletion: mongoose.model('PrivacyDeletion', privacyDeletionSchema),
  RoomDeletion: mongoose.model('RoomDeletion', roomDeletionSchema)
};
