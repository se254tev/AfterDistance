require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { randomBytes, randomUUID } = require('crypto');
const { z } = require('zod');
const { scenarios, createGame, publicGame, revealRound } = require('./game/otherSide');
const persistence = require('./persistence');
const socketValidation = require('./socket-validation');

const isProduction = process.env.NODE_ENV === 'production';

const defaultClientOrigin = isProduction
  ? 'https://afterdistance.netlify.app'
  : 'http://localhost:5173';
const clientOrigins = (process.env.CLIENT_ORIGIN || defaultClientOrigin)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
if (clientOrigins.length === 0) {
  throw new Error('CLIENT_ORIGIN must be set in production.');
}
if (isProduction) {
  const invalidOrigins = clientOrigins.filter(origin => origin === '*' || !/^https:\/\/[^/]+$/i.test(origin));
  if (invalidOrigins.length > 0) {
    throw new Error('Production CLIENT_ORIGIN must contain exact HTTPS origins.');
  }
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: clientOrigins }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120 }));
const roomJoinLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30 });
const roomCleanup = setInterval(() => {
  for (const roomCode of rooms.keys()) findActiveRoom(roomCode);
}, 60_000);
roomCleanup.unref();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: clientOrigins, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

const rooms = new Map();
const sessions = new Map();
const socketToSession = new Map();
const sessionToSockets = new Map();
const persistenceQueues = new Map();

function code() {
  let value;
  do value = randomBytes(6).toString('hex').toUpperCase(); while (rooms.has(value));
  return value;
}

const {
  roomPayloadSchema,
  readyPayloadSchema,
  answerPayloadSchema,
  predictionPayloadSchema,
  typingPayloadSchema,
  canJoinRoom,
  createSocketEventRateLimiter
} = socketValidation;
const allowSocketEvent = createSocketEventRateLimiter();

function createToken() { return randomUUID() + '.' + randomBytes(24).toString('base64url'); }
function publicRoom(room) {
  return {
    roomCode: room.code, status: room.status, expiresAt: room.expiresAt,
    players: room.players.map(p => ({ nickname: p.nickname, ready: p.ready, online: p.online }))
  };
}
function roomView(room, sessionId) {
  const view = publicRoom(room);
  view.me = room.players.find(p => p.sessionId === sessionId) || null;
  if (view.me) view.me = { nickname: view.me.nickname, ready: view.me.ready, online: view.me.online, sessionId };
  const partner = room.players.find(p => p.sessionId !== sessionId) || null;
  view.partner = partner ? { nickname: partner.nickname, ready: partner.ready, online: partner.online } : null;
  view.game = room.game ? publicGame(room.game, sessionId) : null;
  return view;
}
function broadcastRoom(room) {
  for (const player of room.players) {
    const socketId = sessionToSockets.get(player.sessionId);
    if (socketId) io.to(socketId).emit('room:updated', roomView(room, player.sessionId));
  }
}

function persistRoom(room) {
  const previous = persistenceQueues.get(room.code) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => persistence.saveRoom(room))
    .catch(error => {
      console.error(`Failed to persist room ${room.code}: ${error.message}`);
      if (isProduction) throw error;
    });
  persistenceQueues.set(room.code, current);
  current.finally(() => {
    if (persistenceQueues.get(room.code) === current) persistenceQueues.delete(room.code);
  }).catch(() => {});
  return current;
}
function persistGuest(sessionId, nickname, roomCode) {
  return persistence.saveGuestSession(sessionId, nickname, roomCode).catch(error => {
    console.error(`Failed to persist guest session ${sessionId}: ${error.message}`);
    if (isProduction) throw error;
  });
}
function findActiveRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  if (new Date(room.expiresAt).getTime() <= Date.now()) {
    rooms.delete(roomCode);
    for (const player of room.players) {
      sessions.delete(player.sessionId);
    }
    persistence.deleteExpiredRoom(roomCode).catch(error => console.error(`Failed to remove expired room ${roomCode}: ${error.message}`));
    return null;
  }
  return room;
}
function ack(socket, callback, ok, payload) {
  if (typeof callback === 'function') callback(ok ? { ok: true, ...payload } : { ok: false, error: payload?.error || 'Operation failed' });
}
function validateSocket(socket, token, codeValue) {
  const room = findActiveRoom(codeValue);
  if (!room) throw new Error('Room not found');
  const member = room.players.find(p => p.sessionId === token);
  if (!member) throw new Error('You are not a member of this room');
  if (socketToSession.get(socket.id) !== token) throw new Error('Invalid session');
  return { room, member };
}
function resetRound(game) {
  game.readyForNext = {};
  game.currentPhase = 'ANSWERING';
  for (const player of Object.values(game.playerStates)) {
    player.answerSubmitted = false; player.predictionSubmitted = false; player.answer = null; player.prediction = null;
  }
}
function reveal(game) {
  revealRound(game);
}

app.get('/api/health', (_, res) => res.json({
  ok: true,
  persistence: isProduction ? (persistence.isConnected() ? 'connected' : 'disconnected') : 'optional'
}));
app.post('/api/rooms', async (req, res) => {
  const parsed = z.object({ nickname: z.string().trim().min(2).max(24) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a nickname from 2 to 24 characters.' });
  const roomCode = code();
  const sessionId = createToken();
  const room = {
    code: roomCode, hostSessionId: sessionId, status: 'WAITING_FOR_PLAYER',
    createdAt: Date.now(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    players: [{ sessionId, nickname: parsed.data.nickname, ready: false, online: true }],
    game: null
  };
  rooms.set(roomCode, room); sessions.set(sessionId, { roomCode, nickname: parsed.data.nickname });
  try {
    if (isProduction) {
      await persistGuest(sessionId, parsed.data.nickname, roomCode);
      await persistRoom(room);
    } else {
      persistGuest(sessionId, parsed.data.nickname, roomCode);
      persistRoom(room);
    }
  } catch (error) {
    rooms.delete(roomCode);
    sessions.delete(sessionId);
    return res.status(503).json({ error: 'The room could not be saved. Please try again.' });
  }
  res.status(201).json({ roomCode, sessionId, room: roomView(room, sessionId), inviteUrl: `/join/${roomCode}` });
});
app.post('/api/rooms/join', roomJoinLimit, async (req, res) => {
  const parsed = z.object({ nickname: z.string().trim().min(2).max(24), roomCode: z.string().trim().regex(/^[a-f0-9]{12}$/i) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid nickname and 12-character room code are required.' });
  const roomCode = parsed.data.roomCode.toUpperCase();
  const room = findActiveRoom(roomCode);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!canJoinRoom(room)) return res.status(409).json({ error: 'This room is already full.' });
  const sessionId = createToken();
  room.players.push({ sessionId, nickname: parsed.data.nickname, ready: false, online: true });
  room.status = 'WAITING_FOR_READY';
  sessions.set(sessionId, { roomCode, nickname: parsed.data.nickname });
  try {
    if (isProduction) {
      await persistGuest(sessionId, parsed.data.nickname, roomCode);
      await persistRoom(room);
    } else {
      persistGuest(sessionId, parsed.data.nickname, roomCode);
      persistRoom(room);
    }
  } catch (error) {
    room.players.pop();
    room.status = 'WAITING_FOR_PLAYER';
    sessions.delete(sessionId);
    return res.status(503).json({ error: 'The room could not be saved. Please try again.' });
  }
  broadcastRoom(room);
  res.status(200).json({ roomCode, sessionId, room: roomView(room, sessionId), inviteUrl: `/join/${roomCode}` });
});

io.on('connection', socket => {
  socket.on('room:join', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid room credentials');
      const room = findActiveRoom(parsed.data.roomCode.toUpperCase());
      if (!room) throw new Error('Room not found');
      const member = room.players.find(p => p.sessionId === parsed.data.sessionId);
      if (!member) throw new Error('You are not a member of this room');
      member.online = true;
      socket.join(room.code); socketToSession.set(socket.id, parsed.data.sessionId); sessionToSockets.set(parsed.data.sessionId, socket.id);
      io.to(room.code).emit('player:online', { sessionId: member.sessionId, nickname: member.nickname });
      broadcastRoom(room);
      ack(socket, callback, true, { room: roomView(room, parsed.data.sessionId) });
      io.to(room.code).emit('connection:restored');
    } catch (error) { ack(socket, callback, false, { error: error.message }); socket.emit('error:occurred', { error: error.message }); }
  });

  socket.on('player:ready', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = readyPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid ready request');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      member.ready = parsed.data.ready;
      broadcastRoom(room);
      io.to(room.code).emit('player:ready-updated', { sessionId: member.sessionId, ready: member.ready });
      persistRoom(room);
      ack(socket, callback, true, { room: roomView(room, parsed.data.sessionId) });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:start', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid game start request');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      if (room.game) throw new Error('The game has already started');
      if (room.players.length !== 2 || !room.players.every(p => p.ready && p.online)) throw new Error('Both players must be ready and online');
      room.game = createGame(room.code);
      room.game.currentPhase = 'ANSWERING';
      room.status = 'PLAYING';
      room.game.playerStates = Object.fromEntries(room.players.map((p, seat) => [p.sessionId, { sessionId: p.sessionId, seat, answerSubmitted: false, predictionSubmitted: false, answer: null, prediction: null }]));
      room.game.scores = Object.fromEntries(room.players.map(p => [p.sessionId, 0]));
      broadcastRoom(room);
      io.to(room.code).emit('game:started', { roomCode: room.code, timestamp: Date.now() });
      persistRoom(room);
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:answer', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = answerPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid answer request');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      const game = room.game;
      if (!game || game.currentPhase !== 'ANSWERING') throw new Error('Answers are not open');
      const player = game.playerStates[parsed.data.sessionId];
      const round = scenarios[game.currentRound];
      if (!round.choices.includes(parsed.data.answer)) throw new Error('Invalid answer');
      if (player.answerSubmitted) throw new Error('Answer already submitted');
      player.answer = parsed.data.answer; player.answerSubmitted = true;
      io.to(room.code).emit('game:answer-received', { timestamp: Date.now() });
      if (Object.values(game.playerStates).every(p => p.answerSubmitted)) game.currentPhase = 'PREDICTING';
      broadcastRoom(room);
      persistRoom(room);
      ack(socket, callback, true, { received: true });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:predict', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = predictionPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid prediction request');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      const game = room.game;
      if (!game || game.currentPhase !== 'PREDICTING') throw new Error('Predictions are not open');
      const player = game.playerStates[parsed.data.sessionId];
      const round = scenarios[game.currentRound];
      if (!round.choices.includes(parsed.data.prediction)) throw new Error('Invalid prediction');
      if (player.predictionSubmitted) throw new Error('Prediction already submitted');
      player.prediction = parsed.data.prediction; player.predictionSubmitted = true;
      broadcastRoom(room);
      if (Object.values(game.playerStates).every(p => p.predictionSubmitted)) {
        game.currentPhase = 'REVEALING';
        io.to(room.code).emit('game:reveal', { timestamp: Date.now() });
        reveal(game);
        broadcastRoom(room);
        io.to(room.code).emit('game:score-updated', { scores: game.scores });
        persistRoom(room);
        if (game.currentPhase === 'COMPLETED') persistRoom(room);
      }
      ack(socket, callback, true, { received: true });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:next-round', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid next-round request');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      const game = room.game;
      if (!game || game.currentPhase !== 'ROUND_RESULTS') throw new Error('Results are not ready');
      game.readyForNext[parsed.data.sessionId] = true;
      if (Object.keys(game.readyForNext).length === 2) {
        if (game.currentRound >= scenarios.length - 1) {
          game.currentPhase = 'COMPLETED'; game.completedAt = new Date().toISOString();
          room.status = 'COMPLETED';
          io.to(room.code).emit('game:completed', { scores: game.scores, timestamp: Date.now() });
          persistence.saveGameResult(room).catch(error => console.error('Failed to persist game result:', error.message));
        } else {
          game.currentRound += 1; resetRound(game);
          io.to(room.code).emit('game:round-updated', { round: game.currentRound + 1, timestamp: Date.now() });
        }
      }
      broadcastRoom(room);
      persistRoom(room);
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:replay', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid replay request');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      if (!room.game || room.game.currentPhase !== 'COMPLETED') throw new Error('Replay is available after the game completes');
      room.game = createGame(room.code);
      room.status = 'PLAYING';
      room.game.currentPhase = 'ANSWERING';
      room.game.playerStates = Object.fromEntries(room.players.map((p, seat) => [p.sessionId, { sessionId: p.sessionId, seat, answerSubmitted: false, predictionSubmitted: false }]));
      room.game.scores = Object.fromEntries(room.players.map(p => [p.sessionId, 0]));
      room.players.forEach(p => { p.ready = true; });
      broadcastRoom(room); io.to(room.code).emit('game:replayed', { timestamp: Date.now() });
      persistRoom(room);
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('player:heartbeat', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid heartbeat request');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      member.online = true;
      broadcastRoom(room);
      persistRoom(room);
      ack(socket, callback, true, { timestamp: Date.now() });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });
  socket.on('player:typing', payload => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = typingPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid typing status');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      socket.to(room.code).emit('player:typing', { typing: parsed.data.typing });
    } catch (error) { socket.emit('error:occurred', { error: error.message }); }
  });
  socket.on('room:leave', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid leave request');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      member.online = false; socket.leave(room.code);
      io.to(room.code).emit('player:left', { sessionId: member.sessionId });
      broadcastRoom(room);
      persistRoom(room);
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });
  socket.on('disconnect', () => {
    const sessionId = socketToSession.get(socket.id);
    socketToSession.delete(socket.id);
    if (sessionToSockets.get(sessionId) === socket.id) sessionToSockets.delete(sessionId);
    if (!sessionId) return;
    if (sessionToSockets.has(sessionId)) return;
    for (const room of rooms.values()) {
      const member = room.players.find(p => p.sessionId === sessionId);
      if (member) {
        member.online = false;
        io.to(room.code).emit('player:offline', { sessionId, nickname: member.nickname });
        broadcastRoom(room);
        persistRoom(room);
      }
    }
  });
});

async function start() {
  if (isProduction) {
    await persistence.connectDatabase();
  } else if (process.env.MONGODB_URI) {
    try {
      await persistence.connectDatabase();
    } catch (error) {
      console.warn(`MongoDB unavailable in local mode: ${error.message}`);
    }
  }

  if (persistence.isConnected()) {
    const recoveredRooms = await persistence.recoverRooms();
    for (const room of recoveredRooms) {
      if (!room.players || room.players.length < 1) continue;
      room.players.forEach(player => { player.online = false; });
      rooms.set(room.code, room);
      room.players.forEach(player => {
        sessions.set(player.sessionId, { roomCode: room.code, nickname: player.nickname });
      });
    }
  }

  const port = Number(process.env.PORT || 3001);
  server.listen(port, '0.0.0.0', () => console.log(`AfterDistance server listening on ${port}`));
}

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await persistence.disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch(error => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
