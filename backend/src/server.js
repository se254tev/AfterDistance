require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const { randomBytes, randomUUID } = require('crypto');
const { z } = require('zod');
const {
  scenarios,
  createGame,
  normalizeGameConfig,
  publicGame,
  revealRound,
  expireTimedPhase,
  awardCompletionAchievements,
  getOptions,
  getCurrentRound
} = require('./game/otherSide');
const persistence = require('./persistence');
const socketValidation = require('./socket-validation');
const { findSessionMember } = require('./session-recovery');
const privacyActions = require('./privacy-actions');

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
const privacyActionLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10 });
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
const roomCreationRequests = new Map();
const deletingSessions = new Set();
const deletedSessionHashes = new Set();
const deletingRooms = new Set();
const deletedRooms = new Set();
const deletedRoomOwnerHashes = new Map();
const socketToSession = new Map();
const sessionToSockets = new Map();
const persistenceQueues = new Map();
const gameResultWrites = new Map();
const gameTimers = new Map();
const gameOptions = getOptions();

function code() {
  let value;
  do value = randomBytes(6).toString('hex').toUpperCase(); while (rooms.has(value) || deletedRooms.has(value));
  return value;
}

const {
  roomPayloadSchema,
  gameConfigPayloadSchema,
  experienceSwitchRequestSchema,
  experienceSwitchResponseSchema,
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
    players: room.players.map(p => ({ nickname: p.nickname, ready: p.ready, online: p.online })),
    gameConfig: room.gameConfig || null,
    gameOptions
  };
}
function roomView(room, sessionId) {
  const view = publicRoom(room);
  view.switchRequest = room.switchRequest ? {
    requestId: room.switchRequest.requestId,
    config: room.switchRequest.config,
    kind: room.switchRequest.kind,
    requestedBy: room.players.find(player => player.sessionId === room.switchRequest.requestedBy)?.nickname || 'Your partner',
    requestedByMe: room.switchRequest.requestedBy === sessionId
  } : null;
  view.me = room.players.find(p => p.sessionId === sessionId) || null;
  if (view.me) view.me = { nickname: view.me.nickname, ready: view.me.ready, online: view.me.online };
  const partner = room.players.find(p => p.sessionId !== sessionId) || null;
  view.partner = partner ? { nickname: partner.nickname, ready: partner.ready, online: partner.online } : null;
  view.game = room.game ? publicGame(room.game, sessionId) : null;
  view.canDelete = privacyActions.canDeleteRoom(room, sessionId);
  return view;
}
function publicScores(room) {
  return room.players.map(player => ({
    nickname: player.nickname,
    score: room.game?.scores?.[player.sessionId] || 0
  }));
}
function broadcastRoom(room) {
  for (const player of room.players) {
    const socketId = sessionToSockets.get(player.sessionId);
    if (socketId) io.to(socketId).emit('room:updated', roomView(room, player.sessionId));
  }
}

function persistGameResult(room, requirePersistence = false) {
  if ((isProduction || requirePersistence) && (isProduction || process.env.MONGODB_URI)
      && !persistence.isConnected()) {
    return Promise.reject(new Error('MongoDB persistence is unavailable'));
  }
  if (deletingRooms.has(room.code)
      || room.players.some(player => deletingSessions.has(player.sessionId)
        || deletedSessionHashes.has(persistence.hashSessionId(player.sessionId)))) {
    return Promise.resolve();
  }
  const write = persistence.saveGameResult(room).catch(error => {
    console.error(`Failed to persist game result: ${error.name || 'database error'}`);
    if (isProduction || requirePersistence) throw error;
  });
  gameResultWrites.set(room.code, write);
  write.finally(() => {
    if (gameResultWrites.get(room.code) === write) gameResultWrites.delete(room.code);
  }).catch(() => {});
  return write;
}

function persistRoom(room, allowBlockedRoom = false, requirePersistence = false) {
  if ((isProduction || requirePersistence) && (isProduction || process.env.MONGODB_URI)
      && !persistence.isConnected()) {
    return Promise.reject(new Error('MongoDB persistence is unavailable'));
  }
  if ((!allowBlockedRoom && deletingRooms.has(room.code))
      || room.players.some(player => deletingSessions.has(player.sessionId)
        || deletedSessionHashes.has(persistence.hashSessionId(player.sessionId)))) {
    return Promise.resolve();
  }
  const previous = persistenceQueues.get(room.code) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => persistence.saveRoom(room))
    .catch(error => {
      console.error(`Failed to persist room ${room.code}: ${error.name || 'database error'}`);
      if (isProduction || requirePersistence) throw error;
    });
  persistenceQueues.set(room.code, current);
  current.finally(() => {
    if (persistenceQueues.get(room.code) === current) persistenceQueues.delete(room.code);
  }).catch(() => {});
  return current;
}
function persistGuest(sessionId, nickname, roomCode) {
  return persistence.saveGuestSession(sessionId, nickname, roomCode).catch(error => {
    console.error(`Failed to persist guest session: ${error.name || 'database error'}`);
    if (isProduction || requirePersistence) throw error;
  });
}
function findActiveRoom(roomCode) {
  if (deletedRooms.has(roomCode) || deletingRooms.has(roomCode)) return null;
  const room = rooms.get(roomCode);
  if (!room) return null;
  if (new Date(room.expiresAt).getTime() <= Date.now()) {
    clearGameTimer(roomCode);
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
  if (isSessionInvalidated(token)) throw new Error('Invalid session');
  const room = findActiveRoom(codeValue);
  if (!room) throw new Error('Room not found');
  const member = findSessionMember(room, sessions, token);
  if (!member) throw new Error('Invalid session for this room');
  if (socketToSession.get(socket.id) !== token || sessionToSockets.get(token) !== socket.id) {
    throw new Error('Invalid session');
  }
  return { room, member };
}
function isSessionInvalidated(sessionId) {
  return deletingSessions.has(sessionId)
    || deletedSessionHashes.has(persistence.hashSessionId(sessionId));
}
function disconnectSession(sessionId, eventName, payload) {
  const socketId = sessionToSockets.get(sessionId);
  const socket = socketId ? io.sockets.sockets.get(socketId) : null;
  if (socket && eventName) socket.emit(eventName, payload);
  if (socketId) {
    socketToSession.delete(socketId);
    sessionToSockets.delete(sessionId);
    socket?.disconnect(true);
  }
}
function authenticateRequest(req, roomCode) {
  const parsed = z.object({
    sessionId: z.string().min(32).max(128),
    roomCode: z.string().trim().regex(/^[a-f0-9]{12}$/i)
  }).safeParse(req.body);
  if (!parsed.success) return { error: 'Valid room credentials are required.', status: 400 };
  const sessionId = parsed.data.sessionId;
  const normalizedCode = parsed.data.roomCode.toUpperCase();
  if (roomCode && normalizedCode !== roomCode) return { error: 'Invalid room credentials.', status: 400 };
  const room = findActiveRoom(normalizedCode);
  const member = findSessionMember(room, sessions, sessionId);
  if (!member || isSessionInvalidated(sessionId)) {
    return { error: 'This saved session is invalid for the room.', status: 401 };
  }
  return { sessionId, room, member };
}
async function waitForRoomWrites(roomCode) {
  const writes = [persistenceQueues.get(roomCode), gameResultWrites.get(roomCode)].filter(Boolean);
  for (const queued of writes) {
    try {
      await queued;
    } catch {
      // The deletion pass removes any snapshot left by a failed queued write.
    }
  }
}
function resetRound(game) {
  game.readyForNext = {};
  game.currentPhase = 'ANSWERING';
  game.deadlineAt = null;
  for (const player of Object.values(game.playerStates)) {
    player.answerSubmitted = false;
    player.predictionSubmitted = false;
    player.answer = null;
    player.answerStyle = null;
    player.answerIndex = null;
    player.prediction = null;
  }
}
function reveal(game) {
  revealRound(game);
}

function clearGameTimer(roomCode) {
  const timer = gameTimers.get(roomCode);
  if (timer) clearTimeout(timer);
  gameTimers.delete(roomCode);
}

function startPhaseTimer(game) {
  game.deadlineAt = game.config?.timerSeconds
    ? Date.now() + game.config.timerSeconds * 1000
    : null;
}

function finishReveal(room) {
  clearGameTimer(room.code);
  room.game.currentPhase = 'REVEALING';
  reveal(room.game);
  io.to(room.code).emit('game:reveal', { timestamp: Date.now() });
  broadcastRoom(room);
  io.to(room.code).emit('game:score-updated', { scores: publicScores(room) });
  persistRoom(room);
}

function expireGamePhase(roomCode, expectedDeadline) {
  const room = rooms.get(roomCode);
  if (!room?.game || room.game.deadlineAt !== expectedDeadline) return;
  if (Date.now() < expectedDeadline) {
    scheduleGameTimer(room);
    return;
  }
  clearGameTimer(roomCode);
  const transition = expireTimedPhase(room.game, Date.now());
  if (transition === 'PREDICTING') {
    scheduleGameTimer(room);
  } else if (transition === 'REVEALING') {
    finishReveal(room);
    return;
  } else {
    return;
  }
  broadcastRoom(room);
  persistRoom(room);
}

function scheduleGameTimer(room) {
  clearGameTimer(room.code);
  const deadlineAt = room.game?.deadlineAt;
  if (!deadlineAt || !['ANSWERING', 'PREDICTING'].includes(room.game.currentPhase)) return;
  gameTimers.set(room.code, setTimeout(
    () => expireGamePhase(room.code, deadlineAt),
    Math.max(0, deadlineAt - Date.now())
  ));
}

function expirePhaseIfDue(room) {
  const deadlineAt = room.game?.deadlineAt;
  if (deadlineAt && Date.now() >= deadlineAt) {
    expireGamePhase(room.code, deadlineAt);
    return true;
  }
  return false;
}

function createPlayerStates(room) {
  return Object.fromEntries(room.players.map((player, seat) => [player.sessionId, {
    sessionId: player.sessionId,
    seat,
    answerSubmitted: false,
    predictionSubmitted: false,
    answer: null,
    answerStyle: null,
    answerIndex: null,
    prediction: null,
    achievements: [],
    achievementProgress: { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 }
  }]));
}

app.get('/api/health', (_, res) => res.json({
  ok: true,
  persistence: isProduction ? (persistence.isConnected() ? 'connected' : 'disconnected') : 'optional'
}));
app.post('/api/rooms', async (req, res) => {
  const parsed = z.object({ nickname: z.string().trim().min(2).max(24) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a nickname from 2 to 24 characters.' });
  const requestId = req.get('Idempotency-Key');
  if (requestId && !z.string().uuid().safeParse(requestId).success) {
    return res.status(400).json({ error: 'Invalid room creation request key.' });
  }
  if (requestId && roomCreationRequests.has(requestId)) {
    const saved = await roomCreationRequests.get(requestId);
    if (!findActiveRoom(saved.room.code)) {
      return res.status(410).json({ error: 'The room created for this request has expired.' });
    }
    return res.status(200).json({
      roomCode: saved.room.code,
      sessionId: saved.sessionId,
      room: roomView(saved.room, saved.sessionId),
      inviteUrl: `/join/${saved.room.code}`
    });
  }
  let resolveRoomCreation;
  let rejectRoomCreation;
  if (requestId) {
    const pending = new Promise((resolve, reject) => {
      resolveRoomCreation = resolve;
      rejectRoomCreation = reject;
    });
    pending.catch(() => {});
    roomCreationRequests.set(requestId, pending);
  }
  if (requestId) {
    try {
      const savedRoom = await persistence.getRoomByCreateRequest(requestId);
      if (savedRoom) {
        let activeRoom = rooms.get(savedRoom.code);
        if (!activeRoom && new Date(savedRoom.expiresAt).getTime() > Date.now()) {
          savedRoom.players.forEach(player => { player.online = false; });
          activeRoom = savedRoom;
          rooms.set(savedRoom.code, savedRoom);
          savedRoom.players.forEach(player => {
            sessions.set(player.sessionId, { roomCode: savedRoom.code, nickname: player.nickname });
          });
        }
        if (activeRoom) {
          const sessionId = savedRoom.hostSessionId;
          resolveRoomCreation({ room: activeRoom, sessionId });
          return res.status(200).json({
            roomCode: activeRoom.code,
            sessionId,
            room: roomView(activeRoom, sessionId),
            inviteUrl: `/join/${activeRoom.code}`
          });
        }
      }
    } catch (error) {
      rejectRoomCreation?.(error);
      roomCreationRequests.delete(requestId);
      console.error(`Failed to verify room creation: ${error.name || 'database error'}`);
      return res.status(503).json({ error: 'The room creation status could not be verified.' });
    }
  }
  const roomCode = code();
  const sessionId = createToken();
  const room = {
    code: roomCode, hostSessionId: sessionId, status: 'WAITING_FOR_PLAYER',
    createdAt: Date.now(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    players: [{ sessionId, nickname: parsed.data.nickname, ready: false, online: true }],
    gameConfig: null,
    game: null,
    ...(requestId ? { createRequestId: requestId } : {})
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
    rejectRoomCreation?.(error);
    if (requestId) roomCreationRequests.delete(requestId);
    return res.status(503).json({ error: 'The room could not be saved. Please try again.' });
  }
  resolveRoomCreation?.({ room, sessionId });
  res.status(201).json({ roomCode, sessionId, room: roomView(room, sessionId), inviteUrl: `/join/${roomCode}` });
});
app.post('/api/rooms/join', roomJoinLimit, async (req, res) => {
  const parsed = z.object({ nickname: z.string().trim().min(2).max(24), roomCode: z.string().trim().regex(/^[a-f0-9]{12}$/i) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid nickname and 12-character room code are required.' });
  const roomCode = parsed.data.roomCode.toUpperCase();
  const room = findActiveRoom(roomCode);
  if (!room) return res.status(404).json({ error: 'Room not found.' });
  if (!canJoinRoom(room)) return res.status(409).json({ error: 'This room is already full.' });
  if (room.game?.currentPhase === 'COMPLETED') {
    try {
      await persistGameResult(room, true);
    } catch (error) {
      console.error(`Failed to preserve completed game before join: ${error.name || 'database error'}`);
      return res.status(503).json({ error: 'The completed game could not be safely preserved. Please retry.' });
    }
  }
  const sessionId = createToken();
  if (room.game?.currentPhase === 'COMPLETED') room.game = null;
  room.switchRequest = null;
  room.players = room.players.map(player => ({ ...player, ready: false }));
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

app.post('/api/sessions/resume', async (req, res) => {
  const parsed = z.object({
    roomCode: z.string().trim().regex(/^[a-f0-9]{12}$/i),
    sessionId: z.string().min(32).max(128)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid room credentials are required.' });
  const roomCode = parsed.data.roomCode.toUpperCase();
  let deletionRecord;
  try {
    deletionRecord = await persistence.getDeletionRecord(parsed.data.sessionId);
  } catch (error) {
    console.error(`Failed to verify saved session status: ${error.name || 'database error'}`);
    return res.status(503).json({ error: 'Your saved session could not be verified.' });
  }
  if (deletingSessions.has(parsed.data.sessionId) || deletionRecord?.status === 'pending') {
    return res.status(423).json({ error: 'Deletion is pending. Open Privacy & Data Management to retry.' });
  }
  if (deletingRooms.has(roomCode)) {
    let roomDeletion;
    try {
      roomDeletion = await persistence.getRoomDeletion(roomCode);
    } catch (error) {
      console.error(`Failed to verify room request status: ${error.name || 'database error'}`);
      return res.status(503).json({ error: 'The room request status could not be verified.' });
    }
    return res.status(423).json({
      error: roomDeletion?.status === 'pending'
        ? 'Shared-game deletion is pending; the creator can retry in Privacy & Data Management.'
        : 'A personal data request is processing for this room. Please retry shortly.'
    });
  }
  if (isSessionInvalidated(parsed.data.sessionId)) return res.status(401).json({ error: 'This saved session has been deleted.' });
  const room = findActiveRoom(parsed.data.roomCode.toUpperCase());
  if (!room) return res.status(404).json({ error: 'This room is no longer available.' });
  const member = findSessionMember(room, sessions, parsed.data.sessionId);
  if (!member) return res.status(401).json({ error: 'This saved session is invalid for the room.' });
  return res.json({ room: roomView(room, member.sessionId) });
});

app.post('/api/rooms/leave', privacyActionLimit, async (req, res) => {
  const auth = authenticateRequest(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { room, member, sessionId } = auth;
  member.online = false;
  io.to(room.code).emit('player:left', { nickname: member.nickname });
  disconnectSession(sessionId);
  broadcastRoom(room);
  try {
    await persistRoom(room);
    return res.json({ ok: true });
  } catch (error) {
    console.error(`Failed to persist room leave: ${error.name || 'database error'}`);
    return res.status(503).json({ error: 'Could not save your departure. Please try again.' });
  }
});

app.post('/api/rooms/delete', privacyActionLimit, async (req, res) => {
  const parsed = z.object({
    sessionId: z.string().min(32).max(128),
    roomCode: z.string().trim().regex(/^[a-f0-9]{12}$/i)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid room credentials are required.' });
  const sessionId = parsed.data.sessionId;
  const roomCode = parsed.data.roomCode.toUpperCase();
  const ownerHash = persistence.hashSessionId(sessionId);
  if (deletedRooms.has(roomCode)) {
    return deletedRoomOwnerHashes.get(roomCode) === ownerHash
      ? res.json({ ok: true, alreadyDeleted: true })
      : res.status(403).json({ error: 'Only the room creator can delete this shared game.' });
  }
  let roomDeletion;
  try {
    roomDeletion = await persistence.getRoomDeletion(roomCode);
  } catch (error) {
    console.error(`Failed to verify shared game deletion status: ${error.name || 'database error'}`);
    return res.status(503).json({ error: 'The game deletion status could not be verified.' });
  }
  if (roomDeletion?.ownerHash === ownerHash && roomDeletion.status === 'completed') {
    return res.json({ ok: true, alreadyDeleted: true });
  }
  if (roomDeletion && roomDeletion.ownerHash !== ownerHash) {
    return res.status(403).json({ error: 'Only the room creator can delete this shared game.' });
  }
  if (deletingRooms.has(roomCode) && roomDeletion?.status !== 'pending') {
    return res.status(423).json({ error: 'A personal data request is processing for this room. Please retry shortly.' });
  }
  const room = rooms.get(roomCode);
  const member = findSessionMember(room, sessions, sessionId);
  if (!member || isSessionInvalidated(sessionId)) {
    return res.status(401).json({ error: 'This saved session is invalid for the room.' });
  }
  if (!privacyActions.canDeleteRoom(room, sessionId)) {
    return res.status(403).json({ error: 'Only the room creator can delete this shared game.' });
  }
  deletingRooms.add(room.code);
  await waitForRoomWrites(room.code);
  try {
    await persistence.deleteSharedRoom(room.code, sessionId);
  } catch (error) {
    console.error(`Failed to delete shared game: ${error.name || 'database error'}`);
    try {
      if (!await persistence.getRoomDeletion(room.code)) deletingRooms.delete(room.code);
    } catch (statusError) {
      console.error(`Failed to verify shared game deletion progress: ${statusError.name || 'database error'}`);
    }
    return res.status(503).json({ error: 'The game could not be fully deleted. Please retry.' });
  }
  io.to(room.code).emit('room:deleted');
  clearGameTimer(room.code);
  room.players.forEach(player => {
    disconnectSession(player.sessionId);
    sessions.delete(player.sessionId);
  });
  rooms.delete(room.code);
  deletingRooms.delete(room.code);
  deletedRooms.add(room.code);
  deletedRoomOwnerHashes.set(room.code, ownerHash);
  return res.json({ ok: true });
});

async function deleteAuthenticatedPlayerData(req, res) {
  const parsed = z.object({
    sessionId: z.string().min(32).max(128),
    roomCode: z.string().trim().regex(/^[a-f0-9]{12}$/i)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid room credentials are required.' });
  const { sessionId } = parsed.data;
  const sessionHash = persistence.hashSessionId(sessionId);
  if (deletedSessionHashes.has(sessionHash)) {
    return res.json({ ok: true, alreadyDeleted: true });
  }
  let deletionRecord;
  try {
    deletionRecord = await persistence.getDeletionRecord(sessionId);
  } catch (error) {
    console.error(`Failed to verify deletion status: ${error.name || 'database error'}`);
    return res.status(503).json({ error: 'Your data status could not be verified. Please retry.' });
  }
  const roomCode = parsed.data.roomCode.toUpperCase();
  let roomDeletion;
  try {
    roomDeletion = await persistence.getRoomDeletion(roomCode);
  } catch (error) {
    console.error(`Failed to verify shared game status: ${error.name || 'database error'}`);
    return res.status(503).json({ error: 'The shared game status could not be verified.' });
  }
  if (roomDeletion?.status === 'pending') {
    return res.status(423).json({ error: 'Shared-game deletion is pending. Start a new room after it completes.' });
  }
  if (deletingRooms.has(roomCode) && !deletingSessions.has(sessionId)
      && deletionRecord?.status !== 'pending') {
    return res.status(423).json({ error: 'A room data request is already processing. Please retry shortly.' });
  }
  const room = rooms.get(roomCode);
  const member = findSessionMember(room, sessions, sessionId);
  if (!member && !deletingSessions.has(sessionId)
      && !['pending', 'completed'].includes(deletionRecord?.status)) {
    return res.status(401).json({ error: 'This saved session is invalid for the room.' });
  }
  deletingSessions.add(sessionId);
  const affectedRooms = [...rooms.values()].filter(candidate =>
    candidate.players.some(player => player.sessionId === sessionId)
    || (candidate.code === roomCode && deletingRooms.has(candidate.code))
  );
  affectedRooms.forEach(candidate => deletingRooms.add(candidate.code));
  await Promise.all(affectedRooms.map(candidate => waitForRoomWrites(candidate.code)));
  disconnectSession(sessionId, 'privacy:deleted');
  try {
    await persistence.deletePersonalData(sessionId);
  } catch (error) {
    console.error(`Personal data deletion did not complete: ${error.name || 'database error'}`);
    return res.status(503).json({ error: 'Deletion could not be completed. Your session is blocked; please retry.' });
  }
  for (const candidate of affectedRooms) {
    clearGameTimer(candidate.code);
    const updated = privacyActions.scrubRoomForDeletedPlayer(candidate, sessionId);
    if (!updated) {
      clearGameTimer(candidate.code);
      rooms.delete(candidate.code);
      deletedRooms.add(candidate.code);
      deletingRooms.delete(candidate.code);
      continue;
    }
    io.to(candidate.code).emit('player:left');
    Object.assign(candidate, updated);
    if (candidate.game) scheduleGameTimer(candidate);
    broadcastRoom(candidate);
    try {
      await persistRoom(candidate, true);
    } catch (error) {
      console.error(`Failed to persist anonymized room: ${error.name || 'database error'}`);
      return res.status(503).json({ error: 'Deletion is pending recovery. Please retry.' });
    }
    deletingRooms.delete(candidate.code);
  }
  sessions.delete(sessionId);
  deletingSessions.delete(sessionId);
  deletedSessionHashes.add(persistence.hashSessionId(sessionId));
  return res.json({ ok: true });
}

app.post('/api/privacy/delete-my-data', privacyActionLimit, deleteAuthenticatedPlayerData);
app.post('/api/privacy/delete-all-my-data', privacyActionLimit, deleteAuthenticatedPlayerData);

io.on('connection', socket => {
  socket.on('room:join', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid room credentials');
      const roomCode = parsed.data.roomCode.toUpperCase();
      if (deletingSessions.has(parsed.data.sessionId)) {
        throw new Error('Deletion is pending; retry in Privacy & Data Management');
      }
      if (deletedSessionHashes.has(persistence.hashSessionId(parsed.data.sessionId))) {
        throw new Error('This session has been deleted');
      }
      if (deletingRooms.has(roomCode)) {
        throw new Error('This room is temporarily locked while a data request is processed');
      }
      const room = findActiveRoom(roomCode);
      if (!room) throw new Error('Room not found');
      const member = findSessionMember(room, sessions, parsed.data.sessionId);
      if (!member) throw new Error('Invalid session for this room');
      const boundSession = socketToSession.get(socket.id);
      if (boundSession && boundSession !== parsed.data.sessionId) throw new Error('Socket is already bound to another session');
      const previousSocketId = sessionToSockets.get(parsed.data.sessionId);
      member.online = true;
      socket.join(room.code);
      socketToSession.set(socket.id, parsed.data.sessionId);
      sessionToSockets.set(parsed.data.sessionId, socket.id);
      if (previousSocketId && previousSocketId !== socket.id) {
        io.sockets.sockets.get(previousSocketId)?.disconnect(true);
      }
      socket.to(room.code).emit('player:online', { nickname: member.nickname });
      broadcastRoom(room);
      ack(socket, callback, true, { room: roomView(room, parsed.data.sessionId) });
      socket.to(room.code).emit('connection:restored');
      persistRoom(room);
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
      io.to(room.code).emit('player:ready-updated', { nickname: member.nickname, ready: member.ready });
      persistRoom(room);
      ack(socket, callback, true, { room: roomView(room, parsed.data.sessionId) });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:configure', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = gameConfigPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid game configuration');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      if (room.game) throw new Error('Game settings cannot change after the game starts');
      if (room.switchRequest) throw new Error('Wait for the pending experience request to finish first.');
      room.gameConfig = normalizeGameConfig(parsed.data.config);
      broadcastRoom(room);
      persistRoom(room);
      ack(socket, callback, true, { room: roomView(room, parsed.data.sessionId) });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('experience:switch-request', async (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = experienceSwitchRequestSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid experience selection');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      if (room.players.length !== 2 || !room.game) throw new Error('Both players must join before changing experience.');
      if (parsed.data.kind === 'replay' && room.game.currentPhase !== 'COMPLETED') {
        throw new Error('Play Again is available after both players complete the experience.');
      }
      const config = parsed.data.kind === 'replay'
        ? room.game.config
        : normalizeGameConfig(parsed.data.config);
      if (room.switchRequest) {
        const existing = room.switchRequest;
        if (existing.requestedBy === member.sessionId
            && existing.kind === parsed.data.kind
            && JSON.stringify(existing.config) === JSON.stringify(config)) {
          ack(socket, callback, true, { requestId: existing.requestId });
          return;
        }
        throw new Error('Another experience request is waiting for your partner.');
      }
      room.switchRequest = {
        requestId: randomUUID(),
        requestedBy: member.sessionId,
        kind: parsed.data.kind,
        config,
        requestedAt: new Date().toISOString()
      };
      try {
        await persistRoom(room, false, true);
      } catch {
        room.switchRequest = null;
        throw new Error('Could not save your request. The current experience is unchanged.');
      }
      broadcastRoom(room);
      ack(socket, callback, true, { requestId: room.switchRequest.requestId });
    } catch (error) {
      ack(socket, callback, false, { error: error.message });
    }
  });

  socket.on('experience:switch-response', async (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = experienceSwitchResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid experience response');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      const request = room.switchRequest;
      if (!request || request.requestId !== parsed.data.requestId) throw new Error('This request is no longer available.');
      if (request.requestedBy === member.sessionId) throw new Error('The other player must approve the change.');
      if (!parsed.data.accept) {
        room.switchRequest = null;
        try {
          await persistRoom(room, false, true);
        } catch {
          room.switchRequest = request;
          throw new Error('Could not save your response. Please retry.');
        }
        broadcastRoom(room);
        io.to(room.code).emit('experience:switch-declined');
        ack(socket, callback, true, {});
        return;
      }
      if (room.players.length !== 2 || !room.players.every(player => player.online)) {
        throw new Error('Both players must be connected to approve the change.');
      }
      if (room.game.currentPhase === 'COMPLETED') await persistGameResult(room, true);
      const oldGame = room.game;
      const previous = {
        gameConfig: room.gameConfig,
        previousQuestionIds: room.previousQuestionIds,
        switchRequest: room.switchRequest,
        status: room.status,
        players: room.players
      };
      clearGameTimer(room.code);
      room.game = null;
      room.gameConfig = request.config;
      room.previousQuestionIds = request.kind === 'replay' ? oldGame.usedQuestionIds || [] : [];
      room.switchRequest = null;
      room.status = 'WAITING_FOR_READY';
      room.players = room.players.map(player => ({ ...player, ready: false }));
      try {
        await persistRoom(room, false, true);
      } catch {
        room.game = oldGame;
        Object.assign(room, previous);
        if (oldGame.currentPhase !== 'COMPLETED') scheduleGameTimer(room);
        throw new Error('Could not save the new experience. Your current session is unchanged.');
      }
      broadcastRoom(room);
      io.to(room.code).emit('experience:switched');
      ack(socket, callback, true, {});
    } catch (error) {
      ack(socket, callback, false, { error: error.message });
    }
  });

  socket.on('game:start', async (payload, callback) => {
    let room;
    let oldGame;
    let oldStatus;
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid game start request');
      ({ room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode));
      if (room.game) throw new Error('The game has already started');
      if (room.switchRequest) throw new Error('Wait for the pending experience request to finish first.');
      if (room.players.length !== 2 || !room.players.every(p => p.ready && p.online)) throw new Error('Both players must be ready and online');
      oldGame = room.game;
      oldStatus = room.status;
      room.game = createGame(room.code, room.gameConfig || undefined);
      room.game.currentPhase = 'ANSWERING';
      room.status = 'PLAYING';
      room.game.playerStates = Object.fromEntries(room.players.map((p, seat) => [p.sessionId, {
        sessionId: p.sessionId,
        seat,
        answerSubmitted: false,
        predictionSubmitted: false,
        answer: null,
        answerStyle: null,
        answerIndex: null,
        prediction: null,
        achievements: [],
        achievementProgress: { correctPredictions: 0, actionTags: {}, nairobiRounds: 0 }
      }]));
      room.game.scores = Object.fromEntries(room.players.map(p => [p.sessionId, 0]));
      room.game.participants = room.players.map(({ sessionId, nickname }) => ({ sessionId, nickname }));
      startPhaseTimer(room.game);
      scheduleGameTimer(room);
      try {
        await persistRoom(room, false, true);
      } catch {
        clearGameTimer(room.code);
        room.game = oldGame;
        room.status = oldStatus;
        throw new Error('The new game session could not be saved. Please try again.');
      }
      broadcastRoom(room);
      io.to(room.code).emit('game:started', { roomCode: room.code, timestamp: Date.now() });
      ack(socket, callback, true, {});
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });

  socket.on('game:answer', (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = answerPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid answer request');
      const { room } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      if (expirePhaseIfDue(room)) throw new Error('The answer timer has expired');
      const game = room.game;
      if (!game || game.currentPhase !== 'ANSWERING') throw new Error('Answers are not open');
      const player = game.playerStates[parsed.data.sessionId];
      if (player.answerSubmitted) throw new Error('Answer already submitted');
      const round = getCurrentRound(game);
      const answer = parsed.data.answer.trim();
      const answerIndex = round.choices?.indexOf(answer) ?? -1;
      if (round.answerType === 'text') {
        if (answer.length < 1 || !round.predictionChoices?.includes(parsed.data.answerStyle)) {
          throw new Error('Enter a story and choose its style');
        }
        player.answerStyle = parsed.data.answerStyle;
        player.answerIndex = null;
      } else {
        if (answerIndex < 0 || parsed.data.answerStyle !== undefined) throw new Error('Invalid answer');
        player.answerStyle = null;
        player.answerIndex = answerIndex;
      }
      player.answer = answer;
      player.answerSubmitted = true;
      io.to(room.code).emit('game:answer-received', { timestamp: Date.now() });
      if (Object.values(game.playerStates).every(p => p.answerSubmitted)) {
        game.currentPhase = 'PREDICTING';
        startPhaseTimer(game);
        scheduleGameTimer(room);
      }
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
      if (expirePhaseIfDue(room)) throw new Error('The prediction timer has expired');
      const game = room.game;
      if (!game || game.currentPhase !== 'PREDICTING') throw new Error('Predictions are not open');
      const player = game.playerStates[parsed.data.sessionId];
      const round = getCurrentRound(game);
      const predictionChoices = round.predictionChoices || round.choices;
      if (!predictionChoices.includes(parsed.data.prediction)) throw new Error('Invalid prediction');
      if (player.predictionSubmitted) throw new Error('Prediction already submitted');
      player.prediction = parsed.data.prediction; player.predictionSubmitted = true;
      if (Object.values(game.playerStates).every(p => p.predictionSubmitted)) {
        finishReveal(room);
      } else {
        broadcastRoom(room);
        persistRoom(room);
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
        clearGameTimer(room.code);
        if (game.currentRound >= (game.rounds?.length || scenarios.length) - 1) {
          game.currentPhase = 'COMPLETED';
          game.deadlineAt = null;
          game.completedAt = new Date().toISOString();
          room.status = 'COMPLETED';
          awardCompletionAchievements(game);
          io.to(room.code).emit('game:completed', { scores: publicScores(room), timestamp: Date.now() });
          persistGameResult(room);
        } else {
          game.currentRound += 1;
          resetRound(game);
          startPhaseTimer(game);
          scheduleGameTimer(room);
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
      validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      throw new Error('Play Again requires both players to approve through the experience request.');
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
      member.online = false;
      io.to(room.code).emit('player:left', { nickname: member.nickname });
      socket.leave(room.code);
      if (sessionToSockets.get(parsed.data.sessionId) === socket.id) {
        sessionToSockets.delete(parsed.data.sessionId);
      }
      socketToSession.delete(socket.id);
      broadcastRoom(room);
      persistRoom(room).then(() => {
        ack(socket, callback, true, {});
        socket.disconnect(true);
      }).catch(error => {
        console.error(`Failed to persist room leave: ${error.name || 'database error'}`);
        ack(socket, callback, false, { error: 'Could not save your departure.' });
      });
    } catch (error) { ack(socket, callback, false, { error: error.message }); }
  });
  socket.on('experience:leave', async (payload, callback) => {
    try {
      if (!allowSocketEvent(socket)) throw new Error('Too many requests');
      const parsed = roomPayloadSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid leave request');
      const { room, member } = validateSocket(socket, parsed.data.sessionId, parsed.data.roomCode);
      if (room.game?.currentPhase === 'COMPLETED') await persistGameResult(room, true);
      const previous = {
        players: room.players,
        game: room.game,
        status: room.status,
        switchRequest: room.switchRequest
      };
      clearGameTimer(room.code);
      room.players = room.players.filter(player => player.sessionId !== member.sessionId);
      room.switchRequest = null;
      if (room.game?.currentPhase !== 'COMPLETED') {
        room.game = null;
        room.status = 'WAITING_FOR_PLAYER';
        room.players = room.players.map(player => ({ ...player, ready: false }));
      }
      try {
        await persistRoom(room, false, true);
      } catch {
        Object.assign(room, previous);
        if (room.game && room.game.currentPhase !== 'COMPLETED') scheduleGameTimer(room);
        throw new Error('Could not save your departure. Your current session is unchanged.');
      }
      sessions.delete(member.sessionId);
      ack(socket, callback, true, {});
      disconnectSession(member.sessionId, 'experience:left');
      io.to(room.code).emit('player:left', { nickname: member.nickname });
      broadcastRoom(room);
    } catch (error) {
      ack(socket, callback, false, { error: error.message });
    }
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
        io.to(room.code).emit('player:offline', { nickname: member.nickname });
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
    await persistence.migrateGameResultIndexes();
    await persistence.reconcileDeletionRecords();
    const deletionHashes = await persistence.listDeletionHashes();
    deletionHashes.forEach(hash => deletedSessionHashes.add(hash));
    const deletedRoomCodes = await persistence.listDeletedRoomCodes();
    deletedRoomCodes.forEach(roomCode => deletedRooms.add(roomCode));
    const recoveredRooms = await persistence.recoverRooms();
    for (const room of recoveredRooms) {
      if (!room.players || room.players.length < 1) continue;
      room.players.forEach(player => { player.online = false; });
      rooms.set(room.code, room);
      room.players.forEach(player => {
        sessions.set(player.sessionId, { roomCode: room.code, nickname: player.nickname });
      });
      if (room.game) scheduleGameTimer(room);
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

if (require.main === module) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  start().catch(error => {
    console.error(`Startup failed: ${error.name || 'unknown error'}`);
    process.exit(1);
  });
}

module.exports = { app, server, start };
