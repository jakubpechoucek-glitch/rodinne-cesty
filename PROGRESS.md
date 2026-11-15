# Stav projektu Rodinné cesty

Aktualizováno: 15. listopadu 2026. Aktuální vývojová větev: `vyvoj/editor-cest-a-tras`.

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
- [x] Základní editor uložených cest, zastávek a přesunů (letadlo, auto, vlak, autobus, loď) ve vývojové větvi.
- [x] Živý režim zobrazuje oblouk jen u potvrzeného letu s datem, oběma souřadnicemi a účastníky.
- [x] Statická kontrola syntaxe 7 vložených JS bloků a souborů, kontrola pořadí skriptů a výskytu tajných klíčů.
- [ ] Dopracovat historii důkazů, import pasových razítek, kontrolu změn a export/import ověřených záznamů.
- [ ] Ověřit transakční atomicitu ukládání cest a ošetření paralelních synchronizací (i nového editoru).
- [ ] Otestovat editaci/zápisy v přihlášeném prohlížeči na mobilu i desktopu a případné konflikty dat.
- [ ] Provést audit ostatních starších `SECURITY DEFINER` funkcí podle výstupu Supabase Security Advisor — samostatný úkol.
- [x] Základní verze byla schválena a sloučena do `main`.
- [ ] Editor není dosud sloučen do `main` a není veřejně nasazen.
- [x] GitHub Pages a dlaždice Rozcestníku směrující na web fungují.

## Důležité
- Produkční databázové schéma bylo vytvořeno, ale **skutečné cesty dosud nebyly importovány**; import spouští uživatel až tlačítkem.
- Základní verze je nasazená. Nový editor se vyvíjí odděleně ve větvi; merge až na výslovný pokyn.
