import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { searchGoogle } from './googleSearch';
import { rateLimitMiddleware } from './rateLimit';
import { SearchApiError, SearchResponse } from './types';

const PORT = Number(process.env.PORT) || 3000;

export function createApp(): express.Application {
  const app = express();

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  app.get('/api/search', rateLimitMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

      if (!q) {
        res.status(400).json({
          error: 'Chybí parametr q – zadejte vyhledávací dotaz.',
        });
        return;
      }

      const results = await searchGoogle(q);

      const payload: SearchResponse = {
        query: q,
        fetchedAt: new Date().toISOString(),
        results,
      };

      res.status(200).json(payload);
    } catch (err) {
      if (err instanceof SearchApiError) {
        res.status(502).json({
          error: err.message,
        });
        return;
      }
      next(err);
    }
  });

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Neočekávaná chyba:', err);
    res.status(500).json({ error: 'Interní chyba serveru.' });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
  });
}
