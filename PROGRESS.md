# Stav projektu Rodinné cesty

Aktualizováno: 15. listopadu 2026. Vývojová větev: `vyvoj/prvni-demo`.

## Dokončeno
- [x] Mapa 177 oblastí, časová osa, filtry osob, animace a režim `?demo` (jen smyšlená data).
- [x] Sdílené rodinné přihlášení z `/rozcestnik/auth.js` pro živý režim.
- [x] 10 tabulek `travel_*` vytvořeno v existujícím Supabase projektu migrací `rodinne_cesty_schema_v1`.
- [x] Všech 10 tabulek má zapnuté RLS a pravidlo pro členy rodiny; `anon` nemá práva.
- [x] Otestováno: testovací nečlen rodiny nevidí žádné členy v `travel_people`.
- [x] Základní údaje o čtyřech členech jsou pouze v databázi, nikoli ve veřejném kódu.
- [x] Živá mapa čte pouze ověřené pobyty skutečně absolvovaných cest; nepodložené oblouky se nekreslí.
- [x] Formulář pro přidání ověřené návštěvy a potvrzení plánovaného pobytu.
- [x] Ručně spuštěná jednosměrná synchronizace `plan_cesty` a `plan_volno` s kontrolou duplicit.
- [x] Aktualizované zdrojové soubory `index.html`, `live.js`.
- [x] Kontrola syntaxe JS; původní demo otestováno na šířce 1350 a 390 px pomocí Chromium.
- [x] Kontrola změn: nejsou v nich fotografie pasů, soukromá data cest ani tajné klíče.

## Zbývá před nasazením
- [ ] Otestovat živý režim ve skutečném přihlášeném prohlížeči a RLS zápisy.
- [ ] Ověřit ukazatel bez znalosti koordinát (zvýrazněná země je funkční; letové trasy jen pro doložené body).
- [ ] Rozšířit editor o konkrétní lety, koordináty a důkazy; doplnit export/import ověřených záznamů.
- [ ] Ověřit transakční atomicitu ukládání cest a ošetření paralelních synchronizací.
- [ ] Provést audit ostatních starších `SECURITY DEFINER` funkcí podle výstupu Supabase Security Advisor — samostatný úkol.
- [x] Změny připraveny pro schválené sloučení do `main`.
- [ ] Ověřit/zapnout GitHub Pages, poté změnit dlaždici Rozcestníku z GitHub odkazu na web.

## Důležité
- Produkční databázové schéma bylo vytvořeno, ale **skutečné cesty dosud nebyly importovány**; import spouští uživatel až tlačítkem.
- Kód je připravený k publikování v `main`; nasazení na GitHub Pages a přihlášený test jsou samostatné kroky.
