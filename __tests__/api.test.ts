import request from 'supertest';
import { createApp } from '../src/server';
import * as googleScraper from '../src/googleScraper';
import { OrganicResult } from '../src/types';

jest.mock('../src/googleScraper');

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
  });

  it('vrátí 200 a správně formátovaný JSON při platném dotazu', async () => {
    jest.spyOn(googleScraper, 'searchGoogle').mockResolvedValue(mockResults);

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
    expect(googleScraper.searchGoogle).toHaveBeenCalledWith('test');
  });

  it('vrátí 400 při chybějícím parametru q', async () => {
    const res = await request(app).get('/api/search');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: expect.stringMatching(/chybí parametr q/i),
    });
    expect(googleScraper.searchGoogle).not.toHaveBeenCalled();
  });

  it('vrátí 400 při prázdném parametru q', async () => {
    const res = await request(app).get('/api/search').query({ q: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('vrátí 200 s prázdným polem results při žádných výsledcích', async () => {
    jest.spyOn(googleScraper, 'searchGoogle').mockResolvedValue([]);

    const res = await request(app).get('/api/search').query({ q: 'nicnenajdes' });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('vrátí 502 při GoogleScrapeError', async () => {
    const { GoogleScrapeError } = await import('../src/types');
    jest
      .spyOn(googleScraper, 'searchGoogle')
      .mockRejectedValue(new GoogleScrapeError('Google blokace'));

    const res = await request(app).get('/api/search').query({ q: 'test' });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/blokace/i);
  });
});
