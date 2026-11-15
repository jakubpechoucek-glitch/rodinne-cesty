# Rodinné cesty

Interaktivní rodinná kronika cest: mapa světa, přehrávání po měsících, osobní filtry a archiv potvrzených návštěv.

## Dva režimy
- **Ukázka:** `?demo` – výhradně smyšlená data a žádné přihlášení.
- **Rodinná databáze:** bez `?demo` – sdílené přihlášení přes Rozcestník; data pocházejí z chráněného Supabase.

## Stav
První verze připravená ke sloučení do `main`. Samotné zveřejnění na GitHub Pages závisí na konfiguraci repozitáře. Živý přihlášený režim ještě vyžaduje koncové testování.

## Nově funkční část
- 10 databázových tabulek `travel_*` ve stejném Supabase projektu jako Plánovač.
- `travel_people` obsahuje čtyři rodinné profily, ale žádné osobní cestovní záznamy zatím nejsou založené.
- Formulář pro přidání potvrzené návštěvy určité země s datem a účastníky.
- Tlačítko **Načíst z Plánovače** přebírá potvrzené plánované termíny a individuální cesty jako **plánované**, nikoliv uskutečněné; opětovný import zamezuje duplicitám.
- Země se zvýrazní jen u ověřené skutečné návštěvy. Není-li poloha doložená, aplikace nevymýšlí trasu.

## Bezpečnost
Repozitář je veřejný. Skutečná data cest, fotografie pasů a přístupové tokeny sem nepatří. Data chrání Supabase RLS; anonymní role nemá přístup ke `travel_*` tabulkám. Fotky pasů zatím vůbec nepřijímáme.

## Technické nastavení
- `index.html` – SVG mapa, demo a rozhraní.
- `live.js` – přihlášení, čtení/zápis Supabase a import Plánovače.
- `sql/01_schema_NAVRH_NESPOUSTET.sql` – původní návrh. Jeho revizní varianta byla aplikována jako migrace `rodinne_cesty_schema_v1`; nespouštějte SQL znovu.
- `PROGRESS.md` – ověřené kroky a zbývající úkoly.
- `docs/PROJECT.md` – specifikace.

Přímé lokální otevření `index.html` automaticky používá demo, protože živé přihlášení funguje jen v rámci stejného originu GitHub Pages jako Rozcestník.
