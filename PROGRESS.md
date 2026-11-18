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

- [x] Letadélko letí po trase při každém měsíci s letem (demo i živý režim).
- [x] Formulář návštěvy má nepovinné „Odlet z / Přílet do“ (číselník letišť `airports.js`); ukládá se do `travel_locations` a `travel_legs`, živá mapa kreslí jen ověřené lety.

- [x] Editor úseků nabízí v „Odkud / Kam“ hotová letiště s polohou (`airports.js`), takže trasa a letadélko jdou zadat bez opisování souřadnic.

- [x] Záložka „Lety“ (`flights.js`, odkaz `#lety`): přehled jen letů s hledáním, filtry (osoba, rok, stav), barevným označením a úpravou přímo v řádku (letiště ze seznamu, datum, osoby, ověření, smazání). V `?demo` běží nad smyšlenými lety.

- [x] Přehrávání časové osy zpomalí v měsíci s letem: let trvá 3 s (při 2× a 4× úměrně kratší), několik letů v měsíci letí postupně a po posledním se 1 s počká.

## Plánováno
- [ ] Záložka „Flight entitlement“ (anglicky): sledování firemního nároku na letenky. Zadání a otevřené otázky v `docs/FLIGHT_ENTITLEMENT.md`; čeká na odpovědi zadavatele.

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
