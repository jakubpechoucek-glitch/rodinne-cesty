# Rodinné cesty — projektové zadání a datový model

**Verze:** 1.0 (návrh, ke schválení)  
**Datum:** 15. 11. 2026  
**Cíl:** Archiv skutečných cest rodiny, interaktivní měsíční mapa, evidence pasových razítek, návaznost na existující Plánovač.

## 1. Cíl a základní princip

Vytvořit soukromou webovou kroniku cest od července 2018 (s možností doplnit starší cesty). Při přehrávání časové osy se animují doložené přesuny, první potvrzená návštěva země ji odemkne a odemčení přetrvá do dalších měsíců. Zobrazení se filtruje podle jednotlivých osob nebo společných cest. Zdrojem minulosti jsou zejména pasová razítka; budoucí cesty přicházejí z existujícího Plánovače.

**Základní pravidlo:** plánovaná ani jen potvrzená rezervace není důkaz, že se cesta uskutečnila. Země se odemkne pouze po potvrzení skutečné návštěvy (nikoli tranzitu) konkrétní osobou.

## 2. Rozsah první verze (MVP)

1. **Interaktivní mapa světa:** vykreslení zemí, barevné odemykání při první návštěvě; přiblížení / oddálení; kliknutí na zemi otevře historii návštěv.
2. **Časová osa:** po měsících od 07/2018 do současnosti, Play/Pause, krok vpřed/vzad, změna rychlosti a skok na rok. V budoucnosti jsou plánované cesty zobrazené jiným stylem, nikdy ne jako absolvované.
3. **Vrstvy osob:** „Všichni“ = sjednocení potvrzených návštěv; „Společně“ = alespoň 2 osoby na téže cestě či zastávce; „Celá rodina“ = všechny 4; čtyři samostatné osoby. U smíšených itinerářů rozhoduje účast na konkrétní zastávce.
4. **Trasy:** animovaný oblouk mezi přesně známými body (letiště/město); pokud je známá jen země, nezobrazovat smyšlený let a místo toho vykreslit bod nebo neurčitou trasu jako odhad.
5. **Historie cest:** seznam s daty, zeměmi, osobami, typem cesty, poznámkou a stupněm ověření.
6. **Ruční editor:** doplnění a opravy dat, potvrzení dokončených cest, ruční oprava nečitelných razítek.
7. **Import z Plánovače:** načítat potvrzené `plan_cesty` a individuální `plan_volno` typu `cesta` nebo `sluzebni`; návrhy nevytvářejí skutečné návštěvy. Import nevytváří duplicitní cesty a má potvrzovací krok při nejasné shodě.
8. **Evidence razítek:** uložit strukturované údaje o razítku včetně osoby, státu, vstupu/výstupu a přesnosti; obrázek jen volitelně a pouze bezpečně oříznutý v privátním Supabase Storage.
9. **Režim `?demo`:** pouze fiktivní data a bez přístupu k produkčním údajům.

## 3. Co odložit do dalších verzí

Hromadné automatické rozpoznávání razítek, propojení Google Photos, letecké mapy s reálnou geometrií letů, export cestovního posteru a automatické odhady emisí/km. Nejprve ověřit spolehlivost dat a mapy.

## 4. Architektura

- **Repozitář:** nový samostatný `rodinne-cesty`; Rozcestník dostane vlastní dlaždici. Repo pro Plánovač zůstane samostatné.
- **Hosting:** GitHub Pages, bez backend serveru, pokud pro MVP nebude nutný.
- **Frontend:** HTML/CSS/JavaScript, 2D vektorová mapa z GeoJSON/TopoJSON a animované SVG trasy (např. D3). Bez nutnosti placeného mapového API.
- **Přihlášení:** použít `/rozcestnik/auth.js` a `RodinaAuth.vyzadujPrihlaseni()` na stejné doméně.
- **Databáze:** stávající Supabase projekt Rozcestníku. Nové tabulky budou mít prefix `travel_`.
- **Zabezpečení:** RLS s členstvím v rodině pomocí existující ověřené funkce `je_clen()`. Pro tabulky určené frontendovým klientům ověřit explicitní přístup role `authenticated`; přístup pro anonymní uživatele nepovolovat.
- **Soubory:** oříznutá razítka pouze v privátním bucketu s RLS. Celé pasy, čísla pasů, MRZ, podpisy ani skeny průkazových stran nesmí do veřejného repozitáře ani do veřejného bucketu.
- **Změnový postup:** nejprve dokumentace, pak nová větev, migrace a testy, až poté PR a nasazení po výslovném schválení.

## 5. Datový model

| Tabulka | Účel | Hlavní pole |
|---|---|---|
| `travel_people` | Členové rodiny a mapování do Plánovače | `id` (neutrální), `display_name`, `planner_person_key`, `color` |
| `travel_locations` | Města a letiště pro mapu | `id`, `name`, `country_iso2`, `iata_code`, `latitude`, `longitude` |
| `travel_trips` | Jedna cesta jako celek | `id`, `title`, `planned_start/end`, `actual_start/end`, `status`, `category`, `notes` |
| `travel_trip_people` | Účast osob na cestě | `trip_id`, `person_id`, `participation` |
| `travel_stops` | Pobyt nebo tranzit ve státě | `id`, `trip_id`, `stop_order`, `country_iso2`, `location_id`, `arrival_date`, `departure_date`, `date_precision`, `kind`, `verification` |
| `travel_stop_people` | Kdo skutečně byl na konkrétní zastávce | `stop_id`, `person_id`, `presence` |
| `travel_legs` | Let či pozemní/námořní přesun | `id`, `trip_id`, `leg_order`, `from_location_id`, `to_location_id`, `departure_date`, `arrival_date`, `mode`, `flight_number`, `verification` |
| `travel_leg_people` | Kdo absolvoval konkrétní přesun | `leg_id`, `person_id`, `presence` |
| `travel_evidence` | Důkazy a původ údajů | `id`, `trip_id`, `stop_id`, `leg_id`, `person_id`, `evidence_type`, `event_type`, `observed_date`, `date_precision`, `private_file_path`, `confidence` |
| `travel_plan_links` | Vazby na stávající tabulky Plánovače | `trip_id`, `source_table`, `source_id`, `last_seen_at`; unikátní dvojice `(source_table,source_id)` |

**Klíče:** UUID u cest, zastávek, přesunů a důkazů; ISO 3166-1 alpha-2 kódy pro země; stabilní neutrální identifikátory osob. Cizí klíče propojí cestu, zastávky, přesuny a účastníky.

**Datum s nejistotou:** `date_precision` je `exact`, `month`, `year` nebo `unknown`. U neúplného data se nikdy netvrdí přesný den; pro řazení může datum obsahovat první den známého měsíce/roku, ale UI ho označí jako přibližné.

**Typ zastávky:** `stay` (skutečný pobyt), `transit` (přestup), `airport_only` (jen letiště). Tranzit se standardně nepočítá jako návštěva země.

**Ověření:** `proposed`, `verified`, `rejected`. Importovaná či strojově vyčtená razítka nejdřív projdou revizí.

## 6. Propojení s Plánovačem

### Co existuje a bylo ověřeno

- `plan_cesty(id,zacatek,konec,destinace,stav,...)`: termín a vybraná destinace; neobsahuje spolehlivý seznam účastníků.
- `plan_destinace(cesta_id,zeme,detail,...)`: návrhy destinací, nikoli doklad návštěvy.
- `plan_volno(id,osoba,zacatek,konec,typ,lety,...)`: jednotlivé cesty; pole `lety` je JSON s dvojicemi `datum` a **volný text**. Nelze z něj garantovat přesnou trasu bez kontroly.
- Ve všech relevantních tabulkách je v živé databázi zapnuto RLS.

### Synchronizační pravidla

1. Import je **jednosměrný** Plánovač → Rodinné cesty. V první verzi žádná automatická změna Plánovače.
2. `plan_cesty.stav='potvrzena'` vytváří či aktualizuje **plán** (`travel_trips.status='planned'`), nikoli uskutečněnou cestu. Návrhy a zamítnuté cesty nezvyšují statistiky.
3. `plan_volno.typ in ('cesta','sluzebni')` jsou potenciální individuální cesty. Osoba se načte z `plan_volno.osoba`; letové záznamy z `lety` se nabídnou k ověření.
4. Pokud `plan_cesty` a `plan_volno` popisují tutéž cestu, aplikace nabídne **sloučení** do jedné cesty s více `travel_plan_links` — nikdy neprovede automatické sloučení podle podobného data.
5. Každý import má identifikátor zdrojové tabulky a ID řádku. Opakovaný import je idempotentní: stejný zdroj nezaloží duplicitní cestu.
6. Změna termínu v Plánovači aktualizuje dosud nezrealizovanou cestu. U dokončené cesty se pouze zobrazí upozornění na rozdíl, **historie se nepřepisuje**.
7. Zrušení/zamítnutí plánované cesty ji skryje či označí jako zrušenou; již ověřenou historii nikdy nevymaže.
8. Uživatel ručně potvrdí účast a skutečné zastávky. Poté se cesta změní na `completed`.

## 7. Pravidlo „odemčení země“

Země se pro osobu X odemkne k nejstaršímu datu, kdy zároveň existuje:

- dokončená cesta (`travel_trips.status='completed'`),
- zastávka v zemi typu `stay` se stavem `verified`,
- potvrzená účast X na této zastávce (`travel_stop_people.presence='confirmed'`),
- datum návštěvy, případně známý měsíc/rok s příslušným označením nejistoty.

Pro „Společně“ se odemknutí počítá pouze ze zastávek, na kterých byli **alespoň dva členové současně**, pro „Celá rodina“ všichni čtyři. Pro „Všichni“ je to sjednocení osobních map. Po návratu do dřívějšího měsíce se zobrazí jen země odemčené do tohoto okamžiku.

**Důležitý rozdíl:** průjezd přes letiště v zemi se započítá do mapy tras, ale standardně neodemyká zemi. Lety se animují jen pro ověřené úseky; bez přesných míst se zobrazí neurčitá indikace, nikoli smyšlené letiště.

## 8. Import starých pasů

1. Uživatel dodá pokud možno pouze fotografie stran s razítky, ideálně s oříznutými osobními údaji.
2. Z každého razítka se vytěží **návrh**: osoba, země, datum, vstup/výstup, místo, jistota přečtení a odkaz na zdroj.
3. Záznamy vstupu/výstupu se seskupí do kandidátních cest, nikoli automaticky do prokázaných letů.
4. Uživatel potvrdí nejasnosti a přiřadí osoby; chybějící cesty lze doplnit ručně.
5. Teprve ověřené záznamy jsou zahrnuty do animace a statistik.
6. Originální pasové stránky se standardně **neukládají** do aplikace. Součástí archivace mohou být jen očištěné výřezy razítek v privátním úložišti.

## 9. UX a statistiky

- Horní lišta: název, návrat na Rozcestník, přepínač režimu `Historie / Plán`.
- Hlavní plocha: 2D mapa světa; po kliknutí na zemi seznam návštěv a účastníků.
- Pravý panel (na mobilu výsuvný): Všichni, Společně, Celá rodina, jednotlivé osoby; vrstvy Trasy / Země / Razítka.
- Dolní lišta: rok/měsíc, posuvník, Play/Pause, rychlost 1×/2×/4×, tlačítko „Dnes“.
- Statistiky: počet navštívených zemí podle filtru, unikátní země, nejstarší známá cesta, počet ověřených cest; žádné odhady neoznačovat jako jisté.

## 10. Dodání po etapách

**Etapa A — datový základ:** migrace `travel_*`, RLS a test nepřihlášeného přístupu; demo data.  
**Etapa B — UI:** mapa a animace se smyšlenými údaji; test na telefonu i desktopu.  
**Etapa C — Plánovač:** import, detekce konfliktů, ruční potvrzení dokončení.  
**Etapa D — historie:** ruční editor a postupné vytěžování pasových razítek.  
**Etapa E — spuštění:** test bezpečnosti, ochrany dat, prokliků, nový odkaz na Rozcestníku, nasazení po schválení.

## 11. Akceptační kritéria

- Jen přihlášený rodinný člen vidí reálná data; žádná privátní data nejsou v GitHubu, HTML ani veřejném Storage.
- Opakovaný import Plánovače nevytváří duplicity.
- Plánované či zamítnuté cesty nikdy neodemknou zemi.
- Tranzit neodemkne zemi.
- Filtr osoby vychází z účasti na zastávce, ne pouze z názvu cesty.
- Ověřené historické záznamy nepřepíše pozdější úprava v Plánovači.
- Animace korektně funguje i pro dva lety ve stejném měsíci a pro neznámé datum/místo.
- `?demo` funguje bez autentizace a používá pouze fiktivní data.
- Po změnách proběhnou testy mobilního i desktopového rozlišení, test oprávnění a kontrola diffu na osobní data a klíče.

**Stav:** návrh je připravený k diskusi. Žádná databázová tabulka, GitHub repozitář ani produkční data dosud nebyly změněny.