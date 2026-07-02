import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Počet požadavků na live scraping za okno (výchozí: 6 / 15 min). */
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'test' ? 10_000 : 6);

/** Délka okna v ms (výchozí: 15 minut). */
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

function getClientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Jednoduchý rate limiter – brání hromadnému/obchodnímu scrapingu,
 * který by porušoval podmínky služeb Google.
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = getClientKey(req);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    res.status(429).json({
      error:
        `Překročen limit ${MAX_REQUESTS} vyhledávání za ${WINDOW_MS / 60_000} minut. ` +
        'Aplikace je určena pouze pro demonstrační účely – zkuste to později.',
      retryAfterSeconds: retryAfterSec,
    });
    return;
  }

  entry.count += 1;
  next();
}

/** Pro testy – vyčistí stav limiteru. */
export function resetRateLimitStore(): void {
  store.clear();
}
