# Flight entitlement — zadání a datový model

**Verze:** 0.1 (návrh, ke schválení)
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
| Při prodloužení smlouvy se **přidá další dávka** letenek (dodatečný grant) | z tabulky |
| Nevyčerpaný nárok se přenáší, zůstatek = všechny dávky − čerpáno | z tabulky |
| Část starších letenek se uplatnila **zpětně jednou dávkou** (období covidu), takže pro rané roky existuje jen součet, ne jednotlivé lety | z tabulky |
| Letět může kdokoli z rodiny kdykoli (i na dovolenou) nebo vůbec; nebo si rodina letenku zaplatí sama | potvrzeno |
| Limit ceny jedné zpáteční letenky platí do konce roku 2026 (výše je v databázi, ne v repu) | potvrzeno |

Zdrojová tabulka je po rocích (2023, 2024, 2025) a po měsících. Obsahuje jen **počet** letenek v měsíci, **ne data letu, ceny ani trasy**. Ty doplní rodina sama, import tabulky tedy slouží jen jako kontrolní součet.

## 4. Rozsah první verze (MVP)

1. **Summary:** celkem nárok, čerpáno, zbývá. Za celé období i po letech. Barevně: v pořádku / blízko limitu / přečerpáno nebo k ověření.
2. **Tickets:** seznam letenek (jedna řádka = jedna osoba, tam i zpět). Hledání, filtry (osoba, rok, třída, stav, způsob úhrady) a úprava přímo v řádku podle vzoru záložky Lety.
3. **Cena:** částka v originální měně plus přepočet do CZK. Příplatek za business zvlášť. Kontrola limitu ceny (OK / nad limitem).
4. **People:** čerpání po osobách. Kdo s kým letěl. Samostatně osoba žijící v Londýně.
5. **Zdroj úhrady:** firemní benefit / zaplaceno rodinou / smíšené (benefit + doplatek).
6. **Export** do CSV a tisknutelného přehledu (anglicky) pro kolegyni.
7. **Jednorázový import** staré tabulky. Tlačítko, nikdy do gitu, vyžaduje kontrolu před uložením.
8. **Režim `?demo`** se smyšlenými lety a cenami.
9. Odkaz zpět do Rozcestníku a sdílitelný odkaz (`#entitlement`).

Mimo MVP: automatické načítání letenek z e-mailů, upozornění na blížící se konec roku.

## 5. Návrh datového modelu

Nové tabulky s předponou `travel_`, stejný model přístupu jako u stávajících (RLS, člen rodiny, `anon` bez práv).

| Tabulka | Účel | Hlavní pole |
|---|---|---|
| `travel_entitlement_grants` | Dávky nároku po osobách | `id`, `person_id`, `valid_from`, `valid_to`, `tickets`, `reason` (základní / prodloužení smlouvy / zpětně uplatněno), `source_note` |
| `travel_entitlement_settings` | Limit ceny letenky v čase | `valid_from`, `valid_to`, `price_cap_amount`, `price_cap_currency` |
| `travel_tickets` | Jedna zpáteční letenka jedné osoby (nebo souhrnný záznam historického čerpání) | `id`, `person_id`, `outbound_date`, `return_date`, `from_location_id`, `to_location_id`, `cabin` (economy/business), `payment_source` (benefit/family/mixed), `price_amount`, `price_currency`, `business_surcharge_amount`, `status`, `notes`, `trip_id` (nepovinně) |
| `travel_fx_rates` | Kurzy pro přepočet | `rate_date`, `currency`, `czk_per_unit`, `source` |
| `travel_ticket_legs` | Vazba letenky na existující lety | `ticket_id`, `leg_id` |

Poznámky:

- Číslo rezervace, čísla dokladů a jiné osobní identifikátory se neukládají.
- Letenka se **nepočítá** jako dva lety. Samostatné lety ze záložky Lety zůstávají; vazba je volitelná, aby se údaje nezadávaly dvakrát.
- Zbývající nárok osoby = součet jejích dávek − počet jejích letenek z benefitu. Počítá se, neukládá se.
- Historický součet (čerpáno před evidencí jednotlivých letů) se vede jako zvláštní „souhrnný“ záznam (`status = summary`, počet kusů), aby zůstatek sedil, i když chybí detail. Výpočet bude v samostatném souboru bez práce se stránkou, aby šel testovat.
- Přepočet: originální částka se nikdy nepřepisuje. CZK hodnota se dopočítá z uložených kurzů.

## 6. Technologie

Stejné jako zbytek aplikace: statická stránka (HTML, CSS, vanilla JS) na GitHub Pages, data v Supabase za přihlášením, `?demo` s paměťovým úložištěm. Nový soubor `entitlement.js` (zobrazení) a `entitlement-calc.js` (výpočty).

## 7. Otevřené otázky k rozhodnutí

1. **Platnost smlouvy.** Tabulka končí smlouvou do června 2026 a ta už uplynula. Byla smlouva znovu prodloužena a přibyla další dávka letenek? Kolik a od kdy? Doporučení: zadat jako novou dávku na osobu.
2. **Základní počet.** Vychází to na 2 letenky na osobu a rok smlouvy (7 let = 14). Souhlasí to? Doporučení: potvrdit u kolegyně.
3. **Převod mezi osobami.** Zůstatky se u osob liší. Lze nevyužité letenky jedné osoby použít pro jinou, nebo je nárok striktně na osobu? Doporučení: evidovat po osobách a v přehledu ukazovat i součet za rodinu.
4. **Aktuální stav.** Tabulka je asi rok stará. Pošli prosím poslední známý stav nebo seznam letů od té doby, ať počáteční zůstatek sedí.
5. **Limit ceny.** Co platí po konci roku 2026? Vztahuje se na cenu v době nákupu? Který kurz se používá (den nákupu)? Doporučení: ukládat kurz v den nákupu a vedle ukazovat aktuální přepočet.
6. **Měna „PHP“.** Psal jsi přepočet do PHP. Myslel jsi CZK (limit je v korunách)? Pokud opravdu filipínské peso, řekni, proč. Doporučení: originál + CZK, další měnu na přání.
7. **Zdroj kurzů.** Doporučení: denní kurz ČNB, stahuje se při zadání letenky a ukládá do `travel_fx_rates`.
8. **Příplatek za business.** Počítá se do limitu ceny letenky, nebo se hradí zvlášť? Doporučení: ukazovat obě částky i součet a limit hlídat podle toho, co potvrdíš.
9. **Londýn.** Má osoba žijící v Londýně lety z benefitu na trase Londýn–Čechy, nebo jen z Čech? Doporučení: trasa i zdroj úhrady volné.
10. **Export pro kolegyni.** Doporučení: anglicky, CSV + tisknutelná stránka ve stejném členění jako její tabulka (osoba, dávka, čerpáno, zbývá). Do repa se nic z exportu neukládá.

## 8. Postup

1. Ty odpovíš na otázky výše (zejména 1, 3 a 4).
2. Tabulku jsem prošel a zapracoval (viz kapitola 3). Zdrojová tabulka zůstává mimo git.
3. Po tvém schválení udělám migraci a návrh obrazovek (nejprve `?demo`).
4. Ověření na mobilu i desktopu, potom teprve import skutečných dat tlačítkem.

## 9. Soukromí

Do gitu nepatří skutečné ceny, jména, trasy ani zdrojová tabulka. Demo používá smyšlená data a neutrální jména.
