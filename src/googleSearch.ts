import { OrganicResult, SearchApiError } from './types';

const SERPER_API_URL = 'https://google.serper.dev/search';
const TARGET_RESULT_COUNT = 10;

/** Položka organického výsledku v odpovědi Serper.dev API. */
export interface SerperOrganicItem {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

/** Odpověď Serper.dev API – používáme pouze pole organic. */
export interface SerperSearchResponse {
  organic?: SerperOrganicItem[];
}

export interface SerperSearchRequest {
  q: string;
  gl: string;
  hl: string;
  num: number;
  page: number;
}

/**
 * Mapuje odpověď Serper API na interní formát aplikace.
 * Prázdné/chybějící organic → prázdné pole (ne chyba).
 */
export function mapSerperResponseToResults(data: SerperSearchResponse): OrganicResult[] {
  if (!data.organic || !Array.isArray(data.organic)) {
    return [];
  }

  return data.organic.map((item) => ({
    position: item.position,
    title: item.title ?? '',
    url: item.link ?? '',
    snippet: item.snippet ?? '',
  }));
}

/**
 * Sloučí výsledky ze stránek bez duplicit URL a přečísluje pozice 1…n.
 */
export function mergeOrganicResults(
  pages: OrganicResult[][],
  maxCount = TARGET_RESULT_COUNT
): OrganicResult[] {
  const seenUrls = new Set<string>();
  const merged: OrganicResult[] = [];

  for (const pageResults of pages) {
    for (const item of pageResults) {
      if (merged.length >= maxCount) break;
      if (!item.url || seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      merged.push(item);
    }
    if (merged.length >= maxCount) break;
  }

  return merged.map((item, index) => ({
    ...item,
    position: index + 1,
  }));
}

async function parseSerperErrorResponse(response: Response): Promise<never> {
  if (response.status === 401 || response.status === 403) {
    throw new SearchApiError(
      'Neplatný SERPER_API_KEY – zkontrolujte klíč na https://serper.dev'
    );
  }

  if (response.status === 429) {
    throw new SearchApiError(
      'Vyčerpán limit dotazů Serper API – zkuste to později nebo navýšte kredit.'
    );
  }

  let detail = '';
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message ? `: ${body.message}` : '';
  } catch {
    // odpověď nemusí být JSON
  }

  throw new SearchApiError(`Serper API vrátilo chybu HTTP ${response.status}${detail}.`);
}

/**
 * Jedno volání Serper API pro danou stránku výsledků.
 */
export async function fetchSerperOrganicPage(
  query: string,
  apiKey: string,
  page: number
): Promise<OrganicResult[]> {
  const requestBody: SerperSearchRequest = {
    q: query,
    gl: 'cz',
    hl: 'cs',
    num: TARGET_RESULT_COUNT,
    page,
  };

  let response: Response;

  try {
    response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new SearchApiError(
      `Nepodařilo se spojit se Serper API: ${
        err instanceof Error ? err.message : 'síťová chyba'
      }`
    );
  }

  if (!response.ok) {
    await parseSerperErrorResponse(response);
  }

  const data = (await response.json()) as SerperSearchResponse;
  return mapSerperResponseToResults(data);
}

/**
 * Vyhledá organické výsledky Google přes Serper.dev SERP API.
 * Serper občas vrátí 9 místo 10 položek – při nedostatku načte druhou stránku.
 */
export async function searchGoogle(query: string): Promise<OrganicResult[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();

  if (!apiKey) {
    throw new SearchApiError(
      'Chybí SERPER_API_KEY – nastavte API klíč v souboru .env nebo v proměnných prostředí serveru.'
    );
  }

  const page1 = await fetchSerperOrganicPage(query, apiKey, 1);

  if (page1.length >= TARGET_RESULT_COUNT) {
    return page1.slice(0, TARGET_RESULT_COUNT).map((item, index) => ({
      ...item,
      position: index + 1,
    }));
  }

  const page2 = await fetchSerperOrganicPage(query, apiKey, 2);
  return mergeOrganicResults([page1, page2], TARGET_RESULT_COUNT);
}
