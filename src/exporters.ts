import { OrganicResult, SearchResponse } from './types';

/**
 * Escapuje hodnotu pro CSV – uvozovky zdvojí, hodnoty s oddělovačem/obrátky obalí.
 */
export function escapeCsvValue(value: string, delimiter = ';'): string {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');

  if (!needsQuotes) return value;

  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Převede pole výsledků na CSV řetězec (position;title;url;snippet).
 */
export function resultsToCsv(results: OrganicResult[], delimiter = ';'): string {
  const header = ['position', 'title', 'url', 'snippet'].join(delimiter);
  const rows = results.map((r) =>
    [r.position, r.title, r.url, r.snippet]
      .map((v) => escapeCsvValue(String(v), delimiter))
      .join(delimiter)
  );
  return [header, ...rows].join('\n');
}

/**
 * Převede API odpověď na formátovaný JSON řetězec.
 */
export function resultsToJson(response: SearchResponse): string {
  return JSON.stringify(response, null, 2);
}
