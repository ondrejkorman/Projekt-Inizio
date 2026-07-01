import fs from 'fs';
import path from 'path';
import { parseGoogleResults } from '../src/googleScraper';
import { GoogleScrapeError } from '../src/types';

const FIXTURES_DIR = path.join(__dirname, '..', '__fixtures__');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

describe('parseGoogleResults', () => {
  const sampleHtml = loadFixture('google-results-sample.html');

  it('vrátí přesně 10 organických výsledků z fixture', () => {
    const results = parseGoogleResults(sampleHtml);
    expect(results).toHaveLength(10);
  });

  it('neobsahuje reklamní nebo neorganické bloky', () => {
    const results = parseGoogleResults(sampleHtml);

    for (const result of results) {
      expect(result.url).not.toMatch(/ads\.example\.com/);
      expect(result.title.toLowerCase()).not.toContain('reklama');
      expect(result.title).not.toBe('Knowledge Panel');
      expect(result.title).not.toContain('Lidé se také ptají');
    }
  });

  it('má u každého výsledku správnou strukturu a validní URL', () => {
    const results = parseGoogleResults(sampleHtml);
    const first = results[0];

    expect(first).toMatchObject({
      position: 1,
      title: expect.any(String),
      url: expect.any(String),
      snippet: expect.any(String),
    });

    expect(first.title.length).toBeGreaterThan(0);
    expect(first.url).toMatch(/^https?:\/\//);
    expect(first.snippet.length).toBeGreaterThan(0);

    // Ověření konkrétních hodnot prvního výsledku
    expect(first.title).toBe('První organický výsledek – úvod do testování');
    expect(first.url).toBe('https://www.example.com/prvni-clanek');
  });

  it('přiřadí pozice 1–10 postupně', () => {
    const results = parseGoogleResults(sampleHtml);
    const positions = results.map((r) => r.position);
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('vyhodí GoogleScrapeError při CAPTCHA stránce', () => {
    const captchaHtml = loadFixture('google-captcha.html');
    expect(() => parseGoogleResults(captchaHtml)).toThrow(GoogleScrapeError);
    expect(() => parseGoogleResults(captchaHtml)).toThrow(/CAPTCHA|blokaci/i);
  });
});
