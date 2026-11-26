const { z } = require('zod');
const { getCompatibleCategories } = require('./game/content');

const roomCodeSchema = z.string().trim().regex(/^[a-f0-9]{12}$/i);
const sessionSchema = z.string().min(20).max(256);
const roomPayloadSchema = z.object({
  roomCode: roomCodeSchema,
  sessionId: sessionSchema
});
const gameConfigSchema = z.object({
  experience: z.enum(['classic', 'kenyan']),
  mode: z.enum(['classic', 'comedy', 'romance', 'savage', 'mind-reader']),
  category: z.enum(['classic', 'mixed', 'funny-predictions', 'complete-story', 'truth-bluff', 'who-more-likely', 'sheng-battle', 'romantic-comedy', 'mini-challenge']),
  pack: z.enum(['mixed', 'matatu-madness', 'choma-na-story', 'campus-chronicles', 'nairobi-vibes', 'mapenzi-na-drama', 'sheng-central']),
  language: z.enum(['english', 'swahili', 'sheng', 'mixed']),
  timerSeconds: z.union([z.literal(0), z.literal(10), z.literal(15), z.literal(20)])
}).superRefine((config, context) => {
  if (config.experience === 'kenyan'
      && !getCompatibleCategories(config.mode, config.pack).includes(config.category)) {
    context.addIssue({
      code: 'custom',
      path: ['category'],
      message: 'This game mode, category, and content pack combination is unavailable'
    });
  }
});

module.exports = {
  roomPayloadSchema,
  gameConfigSchema,
  gameConfigPayloadSchema: roomPayloadSchema.extend({ config: gameConfigSchema }),
  experienceSwitchRequestSchema: roomPayloadSchema.extend({
    kind: z.enum(['switch', 'replay']),
    config: gameConfigSchema.optional()
  }).superRefine((request, context) => {
    if (request.kind === 'switch' && !request.config) {
      context.addIssue({ code: 'custom', path: ['config'], message: 'A valid experience configuration is required' });
    }
    if (request.kind === 'replay' && request.config) {
      context.addIssue({ code: 'custom', path: ['config'], message: 'Replay configuration is selected by the server' });
    }
  }),
  experienceSwitchResponseSchema: roomPayloadSchema.extend({
    requestId: z.string().uuid(),
    accept: z.boolean()
  }),
  readyPayloadSchema: roomPayloadSchema.extend({ ready: z.boolean() }),
  answerPayloadSchema: roomPayloadSchema.extend({
    answer: z.string().min(1).max(280),
    answerStyle: z.string().max(100).optional()
  }),
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
