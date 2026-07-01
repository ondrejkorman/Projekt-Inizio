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
 * Výjimka při blokaci Google (CAPTCHA) nebo neočekávané struktuře stránky.
 */
export class GoogleScrapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleScrapeError';
  }
}
