# Rodinné cesty

Interaktivní rodinná kronika cest: mapa světa, přehrávání po měsících, osobní filtry a archiv potvrzených návštěv.

## Dva režimy
- **Ukázka:** `?demo` – výhradně smyšlená data a žádné přihlášení.
- **Rodinná databáze:** bez `?demo` – sdílené přihlášení přes Rozcestník; data pocházejí z chráněného Supabase.

## Stav
Základní verze je v `main` a publikuje se přes GitHub Pages. V pracovní větvi `vyvoj/editor-cest-a-tras` vzniká další funkce: editor cest a přesunů. Editor zatím **není v nasazeném webu**; živý režim vyžaduje koncové testování.

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

## Ruční opravy a doplňování (pracovní větev)

- Po přihlášení lze v novém editoru upravit název, data, typ a stav cesty.
- Lze založit novou cestu a zapsat zastávky, přesuny letadlem, autem, vlakem, autobusem nebo lodí, účastníky i poznámky.
- Každá zastávka a každý přesun má stav `k ověření` / `ověřeno` / `zamítnuto`. Neznámé datum či letiště není nutné domýšlet.
- Ne všechny příchody do zemí mají razítka a ne každé razítko dokazuje let. Proto je třeba oba druhy záznamů oddělit.
- Mapa vykreslí oblouk letu **jen tehdy**, je-li let potvrzený, má datum, ověřené souřadnice obou míst a cestující. Cesty autem se zatím evidují bez domýšlené silniční trasy.
- Pouze potvrzený pobyt v dokončené cestě s konkrétním datem a účastníkem odemyká zemi na mapě.
- Editor provádí několik Supabase zápisů za sebou; potvrzení celé transakce, souběžné úpravy a test v přihlášeném prohlížeči ještě zbývají. Doporučená první fáze provozu je opatrná beta s revizí před každým větším importem.
