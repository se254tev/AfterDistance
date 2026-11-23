const { z } = require('zod');

const roomCodeSchema = z.string().trim().regex(/^[a-f0-9]{12}$/i);
const sessionSchema = z.string().min(20).max(256);
const roomPayloadSchema = z.object({
  roomCode: roomCodeSchema,
  sessionId: sessionSchema
});

module.exports = {
  roomPayloadSchema,
  readyPayloadSchema: roomPayloadSchema.extend({ ready: z.boolean() }),
  answerPayloadSchema: roomPayloadSchema.extend({ answer: z.string().min(1).max(100) }),
  predictionPayloadSchema: roomPayloadSchema.extend({ prediction: z.string().min(1).max(100) }),
  typingPayloadSchema: roomPayloadSchema.extend({ typing: z.boolean() }),
  canJoinRoom: room => Boolean(room && Array.isArray(room.players) && room.players.length < 2),
  createSocketEventRateLimiter: (limit = 20, windowMs = 10_000) => {
    const buckets = new WeakMap();
    return socket => {
      const now = Date.now();
      let bucket = buckets.get(socket);
      if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
      bucket.count += 1;
      buckets.set(socket, bucket);
      return bucket.count <= limit;
    };
  }
};
