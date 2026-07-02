import request from 'supertest';
import { createApp } from '../src/server';
import * as googleSearch from '../src/googleSearch';
import { resetRateLimitStore } from '../src/rateLimit';
import { MAX_QUERY_LENGTH } from '../src/validateQuery';
import { OrganicResult } from '../src/types';

jest.mock('../src/googleSearch');

const mockResults: OrganicResult[] = [
  {
    position: 1,
    title: 'Mock výsledek',
    url: 'https://example.com/mock',
    snippet: 'Mock snippet pro test.',
  },
];

describe('GET /api/search', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimitStore();
  });

  it('vrátí 200 a správně formátovaný JSON při platném dotazu', async () => {
    jest.spyOn(googleSearch, 'searchGoogle').mockResolvedValue(mockResults);

    const res = await request(app).get('/api/search').query({ q: 'test' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      query: 'test',
      fetchedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      results: [
        {
          position: 1,
          title: 'Mock výsledek',
          url: 'https://example.com/mock',
          snippet: 'Mock snippet pro test.',
        },
      ],
    });
    expect(googleSearch.searchGoogle).toHaveBeenCalledWith('test');
  });

  it('vrátí 400 při chybějícím parametru q', async () => {
    const res = await request(app).get('/api/search');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: expect.stringMatching(/chybí parametr q/i),
    });
    expect(googleSearch.searchGoogle).not.toHaveBeenCalled();
  });

  it('vrátí 400 při prázdném parametru q', async () => {
    const res = await request(app).get('/api/search').query({ q: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/chybí parametr q/i);
    expect(googleSearch.searchGoogle).not.toHaveBeenCalled();
  });

  it('vrátí 400 při dotazu pouze z whitespace znaků', async () => {
    const res = await request(app).get('/api/search').query({ q: '\t\n  \t' });

    expect(res.status).toBe(400);
    expect(googleSearch.searchGoogle).not.toHaveBeenCalled();
  });

  it('vrátí 400 při příliš dlouhém dotazu', async () => {
    const longQuery = 'a'.repeat(MAX_QUERY_LENGTH + 1);
    const res = await request(app).get('/api/search').query({ q: longQuery });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/příliš dlouhý/i);
    expect(googleSearch.searchGoogle).not.toHaveBeenCalled();
  });

  it('vrátí 200 pro dotaz s diakritikou', async () => {
    jest.spyOn(googleSearch, 'searchGoogle').mockResolvedValue(mockResults);

    const res = await request(app).get('/api/search').query({ q: 'žížala' });

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('žížala');
    expect(googleSearch.searchGoogle).toHaveBeenCalledWith('žížala');
  });

  it('vrátí 200 s prázdným polem results při žádných výsledcích', async () => {
    jest.spyOn(googleSearch, 'searchGoogle').mockResolvedValue([]);

    const res = await request(app).get('/api/search').query({ q: 'nicnenajdes' });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('vrátí 502 při SearchApiError', async () => {
    const { SearchApiError } = await import('../src/types');
    jest
      .spyOn(googleSearch, 'searchGoogle')
      .mockRejectedValue(new SearchApiError('Neplatný SERPER_API_KEY'));

    const res = await request(app).get('/api/search').query({ q: 'test' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/SERPER_API_KEY/i);
  });
});
