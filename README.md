# Google SERP Scraper

Webová aplikace pro vyhledávání **organických** výsledků z Google (bez placených reklam, People also ask, knowledge panelu apod.). Uživatel zadá dotaz, backend zavolá **Serper.dev SERP API** a frontend zobrazí výsledky s možností exportu do JSON nebo CSV.

**Nasazená verze:** _(doplníte ručně po nasazení)_

## Architektura

Aplikace využívá **[Serper.dev](https://serper.dev) SERP API** pro spolehlivé získání organických výsledků Google vyhledávání.

**Proč ne přímý scraping?** Google aktivně blokuje automatizované stahování výsledků – a to i přes headless prohlížeč (Puppeteer) – pomocí CAPTCHA a blokovacích stránek. Specializovaná SERP API služba je pro produkční i demoovatelné řešení **spolehlivější** a neporušuje podmínky užití Google.

**Tok dat:**

1. Frontend odešle `GET /api/search?q=...`
2. Backend zavolá `POST https://google.serper.dev/search` s hlavičkou `X-API-KEY`
3. Serper vrátí JSON s polem `organic` (titulek, link, snippet, position)
4. Backend namapuje `link` → `url` a vrátí stejný JSON kontrakt jako dříve

## Lokální spuštění

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
# Doplňte SERPER_API_KEY v .env – klíč z https://serper.dev (2500 dotazů zdarma, bez nutnosti karty)
npm run dev
```

Aplikace poběží na [http://localhost:3000](http://localhost:3000).

Pro produkční build:

```bash
npm run build
npm start
```

## Spuštění přes Docker

```bash
docker compose up --build
```

Pro Docker nastavte `SERPER_API_KEY` v `docker-compose.yml` nebo jako env proměnnou při spuštění.

## Testy

```bash
npm test
```

Očekávaný výstup (všechny testy zelené):

```
PASS  __tests__/exporters.test.ts
PASS  __tests__/googleSearch.test.ts
PASS  __tests__/api.test.ts

Test Suites: 3 passed, 3 total
Tests:       19 passed, 19 total
```

Testy mapování běží na fixture `__fixtures__/serper-response-sample.json` – nevolají reálné Serper API.

## API

### `GET /api/search?q=<dotaz>`

**200 OK:**

```json
{
  "query": "keyword",
  "fetchedAt": "2026-07-02T12:00:00.000Z",
  "results": [
    {
      "position": 1,
      "title": "...",
      "url": "https://...",
      "snippet": "..."
    }
  ]
}
```

**Chybové stavy:**

| Status | Příčina |
|--------|---------|
| 400 | Chybí nebo je prázdný parametr `q` |
| 429 | Překročen rate limit aplikace |
| 502 | Chybějící/neplatný `SERPER_API_KEY`, limit Serper API, síťová chyba |
| 200 + `results: []` | Serper vrátil prázdné pole `organic` |

### Proměnné prostředí

| Proměnná | Povinná | Popis |
|----------|---------|-------|
| `SERPER_API_KEY` | Ano | API klíč z [serper.dev](https://serper.dev) |
| `PORT` | Ne | Port serveru (výchozí `3000`) |
| `RATE_LIMIT_MAX` | Ne | Max. dotazů za okno na IP (výchozí `6`) |
| `RATE_LIMIT_WINDOW_MS` | Ne | Délka okna rate limitu (výchozí `900000`) |

**Produkční nasazení (Render):** `SERPER_API_KEY` nastavte jako **Environment Variable** v dashboardu hostingu – ne commitujte do gitu.

## Nasazení zdarma

### Render.com (doporučeno)

1. Nahrajte repozitář na GitHub.
2. V [Render](https://render.com) vytvořte **Web Service** → připojte repo.
3. Zvolte **Docker** jako runtime nebo nastavte Build: `npm install && npm run build`, Start: `npm start`.
4. V **Environment** přidejte `SERPER_API_KEY` s vaším klíčem.
5. Render automaticky nastaví `PORT`.

### Alternativy

- **[Railway.app](https://railway.app)** – deploy z GitHubu, podpora Dockeru.
- **[Fly.io](https://fly.io)** – `fly launch` + `fly deploy`.

## Struktura projektu

```
/
├── src/
│   ├── server.ts
│   ├── googleSearch.ts      # Serper.dev API klient + mapování
│   ├── exporters.ts
│   ├── rateLimit.ts
│   ├── types.ts
│   └── public/
├── __tests__/
│   ├── googleSearch.test.ts
│   ├── api.test.ts
│   └── exporters.test.ts
├── __fixtures__/
│   └── serper-response-sample.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Licence

MIT
