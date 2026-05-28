/**
 * retry.ts — Exponential-backoff retry with jitter.
 */

import { logger } from "./logger.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry with the error and attempt number */
  onRetry?: (err: unknown, attempt: number) => void;
}

/**
 * Run `fn` up to `maxAttempts` times with exponential backoff.
 * Throws the last error if all attempts fail.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1_000,
    maxDelayMs = 30_000,
    onRetry,
  } = opts;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;

      const base  = initialDelayMs * 2 ** (attempt - 1);
      const jitter = Math.random() * 500;
      const delay = Math.min(base + jitter, maxDelayMs);

      logger.warn(`[retry] "${label}" failed (attempt ${attempt}/${maxAttempts}), retrying in ${Math.round(delay)}ms`, {
        error: err instanceof Error ? err.message : String(err),
      });

      onRetry?.(err, attempt);
      await sleep(delay);
    }
  }

  throw lastErr;
}
