# Google SERP Scraper

**Nasazená verze:** https://projekt-inizio.onrender.com

Webová aplikace pro vyhledávání **organických** výsledků z Google (bez placených reklam, People also ask, knowledge panelu apod.). Uživatel zadá dotaz, backend zavolá **Serper.dev SERP API** a frontend zobrazí výsledky s možností exportu do JSON nebo CSV.

## Popis projektu

Aplikace umožňuje zadat klíčové slovní spojení, načíst první stránku organických Google výsledků a stáhnout je ve strojově čitelném formátu (JSON nebo CSV). Je určena jako demonstrační / vzdělávací projekt s důrazem na spolehlivost a legální přístup k datům.

## Architektura

Aplikace využívá **[Serper.dev](https://serper.dev) SERP API** místo přímého scrapingu Google.

**Proč Serper.dev a ne scraping?** Google aktivně blokuje automatizované požadavky – včetně headless prohlížeče (Puppeteer) – pomocí CAPTCHA a blokovacích stránek. Specializovaná SERP API služba je pro produkční i demoovatelné řešení **spolehlivější** a nevyžaduje obcházení ochrany Google.

**Tok dat:**

```
Uživatel (input) → Frontend (fetch) → Backend /api/search
    → Serper.dev API (POST, pole organic)
    → Mapování link → url
    → JSON odpověď → UI tabulka + export JSON/CSV
```

1. Frontend odešle `GET /api/search?q=...`
2. Backend validuje vstup a zavolá `POST https://google.serper.dev/search` s hlavičkou `X-API-KEY`
3. Serper vrátí JSON s polem `organic` (`title`, `link`, `snippet`, `position`)
4. Backend namapuje `link` → `url` a vrátí výsledky frontendu

## Lokální spuštění

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Do `.env` doplňte vlastní klíč:

```
SERPER_API_KEY=your_key_here
```

Klíč získáte na [https://serper.dev](https://serper.dev) (2500 dotazů zdarma, bez nutnosti karty).

```bash
npm run dev
```

Aplikace poběží na [http://localhost:3000](http://localhost:3000).

Produční build:

```bash
npm run build
npm start
```

## Spuštění přes Docker

```bash
docker compose up --build
```

Nastavte `SERPER_API_KEY` jako env proměnnou (např. v `.env` v rootu projektu – Docker Compose ji načte automaticky).

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
Tests:       25 passed, 25 total
```

Testy mapování běží na fixture `__fixtures__/serper-response-sample.json` – nevolají reálné Serper API.

## API

### `GET /api/search?q=<dotaz>`

| Status | Příčina |
|--------|---------|
| 200 | Úspěch (i s prázdným `results: []`) |
| 400 | Chybí/prázdný/příliš dlouhý dotaz (max. 200 znaků) |
| 429 | Překročen rate limit aplikace |
| 502 | Chybějící/neplatný `SERPER_API_KEY`, limit Serper API, síťová chyba |

### Proměnné prostředí

| Proměnná | Povinná | Popis |
|----------|---------|-------|
| `SERPER_API_KEY` | Ano | API klíč z [serper.dev](https://serper.dev) |
| `PORT` | Ne | Port serveru (výchozí `3000`) |

**Produkční nasazení (Render):** `SERPER_API_KEY` nastavte jako **Environment Variable** v dashboardu – ne commitujte do gitu.

## Limity a poznámky

- **Počet výsledků:** Aplikace cílí na 10 organických pozic. Serper/Google občas vrátí **8–9** výsledků, pokud na stránce jsou i neorganické prvky (People Also Ask apod.). Backend při nedostatku načte druhou stránku Serper API.
- **Serper free tier:** 2500 dotazů zdarma po registraci.
- **Bezpečnost:** `.env` s API klíčem patří pouze lokálně / do env proměnných hostingu, nikdy do gitu.

## Nasazení (Render.com)

1. Nahrajte repozitář na GitHub.
2. V [Render](https://render.com) vytvořte **Web Service**.
3. Build: `npm install && npm run build`, Start: `npm start` (nebo Docker).
4. Přidejte `SERPER_API_KEY` do Environment Variables.

## Struktura projektu

```
/
├── src/
│   ├── server.ts
│   ├── googleSearch.ts
│   ├── validateQuery.ts
│   ├── exporters.ts
│   └── public/
├── __tests__/
├── __fixtures__/
│   └── serper-response-sample.json
├── .env.example
├── Dockerfile
└── docker-compose.yml
```

## Licence

MIT
