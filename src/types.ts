/**
 * Typ jednoho organického výsledku z Google SERP.
 */
export interface OrganicResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  fetchedAt: string;
  results: OrganicResult[];
}

/**
 * Výjimka při chybě volání Serper API nebo konfigurace.
 */
export class SearchApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchApiError';
  }
}

/** @deprecated Použijte SearchApiError – ponecháno kvůli zpětné kompatibilitě testů. */
export const GoogleScrapeError = SearchApiError;
