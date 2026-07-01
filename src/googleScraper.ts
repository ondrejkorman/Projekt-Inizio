import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { GoogleScrapeError, OrganicResult } from './types';

const GOOGLE_SEARCH_URL = 'https://www.google.com/search';

/** Realistická hlavička pro snížení pravděpodobnosti okamžité blokace. */
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

/**
 * Kontejnery, které obsahují placené reklamy – tyto bloky vždy vynecháváme.
 * Selektor #tads / #bottomads: horní a dolní reklamní sloty.
 * [data-text-ad]: textové reklamy v SERP.
 */
const AD_CONTAINER_SELECTORS = ['#tads', '#bottomads', '[data-text-ad]', '.uEierd'];

/**
 * Bloky, které nejsou organické výsledky (People also ask, knowledge panel, mapy…).
 */
const NON_ORGANIC_SELECTORS = [
  '.related-question-pair', // People also ask
  '.kp-blk', // Knowledge panel
  '.ULSxyf', // Featured snippets / speciální bloky
  '.commercial-unit-desktop-top',
  '.xpdopen',
  '#rhs', // Pravý sloupec (často knowledge panel)
];

/**
 * Hlavní selektory pro organické výsledky (Google mění markup – používáme fallback řetězec).
 * 1. div.g – klasický wrapper organického výsledku
 * 2. div[data-sokoban-container] – novější varianta
 * 3. #rso > div > div – obecný fallback v oblasti výsledků
 */
const ORGANIC_RESULT_SELECTORS = [
  '#rso div.g',
  '#search div.g',
  'div[data-sokoban-container]',
];

/**
 * Selektory pro titulek výsledku (h3 uvnitř odkazu).
 */
const TITLE_SELECTORS = ['h3', 'a h3', '[role="heading"]'];

/**
 * Selektory pro snippet/popisek pod titulkem.
 */
const SNIPPET_SELECTORS = [
  '.VwiC3b',
  '.st',
  'div[data-sncf]',
  '.IsZvec',
  '.aCOpRe',
  'span[style*="-webkit-line-clamp"]',
];

/**
 * Detekce CAPTCHA / blokace podle typických prvků na stránce.
 */
function isBlockedOrCaptcha(html: string, $: cheerio.CheerioAPI): boolean {
  const lower = html.toLowerCase();
  if (
    lower.includes('unusual traffic') ||
    lower.includes('detected unusual traffic') ||
    lower.includes('/sorry/index') ||
    lower.includes('captcha')
  ) {
    return true;
  }
  // CAPTCHA formulář nebo „sorry“ stránka
  if ($('form#captcha-form').length > 0 || $('title').text().toLowerCase().includes('sorry')) {
    return true;
  }
  return false;
}

/**
 * Extrahuje skutečnou URL z Google redirect odkazu (/url?q=...).
 */
function resolveUrl(href: string): string | null {
  if (!href) return null;

  if (href.startsWith('/url?')) {
    try {
      const params = new URLSearchParams(href.replace('/url?', ''));
      const q = params.get('q');
      if (q) return q;
    } catch {
      return null;
    }
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return null;
}

/**
 * Zjistí, zda je element uvnitř reklamního nebo neorganického kontejneru.
 */
function isInsideExcludedBlock($: cheerio.CheerioAPI, el: AnyNode): boolean {
  const allExcluded = [...AD_CONTAINER_SELECTORS, ...NON_ORGANIC_SELECTORS];
  for (const selector of allExcluded) {
    if ($(el).closest(selector).length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Najde první neprázdný text podle seznamu selektorů v rámci elementu.
 */
function findText($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>, selectors: string[]): string {
  for (const sel of selectors) {
    const text = root.find(sel).first().text().trim();
    if (text) return text;
  }
  return '';
}

/**
 * Parsuje HTML stránku Google SERP a vrátí pouze organické výsledky (max. 10).
 * Používá se jak pro live scraping, tak pro unit testy na fixture HTML.
 */
export function parseGoogleResults(html: string): OrganicResult[] {
  const $ = cheerio.load(html);

  if (isBlockedOrCaptcha(html, $)) {
    throw new GoogleScrapeError(
      'Google vrátil CAPTCHA nebo blokaci – zkuste to později nebo z jiné IP.'
    );
  }

  const results: OrganicResult[] = [];
  const seenUrls = new Set<string>();

  // Sběr kandidátů ze všech organických selektorů
  let candidates: AnyNode[] = [];
  for (const selector of ORGANIC_RESULT_SELECTORS) {
    const found = $(selector).toArray();
    if (found.length > 0) {
      candidates = found;
      break;
    }
  }

  for (const el of candidates) {
    if (results.length >= 10) break;
    if (isInsideExcludedBlock($, el)) continue;

    const $el = $(el);

    // Hlavní odkaz výsledku – typicky první <a> s h3 nebo s href na /url?q=
    let linkEl = $el.find('a[href]').filter((_, a) => {
      const href = $(a).attr('href') ?? '';
      return href.startsWith('/url?') || href.startsWith('http');
    }).first();

    if (linkEl.length === 0) {
      linkEl = $el.find('a[href^="http"]').first();
    }

    const href = linkEl.attr('href') ?? '';
    const url = resolveUrl(href);
    if (!url || seenUrls.has(url)) continue;

    const title = findText($, $el, TITLE_SELECTORS) || linkEl.text().trim();
    if (!title) continue;

    const snippet = findText($, $el, SNIPPET_SELECTORS);

    seenUrls.add(url);
    results.push({
      position: results.length + 1,
      title,
      url,
      snippet,
    });
  }

  return results;
}

/**
 * Stáhne první stránku Google výsledků a vrátí organické položky.
 */
export async function searchGoogle(query: string): Promise<OrganicResult[]> {
  const params = new URLSearchParams({
    q: query,
    hl: 'cs',
    num: '10',
    gl: 'cz',
  });

  let response;
  try {
    response = await axios.get(`${GOOGLE_SEARCH_URL}?${params.toString()}`, {
      headers: REQUEST_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });
  } catch (err) {
    throw new GoogleScrapeError(
      `Nepodařilo se spojit s Google: ${err instanceof Error ? err.message : 'neznámá chyba'}`
    );
  }

  if (response.status !== 200) {
    throw new GoogleScrapeError(
      `Google vrátil neočekávaný HTTP status ${response.status}.`
    );
  }

  const html = response.data as string;
  if (!html || typeof html !== 'string') {
    throw new GoogleScrapeError('Google vrátil prázdnou nebo neplatnou odpověď.');
  }

  return parseGoogleResults(html);
}
