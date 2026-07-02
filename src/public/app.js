/**
 * Frontend – vanilla JS, volá /api/search a zobrazuje organické výsledky.
 */

/** @type {import('../types').SearchResponse | null} */
let lastResponse = null;

const form = document.getElementById('search-form');
const queryInput = document.getElementById('query-input');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const resultsSection = document.getElementById('results-section');
const resultsTitle = document.getElementById('results-title');
const resultsList = document.getElementById('results-list');
const downloadJsonBtn = document.getElementById('download-json-btn');
const downloadCsvBtn = document.getElementById('download-csv-btn');

/**
 * @param {string} message
 * @param {'info'|'error'|'loading'} type
 */
function showStatus(message, type = 'info') {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

function hideStatus() {
  statusEl.hidden = true;
  statusEl.textContent = '';
}

/**
 * @param {boolean} loading
 */
function setLoading(loading) {
  searchBtn.disabled = loading;
  queryInput.disabled = loading;
  searchBtn.textContent = loading ? 'Načítám…' : 'Hledat';
  if (loading) {
    showStatus('Načítám výsledky…', 'loading');
  }
}

/**
 * @param {import('../types').SearchResponse} data
 */
function renderResults(data) {
  lastResponse = data;
  resultsSection.hidden = false;
  resultsTitle.textContent = `Výsledky pro „${data.query}" (${data.results.length})`;

  resultsList.innerHTML = '';

  if (data.results.length === 0) {
    const li = document.createElement('li');
    li.className = 'result-empty';
    li.textContent = 'Nebyly nalezeny žádné organické výsledky.';
    resultsList.appendChild(li);
    downloadJsonBtn.disabled = true;
    downloadCsvBtn.disabled = true;
    return;
  }

  for (const result of data.results) {
    const li = document.createElement('li');
    li.className = 'result-item';

    const position = document.createElement('span');
    position.className = 'result-position';
    position.textContent = String(result.position);

    const body = document.createElement('div');
    body.className = 'result-body';

    const titleLink = document.createElement('a');
    titleLink.className = 'result-title';
    titleLink.href = result.url;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.textContent = result.title;

    const url = document.createElement('span');
    url.className = 'result-url';
    url.textContent = result.url;

    const snippet = document.createElement('p');
    snippet.className = 'result-snippet';
    snippet.textContent = result.snippet || '—';

    body.appendChild(titleLink);
    body.appendChild(url);
    body.appendChild(snippet);

    li.appendChild(position);
    li.appendChild(body);
    resultsList.appendChild(li);
  }

  downloadJsonBtn.disabled = false;
  downloadCsvBtn.disabled = false;
}

/**
 * @param {string} query
 * @returns {string}
 */
function buildFilename(ext) {
  const safeQuery = (lastResponse?.query ?? 'search')
    .replace(/[^\w\u00C0-\u024F-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `results-${safeQuery}-${ts}.${ext}`;
}

/**
 * Escapuje hodnotu pro CSV (stejná logika jako backend).
 * @param {string} value
 * @param {string} delimiter
 */
function escapeCsvValue(value, delimiter = ';') {
  const needsQuotes =
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * @param {import('../types').OrganicResult[]} results
 */
function resultsToCsv(results) {
  const delimiter = ';';
  const header = ['position', 'title', 'url', 'snippet'].join(delimiter);
  const rows = results.map((r) =>
    [r.position, r.title, r.url, r.snippet]
      .map((v) => escapeCsvValue(String(v), delimiter))
      .join(delimiter)
  );
  return [header, ...rows].join('\n');
}

/**
 * @param {string} content
 * @param {string} mimeType
 * @param {string} filename
 */
function downloadFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  setLoading(true);
  resultsSection.hidden = true;
  lastResponse = null;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      showStatus(data.error || `Chyba serveru (${res.status})`, 'error');
      resultsSection.hidden = true;
      downloadJsonBtn.disabled = true;
      downloadCsvBtn.disabled = true;
      return;
    }

    hideStatus();
    renderResults(data);
  } catch {
    showStatus('Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.', 'error');
    resultsSection.hidden = true;
    downloadJsonBtn.disabled = true;
    downloadCsvBtn.disabled = true;
  } finally {
    setLoading(false);
  }
});

downloadJsonBtn.addEventListener('click', () => {
  if (!lastResponse) return;
  const json = JSON.stringify(lastResponse, null, 2);
  downloadFile(json, 'application/json', buildFilename('json'));
});

downloadCsvBtn.addEventListener('click', () => {
  if (!lastResponse) return;
  const csv = resultsToCsv(lastResponse.results);
  downloadFile(csv, 'text/csv;charset=utf-8', buildFilename('csv'));
});
