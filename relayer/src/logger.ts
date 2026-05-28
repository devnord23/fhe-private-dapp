/**
 * logger.ts — Simple structured logger.
 */

import { Config } from "./config.js";

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[Config.logLevel];
}

function fmt(level: Level, msg: string, meta?: Record<string, unknown>): string {
  const ts  = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  const base = `[${ts}] ${tag} ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("debug")) console.debug(fmt("debug", msg, meta));
  },
  info: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("info")) console.info(fmt("info", msg, meta));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("warn")) console.warn(fmt("warn", msg, meta));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    if (shouldLog("error")) console.error(fmt("error", msg, meta));
  },
};
