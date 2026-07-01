import { escapeCsvValue, resultsToCsv } from '../src/exporters';
import { OrganicResult } from '../src/types';

describe('exporters', () => {
  describe('escapeCsvValue', () => {
    it('neescapuje jednoduché hodnoty', () => {
      expect(escapeCsvValue('hello')).toBe('hello');
    });

    it('escapuje hodnoty s čárkou/oddělovačem', () => {
      expect(escapeCsvValue('a;b', ';')).toBe('"a;b"');
    });

    it('escapuje hodnoty s uvozovkami – zdvojí je', () => {
      expect(escapeCsvValue('řekl "ahoj"', ';')).toBe('"řekl ""ahoj"""');
    });

    it('escapuje hodnoty s novým řádkem', () => {
      expect(escapeCsvValue('řádek1\nřádek2', ';')).toBe('"řádek1\nřádek2"');
    });
  });

  describe('resultsToCsv', () => {
    it('vygeneruje správné CSV s hlavičkou a řádky', () => {
      const results: OrganicResult[] = [
        {
          position: 1,
          title: 'Titulek s "uvozovkami"; a středníkem',
          url: 'https://example.com',
          snippet: 'Snippet text',
        },
      ];

      const csv = resultsToCsv(results);
      const lines = csv.split('\n');

      expect(lines[0]).toBe('position;title;url;snippet');
      expect(lines[1]).toContain('"Titulek s ""uvozovkami""; a středníkem"');
      expect(lines[1]).toContain('https://example.com');
    });
  });
});
