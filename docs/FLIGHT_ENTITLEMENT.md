# Flight entitlement — zadání a datový model

**Verze:** 1.0 (rozhodnutí zadavatele zapracována, ke schválení před stavbou)
**Datum:** 18. 11. 2026
**Navazuje na:** `docs/PROJECT.md` (Rodinné cesty), záložka Lety (`flights.js`)

## 1. K čemu to bude

Jednomu členu rodiny dává zaměstnavatel (firemní benefit) nárok na zpáteční letenky do Čech pro celou rodinu. Nárok se čerpá od prvního příletu v červenci 2018. Dosud ho sleduje kolegyně v tabulce. Chceme vlastní přehled, který ukáže:

- kolik letenek bylo využito a kolik nároku zbývá,
- kolik která letenka stála, kdo letěl a s kým,
- kdy se připlácelo (business třída, poplatky),
- jestli se vejdeme do limitu ceny jedné letenky.

Přehled musí jít vyexportovat kolegyni, aby ho mohla porovnat se svou evidencí.

## 2. Jazyk

Záložka a export jsou **anglicky** (názvy, popisky, tlačítka, export). Zbytek aplikace zůstává česky. Dokumentace v repu zůstává česky.

## 3. Pravidla nároku (ze zdrojové tabulky a od zadavatele)

| Pravidlo | Stav |
|---|---|
| Jedna jednotka nároku = **jedna zpáteční letenka pro 1 osobu** | potvrzeno |
| Nárok má **každá ze 4 osob zvlášť** (zaměstnankyně + 3 závislé osoby), stejný počet pro všechny | z tabulky |
| Nárok je vázán na **období smlouvy** (od 07/2018). Základní počet vychází zhruba na 2 letenky na osobu a rok smlouvy | z tabulky, ověřit (otázka 1) |
| Při prodloužení smlouvy se **přidá další dávka** letenek (dodatečný grant). Smlouva je nyní prodloužena do 06/2028, přibývají **2 letenky na osobu** | potvrzeno |
| Nárok je na zpáteční lety mezi místem bydliště a Českem; zaměstnavatel i bydliště používají měnu PHP | potvrzeno |
| Nevyčerpaný nárok se přenáší, zůstatek = všechny dávky − čerpáno | z tabulky |
| Část starších letenek se uplatnila **zpětně jednou dávkou** (období covidu), takže pro rané roky existuje jen součet, ne jednotlivé lety | z tabulky |
| Letět může kdokoli z rodiny kdykoli (i na dovolenou) nebo vůbec; nebo si rodina letenku zaplatí sama | potvrzeno |
| Limit ceny jedné zpáteční letenky platí do konce roku 2026 (výše je v databázi, ne v repu) | potvrzeno |

Zdrojová tabulka je po rocích (2023, 2024, 2025) a po měsících. Obsahuje jen **počet** letenek v měsíci, **ne data letu, ceny ani trasy**. Ty doplní rodina sama, import tabulky tedy slouží jen jako kontrolní součet.

### 3a. Výpočet doplatku (strhne se ze mzdy)

U letenky čerpané z benefitu platí:

```
celková cena = cena letenky + příplatek za business   (vše v CZK podle kurzu v den nákupu)
doplatek     = max(0, celková cena − limit platný v den nákupu)
```

- Příplatek za business se do celkové ceny **počítá**.
- Doplatek je částka, kterou zaměstnavatel strhne ze mzdy. Zobrazí se v CZK a v PHP.
- Letenka pod limitem má doplatek 0 a je označena zeleně. Letenka nad limitem je označena oranžově s vypsaným doplatkem.
- Letenka zaplacená rodinou samostatně (bez benefitu) nečerpá nárok a nemá limit ani doplatek.
- Limit je **pravidlo s platností od–do** a lze ho kdykoli změnit. Aktuální výše a platnost jsou jen v databázi, ne v repu. Letenka se vždy posuzuje podle limitu platného v den nákupu.

## 4. Rozsah první verze (MVP)

1. **Summary:** celkem nárok, čerpáno, zbývá. Za celé období i po letech. Barevně: v pořádku / blízko limitu / přečerpáno nebo k ověření.
2. **Tickets:** seznam letenek (jedna řádka = jedna osoba, tam i zpět). Hledání, filtry (osoba, rok, třída, stav, způsob úhrady) a úprava přímo v řádku podle vzoru záložky Lety.
3. **Cena:** částka v originální měně (podle faktury) plus přepočet do **PHP** (měna zaměstnavatele a místa bydliště) a **CZK** (limit ceny a pohled rodiny). Příplatek za business zvlášť. Kontrola limitu ceny (OK / nad limitem).
4. **People:** čerpání po osobách. Kdo s kým letěl. Samostatně osoba žijící v Londýně.
5. **Zdroj úhrady:** čerpáno z benefitu / zaplaceno rodinou samostatně. Doplatek nad limit se **dopočítá**, nevybírá se ručně (viz 3a).
6. **Export** do CSV a tisknutelného přehledu (anglicky) pro kolegyni.
7. **Ruční zadání** historie a počátečního stavu přes formulář (žádný import tabulky). Souhrnný záznam pro roky bez detailu.
8. **Režim `?demo`** se smyšlenými lety a cenami.
9. Odkaz zpět do Rozcestníku a sdílitelný odkaz (`#entitlement`).

Mimo MVP: automatické načítání letenek z e-mailů, upozornění na blížící se konec roku.

## 5. Návrh datového modelu

Nové tabulky s předponou `travel_`, stejný model přístupu jako u stávajících (RLS, člen rodiny, `anon` bez práv).

| Tabulka | Účel | Hlavní pole |
|---|---|---|
| `travel_entitlement_grants` | Dávky nároku po osobách | `id`, `person_id`, `valid_from`, `valid_to`, `tickets`, `reason` (základní / prodloužení smlouvy / zpětně uplatněno), `source_note` |
| `travel_entitlement_settings` | Limit ceny letenky v čase | `valid_from`, `valid_to`, `price_cap_amount`, `price_cap_currency` (zatím CZK) |
| `travel_tickets` | Jedna zpáteční letenka jedné osoby (nebo souhrnný záznam historického čerpání) | `id`, `person_id`, `purchase_date` (z něj se bere kurz a platný limit), `outbound_date`, `return_date`, `from_location_id`, `to_location_id`, `cabin` (economy/business), `payment_source` (benefit/family), `price_amount`, `price_currency`, `business_surcharge_amount`, `status`, `notes`, `trip_id` (nepovinně) |
| `travel_fx_rates` | Kurzy pro přepočet | `rate_date`, `currency`, `czk_per_unit`, `source` |
| `travel_entitlement_transfers` | Převod letenek mezi osobami | `id`, `from_person_id`, `to_person_id`, `tickets`, `transfer_date`, `notes` |
| `travel_ticket_legs` | Vazba letenky na existující lety | `ticket_id`, `leg_id` |

Poznámky:

- Číslo rezervace, čísla dokladů a jiné osobní identifikátory se neukládají.
- Letenka se **nepočítá** jako dva lety. Samostatné lety ze záložky Lety zůstávají; vazba je volitelná, aby se údaje nezadávaly dvakrát.
- Zbývající nárok osoby = dávky + přijaté převody − odeslané převody − letenky z benefitu. Počítá se, neukládá se.
- Historický součet (čerpáno před evidencí jednotlivých letů) se vede jako zvláštní „souhrnný“ záznam (`status = summary`, počet kusů), aby zůstatek sedil, i když chybí detail. Výpočet bude v samostatném souboru bez práce se stránkou, aby šel testovat.
- Přepočet: originální částka se nikdy nepřepisuje. Hodnoty v PHP a CZK se dopočítají z uložených kurzů (PHP, CZK, případně EUR a další měny podle faktury).

## 6. Technologie

Stejné jako zbytek aplikace: statická stránka (HTML, CSS, vanilla JS) na GitHub Pages, data v Supabase za přihlášením, `?demo` s paměťovým úložištěm. Nový soubor `entitlement.js` (zobrazení) a `entitlement-calc.js` (výpočty).

## 7. Rozhodnuto

- Smlouva je prodloužena do 06/2028, přibývají 2 letenky na osobu (nová dávka). Datum začátku doplní zadavatel.
- Nevyužité letenky lze převést mezi osobami. Evidence je po osobách, přehled ukazuje i součet za rodinu. Převod se zapíše jako samostatný záznam (kdo komu, kolik, kdy).
- Zobrazovací měny: **PHP** (hlavní) a **CZK** (limit). Originální měna z faktury zůstává uložená.
- Kurz: denní kurz ČNB, ukládá se při zadání letenky (dostupnost PHP ověřím při stavbě).
- Limit ceny je měnitelný, platnost od–do (viz 3a). Příplatek za business se do limitu počítá.
- Lety z Londýna se do benefitu počítají.
- Počáteční stav a lety doplní zadavatel ručně z dostupných záznamů (ne importem tabulky). Souhrnný záznam historického čerpání zůstane pro roky bez detailu.
- Export pro kolegyni: anglicky, CSV + tisknutelná stránka ve členění osoba / dávka / čerpáno / zbývá.

## Otevřené (drobné)

- Doplatek se strhává ve mzdě v PHP. Přepočítat CZK→PHP kurzem v den nákupu, nebo v den srážky? Zatím: den nákupu, lze změnit.
- Datum začátku nové dávky (2 letenky na osobu) a její platnost.

## 8. Postup

1. Návrh obrazovek v režimu `?demo` se smyšlenými daty (Summary, Tickets, People, Export), mobil a desktop.
2. Po schválení migrace `travel_*` tabulek (grants, tickets, settings, fx_rates, transfers) s RLS a test, že nečlen rodiny nevidí nic.
3. Ruční zadání skutečných dat zadavatelem přes formulář v přihlášeném režimu, nic z toho do gitu.
4. Dokumentace projektů na Rozcestníku a ověření odkazu zpět do Rozcestníku.

## 9. Soukromí

Do gitu nepatří skutečné ceny, jména, trasy ani zdrojová tabulka. Demo používá smyšlená data a neutrální jména.
