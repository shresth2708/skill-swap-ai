/**
 * Integration tests for chat socket events.
 *
 * Uses socket.io-client to connect to a real Socket.io server.
 * Mocks: Prisma, JWT verification, ChatService.
 */

// ── Mock Prisma ──
jest.mock('../config/db.config', () => ({
  $connect: jest.fn().mockResolvedValue(true),
  $disconnect: jest.fn().mockResolvedValue(true),
  swap: {
    findUnique: jest.fn(),
  },
  chat: {
    findUnique: jest.fn(),
  },
}));

// ── Mock ChatService ──
jest.mock('../services/chat.service', () => ({
  createChatForSwap: jest.fn(),
  sendMessage: jest.fn(),
  markMessagesRead: jest.fn(),
}));

// ── Mock JWT ──
jest.mock('../utils/jwt.util', () => ({
  verifyToken: jest.fn(),
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
}));

// ── Mock Redis (no real Redis in tests) ──
jest.mock('ioredis', () => {
  const Redis = jest.fn(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
    duplicate: jest.fn().mockReturnThis(),
    on: jest.fn(),
    status: 'ready',
  }));
  return Redis;
});

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn(() => {
    // Return a no-op adapter factory
    return function NoopAdapter(nsp) {
      return Object.create(null);
    };
  }),
}));

const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const { setupSocket } = require('../socket/chat.socket');
const { verifyToken } = require('../utils/jwt.util');
const prisma = require('../config/db.config');
const chatService = require('../services/chat.service');

let httpServer, io, port;

function createClient(token) {
  return Client(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
}

beforeAll((done) => {
  // Remove REDIS_URL to avoid actual Redis connections in test
  delete process.env.REDIS_URL;

  httpServer = createServer();
  io = setupSocket(httpServer);
  httpServer.listen(0, () => {
    port = httpServer.address().port;
    done();
  });
});

afterAll((done) => {
  io.close();
  httpServer.close(done);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Chat Socket Integration', () => {
  // ──────────────────────────────────────────
  // Authentication
  // ──────────────────────────────────────────
  describe('Authentication', () => {
    it('should disconnect immediately when no JWT is provided', (done) => {
      const client = createClient(undefined);

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        client.disconnect();
        done();
      });
    });

    it('should disconnect when an invalid JWT is provided', (done) => {
      verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const client = createClient('bad-token');

      client.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        client.disconnect();
        done();
      });
    });

    it('should connect successfully with a valid JWT', (done) => {
      verifyToken.mockReturnValue({ id: 'user-1', email: 'a@test.com' });

      const client = createClient('valid-token');

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });
    });
  });

  // ──────────────────────────────────────────
  // chat:join
  // ──────────────────────────────────────────
  describe('chat:join', () => {
    it('should return error when joining a non-participant swap', (done) => {
      verifyToken.mockReturnValue({ id: 'outsider', email: 'x@test.com' });
      prisma.swap.findUnique.mockResolvedValue({
        id: 'swap-1',
        initiatorId: 'user-a',
        receiverId: 'user-b',
      });

      const client = createClient('token');

      client.on('connect', () => {
        client.emit('chat:join', { swapId: 'swap-1' });
      });

      client.on('chat:error', (err) => {
        expect(err.code).toBe('FORBIDDEN');
        client.disconnect();
        done();
      });
    });

    it('should return error when swap does not exist', (done) => {
      verifyToken.mockReturnValue({ id: 'user-a', email: 'a@test.com' });
      prisma.swap.findUnique.mockResolvedValue(null);

      const client = createClient('token');

      client.on('connect', () => {
        client.emit('chat:join', { swapId: 'nonexistent' });
      });

      client.on('chat:error', (err) => {
        expect(err.code).toBe('NOT_FOUND');
        client.disconnect();
        done();
      });
    });
  });

  // ──────────────────────────────────────────
  // chat:message
  // ──────────────────────────────────────────
  describe('chat:message', () => {
    it('should persist message and broadcast to room', (done) => {
      const SWAP_ID = 'swap-msg-1';
      const CHAT_ID = 'chat-msg-1';

      verifyToken.mockReturnValue({ id: 'user-a', email: 'a@test.com' });

      prisma.swap.findUnique.mockResolvedValue({
        id: SWAP_ID,
        initiatorId: 'user-a',
        receiverId: 'user-b',
      });

      prisma.chat.findUnique.mockResolvedValue({ id: CHAT_ID, swapId: SWAP_ID });

      const savedMsg = {
        id: 'msg-saved-1',
        chatId: CHAT_ID,
        senderId: 'user-a',
        content: 'Hello world',
        msgType: 'TEXT',
        sentAt: new Date().toISOString(),
      };
      chatService.sendMessage.mockResolvedValue(savedMsg);

      const clientA = createClient('token-a');

      clientA.on('connect', () => {
        clientA.emit('chat:join', { swapId: SWAP_ID });

        // Small delay to let the join complete
        setTimeout(() => {
          clientA.emit('chat:message', {
            swapId: SWAP_ID,
            content: 'Hello world',
            msgType: 'TEXT',
          });
        }, 100);
      });

      clientA.on('chat:message', (msg) => {
        expect(msg.id).toBe('msg-saved-1');
        expect(msg.content).toBe('Hello world');
        expect(chatService.sendMessage).toHaveBeenCalled();
        clientA.disconnect();
        done();
      });
    });
  });

  // ──────────────────────────────────────────
  // chat:read
  // ──────────────────────────────────────────
  describe('chat:read', () => {
    it('should mark messages as read and emit read receipt', (done) => {
      const SWAP_ID = 'swap-read-1';
      const CHAT_ID = 'chat-read-1';

      verifyToken.mockReturnValue({ id: 'user-b', email: 'b@test.com' });

      prisma.swap.findUnique.mockResolvedValue({
        id: SWAP_ID,
        initiatorId: 'user-a',
        receiverId: 'user-b',
      });

      prisma.chat.findUnique.mockResolvedValue({ id: CHAT_ID, swapId: SWAP_ID });
      chatService.markMessagesRead.mockResolvedValue(3);

      const client = createClient('token');

      client.on('connect', () => {
        client.emit('chat:join', { swapId: SWAP_ID });

        setTimeout(() => {
          client.emit('chat:read', { swapId: SWAP_ID });
        }, 100);
      });

      client.on('chat:read-receipt', (receipt) => {
        expect(receipt.userId).toBe('user-b');
        expect(receipt.readAt).toBeDefined();
        expect(chatService.markMessagesRead).toHaveBeenCalledWith(CHAT_ID, 'user-b');
        client.disconnect();
        done();
      });
    });
  });
});
