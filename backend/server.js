require('dotenv').config();
const app = require('./app');
const { envConfig } = require('./config/env.config');
const prisma = require('./config/db.config');
const redisClient = require('./cache/redis.client');
const logger = require('./utils/logger');
const NotificationService = require('./services/notification.service');
const CronJobManager = require('./cron/session-reminders.cron');
const { createServer } = require('http');
const { setupSocket, closePresenceClient } = require('./socket/chat.socket');
const EmailObserver = require('./observers/email.observer');
const PushObserver = require('./observers/push.observer');
const InAppObserver = require('./observers/inapp.observer');

const PORT = envConfig.PORT || 3000;

async function startServer() {
  try {
    // Attempt DB connect validation
    await prisma.$connect();
    logger.info('Connected to database successfully');

    // Start cron jobs
    const cronManager = new CronJobManager();
    cronManager.startAll();

    const httpServer = createServer(app);
    const io = setupSocket(httpServer);

    // Phase 4B wiring: Subject + concrete observers
    const notificationService = new NotificationService();
    notificationService.addObserver(new EmailObserver());
    notificationService.addObserver(new PushObserver());
    notificationService.addObserver(new InAppObserver(io));
    notificationService.registerListeners();

    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start the server', { error: error.message });
    process.exit(1);
  }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await closePresenceClient();
  await redisClient.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await closePresenceClient();
  await redisClient.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});
