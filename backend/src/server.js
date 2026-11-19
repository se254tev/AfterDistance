require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { randomBytes, randomUUID } = require('crypto');
const { z } = require('zod');
const mongoose = require('mongoose');
const { scenarios, createGame, publicGame } = require('./game/otherSide');

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(error => console.error('MongoDB connection failed:', error.message));
}

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120 }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling']
});

const rooms = new Map();
const sessions = new Map();
const socketToSession = new Map();
const sessionToSockets = new Map();

function code() {
  let value;
  do value = randomBytes(3).toString('hex').toUpperCase(); while (rooms.has(value));
  return value;
}

function createToken() { return randomUUID() + '.' + randomBytes(24).toString('base64url'); }
function publicRoom(room) {
  return {
    roomCode: room.code, status: room.status, expiresAt: room.expiresAt,
    players: room.players.map(p => ({ sessionId: p.sessionId, nickname: p.nickname, ready: p.ready, online: p.online })),
    game: room.game
  };
}
function roomView(room, sessionId) {
  const view = publicRoom(room);
  view.me = room.players.find(p => p.sessionId === sessionId) || null;
  view.partner = room.players.find(p => p.sessionId !== sessionId) || null;
  view.game = room.game ? publicGame(room.game, sessionId) : null;
  return view;
}
function broadcastRoom(room) {
  for (const player of room.players) {
    const socketId = sessionToSockets.get(player.sessionId);
    if (socketId) io.to(socketId).emit('room:updated', roomView(room, player.sessionId));
  }
  io.to(room.code).emit('room:updated', roomView(room, room.players[0]?.sessionId));
}
function ack(socket, callback, ok, payload) {
  if (typeof callback === 'function') callback(ok ? { ok: true, ...payload } : { ok: false, error: payload?.error || 'Operation failed' });
}
function validateSocket(socket, token, codeValue) {
  const room = rooms.get(codeValue);
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
  const entries = Object.values(game.playerStates);
  if (entries.length !== 2) return;
  const [a, b] = entries;
  const round = scenarios[game.currentRound];
  const answerMatch = a.answer === b.prediction;
  const predictionMatch = b.answer === a.prediction;
  const pointsA = Number(answerMatch) + Number(predictionMatch);
  const pointsB = Number(predictionMatch) + Number(answerMatch);
  game.scores[a.sessionId] = (game.scores[a.sessionId] || 0) + pointsA;
  game.scores[b.sessionId] = (game.scores[b.sessionId] || 0) + pointsB;
  game.roundResults.push({
    round: game.currentRound + 1,
    answers: { [a.sessionId]: a.answer, [b.sessionId]: b.answer },
    predictions: { [a.sessionId]: a.prediction, [b.sessionId]: b.prediction },
    scores: { [a.sessionId]: pointsA, [b.sessionId]: pointsB },
    explanation: round.category === 'Words left unsaid'
      ? 'Opening the same door can reveal how closely you read one another.'
      : 'You chose from the same moment, yet saw it through different hearts.'
  });
  game.currentPhase = 'ROUND_RESULTS';
}

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.post('/api/rooms', (req, res) => {
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
  res.status(201).json({ roomCode, sessionId, room: roomView(room, sessionId), inviteUrl: `/join/${roomCode}` });
});
app.post('/api/rooms/join', (req, res) => {
  const parsed = z.object({ nickname: z.string().trim().min(2).max(24), roomCode: z.string().trim().length(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid nickname and 6-character room code are required.' });
  const roomCode = parsed.data.roomCode.toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (room.players.length >= 2) return res.status(409).json({ error: 'This room is already full.' });
  const sessionId = createToken();
  room.players.push({ sessionId, nickname: parsed.data.nickname, ready: false, online: true });
  room.status = 'WAITING_FOR_READY';
  sessions.set(sessionId, { roomCode, nickname: parsed.data.nickname });
  broadcastRoom(room);
  res.status(200).json({ roomCode, sessionId, room: roomView(room, sessionId), inviteUrl: `/join/${roomCode}` });
});

io.on('connection', socket => {
  socket.on('room:join', (payload, callback) => {
    try {
      const parsed = z.object({ roomCode: z.string().length(6), sessionId: z.string().min(20) }).safeParse(payload);
      if (!parsed.success) throw new Error('Invalid room credentials');
      const room = rooms.get(parsed.data.roomCode.toUpperCase());
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
      const { room, member } = validateSocket(socket, payload.sessionId, payload.roomCode);
      member.ready = payload.ready === true;
      broadcastRoom(room);
      io.to(room.code).emit('player:ready-updated', { sessionId: member.sessionId, ready: member.ready });
      ack(socket, callback, true, { room: roomView(room, payload.sessionId) });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:start', (payload, callback) => {
    try {
      const { room } = validateSocket(socket, payload.sessionId, payload.roomCode);
      if (room.players.length !== 2 || !room.players.every(p => p.ready && p.online)) throw new Error('Both players must be ready and online');
      room.game = createGame(room.code);
      room.game.currentPhase = 'ANSWERING';
      room.status = 'PLAYING';
      room.game.playerStates = Object.fromEntries(room.players.map((p, seat) => [p.sessionId, { sessionId: p.sessionId, seat, answerSubmitted: false, predictionSubmitted: false, answer: null, prediction: null }]));
      room.game.scores = Object.fromEntries(room.players.map(p => [p.sessionId, 0]));
      broadcastRoom(room);
      io.to(room.code).emit('game:started', { roomCode: room.code, timestamp: Date.now() });
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:answer', (payload, callback) => {
    try {
      const { room } = validateSocket(socket, payload.sessionId, payload.roomCode);
      const game = room.game;
      if (!game || game.currentPhase !== 'ANSWERING') throw new Error('Answers are not open');
      const player = game.playerStates[payload.sessionId];
      const round = scenarios[game.currentRound];
      if (!round.choices.includes(payload.answer)) throw new Error('Invalid answer');
      if (player.answerSubmitted) throw new Error('Answer already submitted');
      player.answer = payload.answer; player.answerSubmitted = true;
      io.to(room.code).emit('game:answer-received', { sessionId: payload.sessionId, timestamp: Date.now() });
      if (Object.values(game.playerStates).every(p => p.answerSubmitted)) game.currentPhase = 'PREDICTING';
      broadcastRoom(room);
      ack(socket, callback, true, { received: true });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:predict', (payload, callback) => {
    try {
      const { room } = validateSocket(socket, payload.sessionId, payload.roomCode);
      const game = room.game;
      if (!game || game.currentPhase !== 'PREDICTING') throw new Error('Predictions are not open');
      const player = game.playerStates[payload.sessionId];
      const round = scenarios[game.currentRound];
      if (!round.choices.includes(payload.prediction)) throw new Error('Invalid prediction');
      if (player.predictionSubmitted) throw new Error('Prediction already submitted');
      player.prediction = payload.prediction; player.predictionSubmitted = true;
      broadcastRoom(room);
      if (Object.values(game.playerStates).every(p => p.predictionSubmitted)) {
        game.currentPhase = 'REVEALING';
        io.to(room.code).emit('game:reveal', { timestamp: Date.now() });
        reveal(game);
        broadcastRoom(room);
        io.to(room.code).emit('game:score-updated', { scores: game.scores });
      }
      ack(socket, callback, true, { received: true });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:next-round', (payload, callback) => {
    try {
      const { room } = validateSocket(socket, payload.sessionId, payload.roomCode);
      const game = room.game;
      if (!game || game.currentPhase !== 'ROUND_RESULTS') throw new Error('Results are not ready');
      game.readyForNext[payload.sessionId] = true;
      if (Object.keys(game.readyForNext).length === 2) {
        if (game.currentRound >= scenarios.length - 1) {
          game.currentPhase = 'COMPLETED'; game.completedAt = new Date().toISOString();
          room.status = 'COMPLETED';
          io.to(room.code).emit('game:completed', { scores: game.scores, timestamp: Date.now() });
        } else {
          game.currentRound += 1; resetRound(game);
          io.to(room.code).emit('game:round-updated', { round: game.currentRound + 1, timestamp: Date.now() });
        }
      }
      broadcastRoom(room);
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:replay', (payload, callback) => {
    try {
      const { room } = validateSocket(socket, payload.sessionId, payload.roomCode);
      room.game = createGame(room.code);
      room.status = 'PLAYING';
      room.game.currentPhase = 'ANSWERING';
      room.game.playerStates = Object.fromEntries(room.players.map((p, seat) => [p.sessionId, { sessionId: p.sessionId, seat, answerSubmitted: false, predictionSubmitted: false }]));
      room.game.scores = Object.fromEntries(room.players.map(p => [p.sessionId, 0]));
      room.players.forEach(p => { p.ready = true; });
      broadcastRoom(room); io.to(room.code).emit('game:replayed', { timestamp: Date.now() });
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('player:heartbeat', (payload, callback) => {
    if (payload?.roomCode && rooms.get(payload.roomCode)) {
      const room = rooms.get(payload.roomCode);
      const member = room.players.find(p => p.sessionId === payload.sessionId);
      if (member) member.online = true;
    }
    ack(socket, callback, true, { timestamp: Date.now() });
  });
  socket.on('player:typing', payload => {
    if (!payload?.roomCode) return;
    socket.to(payload.roomCode).emit('player:typing', { sessionId: payload.sessionId, typing: payload.typing });
  });
  socket.on('room:leave', (payload, callback) => {
    try {
      const { room, member } = validateSocket(socket, payload.sessionId, payload.roomCode);
      member.online = false; socket.leave(room.code);
      io.to(room.code).emit('player:left', { sessionId: member.sessionId });
      broadcastRoom(room); ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });
  socket.on('disconnect', () => {
    const sessionId = socketToSession.get(socket.id);
    socketToSession.delete(socket.id);
    if (sessionToSockets.get(sessionId) === socket.id) sessionToSockets.delete(sessionId);
    if (!sessionId) return;
    for (const room of rooms.values()) {
      const member = room.players.find(p => p.sessionId === sessionId);
      if (member) {
        member.online = false;
        io.to(room.code).emit('player:offline', { sessionId, nickname: member.nickname });
        broadcastRoom(room);
      }
    }
  });
});

const port = Number(process.env.PORT || 3001);
server.listen(port, () => console.log(`AfterDistance server listening on ${port}`));
