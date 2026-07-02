import fs from 'fs';
import path from 'path';
import {
  mapSerperResponseToResults,
  mergeOrganicResults,
  SerperSearchResponse,
} from '../src/googleSearch';

const FIXTURES_DIR = path.join(__dirname, '..', '__fixtures__');

function loadFixture(name: string): SerperSearchResponse {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8'));
}

describe('mapSerperResponseToResults', () => {
  it('vrátí správný počet organických výsledků z fixture', () => {
    const data = loadFixture('serper-response-sample.json');
    const results = mapSerperResponseToResults(data);
    expect(results).toHaveLength(7);
  });

  it('má u každé položky správnou strukturu polí', () => {
    const data = loadFixture('serper-response-sample.json');
    const results = mapSerperResponseToResults(data);

    for (const result of results) {
      expect(result).toMatchObject({
        position: expect.any(Number),
        title: expect.any(String),
        url: expect.any(String),
        snippet: expect.any(String),
      });
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.url).toMatch(/^https?:\/\//);
    }
  });

  it('mapuje link ze Serper API na url v interním formátu', () => {
    const data = loadFixture('serper-response-sample.json');
    const results = mapSerperResponseToResults(data);
    const first = results[0];

    expect(first.url).toBe(data.organic![0].link);
    expect(first.title).toBe('Pes domácí – Wikipedie');
    expect(first.position).toBe(1);
    expect(first.snippet).toContain('domestikované');
  });

  it('vrátí prázdné pole při chybějícím organic', () => {
    expect(mapSerperResponseToResults({})).toEqual([]);
    expect(mapSerperResponseToResults({ organic: undefined })).toEqual([]);
  });

  it('vrátí prázdné pole při prázdném organic', () => {
    expect(mapSerperResponseToResults({ organic: [] })).toEqual([]);
  });

  it('zachová přesně tolik pozic, kolik vrátí Serper (bez ořezu)', () => {
    const data: SerperSearchResponse = {
      organic: Array.from({ length: 3 }, (_, i) => ({
        title: `Výsledek ${i + 1}`,
        link: `https://example.com/${i + 1}`,
        snippet: `Snippet ${i + 1}`,
        position: i + 1,
      })),
    };
    expect(mapSerperResponseToResults(data)).toHaveLength(3);
  });
});

describe('mergeOrganicResults', () => {
  it('doplní chybějící výsledek ze druhé stránky a přečísluje pozice 1–10', () => {
    const page1 = Array.from({ length: 9 }, (_, i) => ({
      position: i + 1,
      title: `Strana 1 – ${i + 1}`,
      url: `https://example.com/p1-${i + 1}`,
      snippet: `Snippet ${i + 1}`,
    }));

    const page2 = [
      {
        position: 10,
        title: 'Desátý výsledek ze strany 2',
        url: 'https://example.com/p2-10',
        snippet: 'Snippet 10',
      },
    ];

    const results = mergeOrganicResults([page1, page2]);

    expect(results).toHaveLength(10);
    expect(results[9].title).toBe('Desátý výsledek ze strany 2');
    expect(results[9].position).toBe(10);
    expect(results.map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('neopakuje duplicitní URL mezi stránkami', () => {
    const page1 = [
      {
        position: 1,
        title: 'A',
        url: 'https://example.com/a',
        snippet: 'a',
      },
    ];
    const page2 = [
      {
        position: 2,
        title: 'A duplicate',
        url: 'https://example.com/a',
        snippet: 'dup',
      },
      {
        position: 3,
        title: 'B',
        url: 'https://example.com/b',
        snippet: 'b',
      },
    ];

    const results = mergeOrganicResults([page1, page2], 10);
    expect(results).toHaveLength(2);
    expect(results[1].url).toBe('https://example.com/b');
  });
});

describe('searchGoogle (Serper API)', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.SERPER_API_KEY;

  beforeEach(() => {
    process.env.SERPER_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.SERPER_API_KEY = originalApiKey;
  });

  it('vyhodí SearchApiError při chybějícím SERPER_API_KEY', async () => {
    const { searchGoogle } = await import('../src/googleSearch');
    const { SearchApiError } = await import('../src/types');
    delete process.env.SERPER_API_KEY;

    await expect(searchGoogle('test')).rejects.toThrow(SearchApiError);
    await expect(searchGoogle('test')).rejects.toThrow(/SERPER_API_KEY/i);
  });

  it('volá Serper API se správným tělem a hlavičkami', async () => {
    const fixture: SerperSearchResponse = {
      organic: Array.from({ length: 10 }, (_, i) => ({
        title: `Výsledek ${i + 1}`,
        link: `https://example.com/${i + 1}`,
        snippet: `Snippet ${i + 1}`,
        position: i + 1,
      })),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fixture,
    }) as unknown as typeof fetch;

    const { searchGoogle } = await import('../src/googleSearch');
    const results = await searchGoogle('pes');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://google.serper.dev/search',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'X-API-KEY': 'test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: 'pes', gl: 'cz', hl: 'cs', num: 10, page: 1 }),
      })
    );
    expect(results).toHaveLength(10);
  });

  it('načte druhou stránku, pokud první vrátí méně než 10 výsledků', async () => {
    const page1: SerperSearchResponse = {
      organic: Array.from({ length: 9 }, (_, i) => ({
        title: `Výsledek ${i + 1}`,
        link: `https://example.com/${i + 1}`,
        snippet: `Snippet ${i + 1}`,
        position: i + 1,
      })),
    };
    const page2: SerperSearchResponse = {
      organic: [
        {
          title: 'Desátý výsledek',
          link: 'https://example.com/10',
          snippet: 'Snippet 10',
          position: 10,
        },
      ],
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => page1,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => page2,
      }) as unknown as typeof fetch;

    const { searchGoogle } = await import('../src/googleSearch');
    const results = await searchGoogle('pes');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual({
      q: 'pes',
      gl: 'cz',
      hl: 'cs',
      num: 10,
      page: 2,
    });
    expect(results).toHaveLength(10);
    expect(results[9].url).toBe('https://example.com/10');
  });

  it('vyhodí SearchApiError při HTTP 429', async () => {
    const { searchGoogle } = await import('../src/googleSearch');
    const { SearchApiError } = await import('../src/types');

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(searchGoogle('test')).rejects.toThrow(SearchApiError);
    await expect(searchGoogle('test')).rejects.toThrow(/limit/i);
  });
});
