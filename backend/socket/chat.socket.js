const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const appRedis = require('../cache/redis.client');
const { resolveRedisUrl, IOREDIS_OPTIONS } = require('../utils/redis-url.util');
const { verifyToken } = require('../utils/jwt.util');
const chatService = require('../services/chat.service');
const prisma = require('../config/db.config');
const logger = require('../utils/logger');

let io;

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const isLocalDevOrigin = (origin) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const socketCorsOriginValidator = (origin, callback) => {
  // Allow tools/clients without Origin header
  if (!origin) return callback(null, true);

  // Always allow local development origins (any localhost / 127.0.0.1 port).
  if (isLocalDevOrigin(origin)) return callback(null, true);

  if (configuredOrigins.length > 0) {
    return callback(null, configuredOrigins.includes(origin));
  }

  return callback(null, false);
};

/**
 * In-memory typing indicator tracker.
 * Map<swapId, Map<userId, timeoutHandle>>
 */
const typingMap = new Map();

const TYPING_TIMEOUT_MS = 5000;
const PRESENCE_TTL_SECONDS = 300;
const PRESENCE_KEY_PREFIX = 'skillswap:online:';

/**
 * Shared Redis client for presence operations.
 * Reuses a long-lived connection instead of creating one per call.
 * Reuse the app cache Redis client so we do not open a 4th connection
 * (Upstash free tier limits can cause ECONNRESET + MaxRetriesPerRequest with many clients).
 * @returns {import('ioredis').Redis|null}
 */
function getPresenceRedisClient() {
  if (!process.env.REDIS_URL) return null;
  return appRedis.getIoredis();
}

/**
 * Map<userId, number> — tracks how many sockets a user has open.
 * Only marks offline when the last socket disconnects.
 */
const connectionCounts = new Map();

/**
 * Sets up the Socket.io server with Redis adapter, authentication,
 * online presence, typing indicators, and chat event handling.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const setupSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: socketCorsOriginValidator,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 60000,
    pingTimeout: 30000,
  });

  // ──────────────────────────────────────────────────
  // Redis Adapter for horizontal scaling
  // ──────────────────────────────────────────────────
  if (process.env.REDIS_URL) {
    try {
      const url = resolveRedisUrl(process.env.REDIS_URL);
      // Do not use duplicate() — it can keep default maxRetriesPerRequest and break on Upstash.
      const pubClient = new Redis(url, IOREDIS_OPTIONS);
      const subClient = new Redis(url, IOREDIS_OPTIONS);
      for (const c of [pubClient, subClient]) {
        c.on('error', (err) => {
          logger.warn('Socket.io Redis adapter client error', { error: err.message });
        });
      }
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io: Redis adapter attached (horizontal scaling enabled)');
    } catch (err) {
      logger.warn('Socket.io: Redis adapter failed, falling back to in-memory', { error: err.message });
    }
  }

  // ──────────────────────────────────────────────────
  // Authentication Middleware
  // ──────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token, false);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // ──────────────────────────────────────────────────
  // Connection Handler
  // ──────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    logger.info(`User connected: ${userId}`);

    // Join per-user room for in-app notifications
    socket.join(`user:${userId}`);

    // ── Online Presence: increment connection count & mark online ──
    const currentCount = (connectionCounts.get(userId) || 0) + 1;
    connectionCounts.set(userId, currentCount);
    await setOnline(userId);

    // ── chat:join ──
    socket.on('chat:join', async ({ swapId }) => {
      try {
        const swap = await prisma.swap.findUnique({ where: { id: swapId } });

        if (!swap) {
          return socket.emit('chat:error', { code: 'NOT_FOUND', message: 'Swap not found' });
        }

        if (swap.initiatorId !== userId && swap.receiverId !== userId) {
          return socket.emit('chat:error', { code: 'FORBIDDEN', message: 'Not a participant of this swap' });
        }

        const room = `swap:${swapId}`;
        socket.join(room);

        // Broadcast online status to room participants
        socket.to(room).emit('presence:online', { userId, isOnline: true });

        logger.info(`User ${userId} joined room ${room}`);
      } catch (err) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: err.message });
      }
    });

    // ── chat:message ──
    socket.on('chat:message', async (data) => {
      const { swapId, content, msgType } = data;
      try {
        const room = `swap:${swapId}`;

        // Find or create chat for this swap
        let chat = await prisma.chat.findUnique({ where: { swapId } });
        if (!chat) {
          chat = await chatService.createChatForSwap(swapId);
        }

        const message = await chatService.sendMessage(chat.id, userId, { content, msgType });

        // Broadcast serialized message (no raw Prisma objects)
        io.to(room).emit('chat:message', message);
      } catch (err) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: err.message });
      }
    });

    // ── chat:typing (with server-side auto-clear) ──
    socket.on('chat:typing', ({ swapId }) => {
      const room = `swap:${swapId}`;

      // Broadcast to room excluding sender
      socket.to(room).emit('chat:typing', { userId });

      // Auto-clear typing after TYPING_TIMEOUT_MS of silence
      if (!typingMap.has(swapId)) {
        typingMap.set(swapId, new Map());
      }
      const swapTyping = typingMap.get(swapId);

      // Clear existing timeout for this user
      if (swapTyping.has(userId)) {
        clearTimeout(swapTyping.get(userId));
      }

      // Set new timeout to emit stop-typing
      const handle = setTimeout(() => {
        socket.to(room).emit('chat:stop-typing', { userId });
        swapTyping.delete(userId);
        if (swapTyping.size === 0) typingMap.delete(swapId);
      }, TYPING_TIMEOUT_MS);

      swapTyping.set(userId, handle);
    });

    // ── chat:read ──
    socket.on('chat:read', async ({ swapId }) => {
      try {
        const chat = await prisma.chat.findUnique({ where: { swapId } });
        if (chat) {
          await chatService.markMessagesRead(chat.id, userId);

          const room = `swap:${swapId}`;
          io.to(room).emit('chat:read-receipt', {
            userId,
            readAt: new Date(),
          });
        }
      } catch (err) {
        socket.emit('chat:error', { code: 'SERVER_ERROR', message: err.message });
      }
    });

    // ── chat:leave ──
    socket.on('chat:leave', ({ swapId }) => {
      const room = `swap:${swapId}`;
      socket.leave(room);
      logger.info(`User ${userId} left room ${room}`);
    });

    // ── Heartbeat for presence TTL refresh ──
    socket.on('heartbeat', async () => {
      await setOnline(userId);
    });

    // ── Disconnect ──
    socket.on('disconnect', async () => {
      // Decrement connection count; only go offline when last socket closes
      const remaining = (connectionCounts.get(userId) || 1) - 1;
      if (remaining <= 0) {
        connectionCounts.delete(userId);
        await setOffline(userId);
      } else {
        connectionCounts.set(userId, remaining);
      }

      // Clean up any typing indicators for this user
      for (const [swapId, swapTyping] of typingMap.entries()) {
        if (swapTyping.has(userId)) {
          clearTimeout(swapTyping.get(userId));
          swapTyping.delete(userId);
          io.to(`swap:${swapId}`).emit('chat:stop-typing', { userId });
        }
        if (swapTyping.size === 0) typingMap.delete(swapId);
      }

      logger.info(`User disconnected: ${userId}`);
    });
  });

  return io;
};

// ──────────────────────────────────────────────────
// Online Presence helpers (Redis-backed, shared client)
// ──────────────────────────────────────────────────

/**
 * Mark user as online with TTL.
 * Falls back to no-op if Redis is not available.
 */
async function setOnline(userId) {
  try {
    const client = getPresenceRedisClient();
    if (!client) return;
    await client.set(`${PRESENCE_KEY_PREFIX}${userId}`, '1', 'EX', PRESENCE_TTL_SECONDS);
  } catch (err) {
    logger.warn('Presence setOnline failed', { userId, error: err.message });
  }
}

/**
 * Mark user as offline.
 */
async function setOffline(userId) {
  try {
    const client = getPresenceRedisClient();
    if (!client) return;
    await client.del(`${PRESENCE_KEY_PREFIX}${userId}`);
  } catch (err) {
    logger.warn('Presence setOffline failed', { userId, error: err.message });
  }
}

/**
 * Check if a user is online.
 * @param {string} userId
 * @returns {Promise<{isOnline: boolean, presenceAvailable: boolean}>}
 */
async function isUserOnline(userId) {
  const client = getPresenceRedisClient();
  if (!client) return { isOnline: false, presenceAvailable: false };

  try {
    const val = await client.get(`${PRESENCE_KEY_PREFIX}${userId}`);
    return { isOnline: val === '1', presenceAvailable: true };
  } catch (err) {
    logger.warn('Presence isOnline check failed', { userId, error: err.message });
    return { isOnline: false, presenceAvailable: false };
  }
}

/**
 * Gracefully close the shared presence Redis client.
 * Call during application shutdown.
 */
async function closePresenceClient() {
  // Presence uses appRedis.getIoredis(); quit is handled in redisClient.disconnect()
}

module.exports = {
  setupSocket,
  getIo: () => io,
  isUserOnline,
  closePresenceClient,
};
