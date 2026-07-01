# Google SERP Scraper

Webová aplikace pro vyhledávání **organických** výsledků z Google (bez placených reklam, People also ask, knowledge panelu apod.). Uživatel zadá dotaz, backend stáhne první stránku SERP a frontend zobrazí výsledky s možností exportu do JSON nebo CSV.

**Nasazená verze:** _(doplníte ručně po nasazení)_

## Jak funguje scraping

1. Backend odešle HTTP GET na `https://www.google.com/search?q=...&hl=cs&num=10` s realistickou hlavičkou `User-Agent` a `Accept-Language: cs-CZ`.
2. HTML odpověď se parsuje knihovnou **cheerio**.
3. Parser **vynechává**:
   - placené reklamy (`#tads`, `#bottomads`, `[data-text-ad]`),
   - People also ask (`.related-question-pair`),
   - knowledge panel (`.kp-blk`, `#rhs`),
   - další neorganické bloky.
4. Z každého organického výsledku (`div.g` a fallback selektory) se extrahuje **position**, **title**, **url** (včetně rozbalení `/url?q=...` redirectů) a **snippet**.
5. Výsledek se vrátí jako JSON přes API `/api/search?q=...`.

> **Poznámka k limitům:** Google aktivně brání automatizovanému scrapingu. Při vyšší frekvenci dotazů může dojít k CAPTCHA nebo blokaci IP. Aplikace je určena pro **demonstrační a testovací účely** – v produkci zvažte oficiální API (Custom Search JSON API).

## Lokální spuštění

```bash
npm install
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

Aplikace bude dostupná na [http://localhost:3000](http://localhost:3000).

## Testy

```bash
npm test
```

Očekávaný výstup (všechny testy zelené):

```
PASS  __tests__/exporters.test.ts
PASS  __tests__/googleScraper.test.ts
PASS  __tests__/api.test.ts

Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total
```

Pro watch režim:

```bash
npm run test:watch
```

Testy parseru běží na uložených HTML fixture souborech v `__fixtures__/` – nevolají reálný Google.

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
| 502 | Google CAPTCHA/blokace nebo neočekávaná struktura |
| 200 + `results: []` | Žádné organické výsledky nenalezeny |

## Nasazení zdarma

### Render.com (doporučeno)

1. Nahrajte repozitář na GitHub.
2. V [Render](https://render.com) vytvořte **Web Service** → připojte repo.
3. Zvolte **Docker** jako runtime (Render použije `Dockerfile`) nebo nastavte:
   - Build: `npm install && npm run build`
   - Start: `npm start`
4. Render automaticky nastaví `PORT` – aplikace ho čte z `process.env.PORT`.

### Alternativy

- **[Railway.app](https://railway.app)** – deploy z GitHubu, podpora Dockeru.
- **[Fly.io](https://fly.io)** – `fly launch` + `fly deploy` s Docker image.

## Struktura projektu

```
/
├── src/
│   ├── server.ts
│   ├── googleScraper.ts
│   ├── exporters.ts
│   ├── types.ts
│   └── public/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── __tests__/
│   ├── googleScraper.test.ts
│   ├── api.test.ts
│   └── exporters.test.ts
├── __fixtures__/
│   ├── google-results-sample.html
│   └── google-captcha.html
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## Licence

MIT
