const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  nickname: { type: String, required: true },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: { createdAt: true, updatedAt: false } });

const gameRoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  hostSessionId: String,
  players: [{ sessionId: String, nickname: String, ready: Boolean, online: Boolean }],
  roomStatus: String,
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: { createdAt: true, updatedAt: true } });

const gameSessionSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRoom', index: true },
  gameType: String,
  currentRound: Number,
  currentPhase: String,
  playerStates: mongoose.Schema.Types.Mixed,
  scores: mongoose.Schema.Types.Mixed,
  startedAt: Date,
  completedAt: Date
});

const gameResultSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  players: [{ sessionId: String, nickname: String }],
  roundResults: mongoose.Schema.Types.Mixed,
  finalScores: mongoose.Schema.Types.Mixed,
  completedAt: Date
});

module.exports = {
  GuestSession: mongoose.model('GuestSession', guestSessionSchema),
  GameRoom: mongoose.model('GameRoom', gameRoomSchema),
  GameSession: mongoose.model('GameSession', gameSessionSchema),
  GameResult: mongoose.model('GameResult', gameResultSchema)
};
