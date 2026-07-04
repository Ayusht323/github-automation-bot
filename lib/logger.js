import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Redact sensitive fields from logs — secrets never appear
  redact: {
    paths: [
      "access_token",
      "accessToken",
      "refresh_token",
      "refreshToken",
      "authorization",
      "cookie",
      "*.access_token",
      "*.accessToken",
      "payload.installation.access_tokens_url",
    ],
    censor: "[REDACTED]",
  },
  // Use pino-pretty in development for readable output
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  }),
});

export default logger;
