const { createLogger, format, transports } = require('winston');

/**
 * Structured logger using Winston.
 *
 * - JSON format for structured log ingestion (ELK, Datadog, etc.)
 * - Configurable level via LOG_LEVEL env var (default: 'info')
 * - Adds timestamp, service label, and error stack traces automatically
 */
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'skillswap-api' },
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.errors({ stack: true }),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

module.exports = logger;
