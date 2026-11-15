# Rodinné cesty

Interaktivní časová osa skutečných cest rodiny: světová mapa, odemykání zemí a osobní vrstvy.

## Stav projektu

**První demonstrační verze ve vývojové větvi.** Ukazuje pouze smyšlené cesty a nepracuje s produkčními daty. Zatím není nasazena; soubory jsou připravené ve větvi `vyvoj/prvni-demo`.

## Jak spustit demo

1. Rozbalte balíček.
2. Otevřete `index.html` přímo z počítače (lokální soubor se automaticky otevře v demo režimu), nebo spusťte `python3 -m http.server 8000` a přejděte na `http://localhost:8000/?demo`).
3. Vyberte osobu, posouvejte měsíční osu a klikněte na zvýrazněnou zemi.

Bez `?demo` aplikace nic osobního nezobrazuje; ukáže pouze zprávu, že ostré napojení se teprve připravuje.

## Architektura (cílová)

- Statická webová aplikace na GitHub Pages, HTML/CSS/JS bez buildu.
- Vlastní tabulky `travel_*` v již používané rodinné databázi Supabase.
- Přihlášení přes Rozcestník a jeho existující `RodinaAuth`.
- Jednosměrné přebírání potvrzených plánů z `plan_cesty` a individuálních cest z `plan_volno`.
- Potvrzení uskutečněné návštěvy před odemčením země.

## Dokumentace

- [`docs/PROJECT.md`](docs/PROJECT.md) — zadání, datový model, synchronizace a bezpečnost.
- [`sql/01_schema_NAVRH_NESPOUSTET.sql`](sql/01_schema_NAVRH_NESPOUSTET.sql) — **nezavádět do databáze bez revize**.
- [`PROGRESS.md`](PROGRESS.md) — co je hotové a co zbývá.

## Soukromí

Repozitář je veřejný. Neukládejte sem skutečná data cest, fotografie pasů, osobní dokumenty, čísla pasů, tokeny ani klíče. Dema používají výhradně vymyšlená data. Pasové výřezy později jen do soukromého Supabase Storage.

Podklad mapy: [Natural Earth](https://www.naturalearthdata.com/), public domain, zjednodušená varianta 1:110m.