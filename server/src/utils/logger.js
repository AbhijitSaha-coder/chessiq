/**
 * ChessIQ v3.3.0 — Structured Pino Telemetry Logger
 * Enforces production JSON output, correlation IDs, and strict redaction of sensitive credentials.
 */

const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

const redactOptions = {
  paths: [
    "req.headers.cookie",
    "req.headers.authorization",
    "headers.cookie",
    "headers.authorization",
    "password",
    "password_hash",
    "passwordHash",
    "jwt",
    "token",
    "secret",
    "cookieSecret",
    "jwtSecret",
    "claim_token",
    "claimToken",
  ],
  censor: "[REDACTED_CREDENTIAL]",
};

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  redact: redactOptions,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

module.exports = logger;
