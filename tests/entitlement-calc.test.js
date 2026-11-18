// Spuštění: node tests/entitlement-calc.test.js   (smyšlená data)
const assert = require('node:assert/strict');
const C = require('../entitlement-calc.js');
const rates = [{date:'2026-01-01',currency:'PHP',czk_per_unit:0.4},{date:'2026-06-01',currency:'PHP',czk_per_unit:0.5},{date:'2026-01-01',currency:'EUR',czk_per_unit:25}];
const limits = [{valid_from:'2020-01-01',valid_to:'2026-12-31',amount:40000,currency:'CZK'},{valid_from:'2027-01-01',valid_to:null,amount:50000,currency:'CZK'}];

// kurz: poslední platný k datu, dřívější den bere starší kurz
assert.equal(C.rateFor(rates,'PHP','2026-03-01').czk_per_unit,0.4);
assert.equal(C.rateFor(rates,'PHP','2026-06-01').czk_per_unit,0.5);
assert.equal(C.rateFor(rates,'PHP','2025-01-01').estimated,true);
assert.equal(C.rateFor(rates,'USD','2026-03-01'),null);
assert.equal(C.convert(rates,1000,'EUR','PHP','2026-03-01').amount,62500);

// limit podle data nákupu
assert.equal(C.limitAt(limits,'2026-12-31').amount,40000);
assert.equal(C.limitAt(limits,'2027-01-01').amount,50000);
assert.equal(C.limitAt(limits,'2010-01-01'),null);

// letenka pod limitem: 60 000 PHP * 0.4 = 24 000 CZK
let c = C.ticketCost({purchase_date:'2026-03-01',price_amount:60000,price_currency:'PHP',payment_source:'benefit'},rates,limits);
assert.equal(c.level,'ok'); assert.equal(c.overCzk,0); assert.equal(c.totalCzk,24000);

// business příplatek se počítá do limitu: (70 000 + 45 000) * 0.4 = 46 000 -> doplatek 6 000 CZK = 15 000 PHP
c = C.ticketCost({purchase_date:'2026-03-01',price_amount:70000,business_surcharge_amount:45000,price_currency:'PHP',payment_source:'benefit'},rates,limits);
assert.equal(c.level,'over'); assert.equal(c.overCzk,6000); assert.equal(c.overPhp,15000);

// přesně na limitu = bez doplatku
c = C.ticketCost({purchase_date:'2026-03-01',price_amount:100000,price_currency:'PHP',payment_source:'benefit'},rates,limits);
assert.equal(c.overCzk,0);

// nový limit od 2027 (50 000), kurz z posledního dne
c = C.ticketCost({purchase_date:'2027-02-01',price_amount:120000,price_currency:'PHP',payment_source:'benefit'},rates,limits);
assert.equal(c.limitCzk,50000); assert.equal(c.overCzk,10000); // 120000*0.5=60000

// rodinná platba: bez limitu a doplatku
c = C.ticketCost({purchase_date:'2026-03-01',price_amount:900,price_currency:'EUR',payment_source:'family'},rates,limits);
assert.equal(c.level,'family'); assert.equal(c.overCzk,0);

// chybějící kurz / limit se hlásí, nepočítá se potichu
c = C.ticketCost({purchase_date:'2026-03-01',price_amount:10,price_currency:'USD',payment_source:'benefit'},rates,limits);
assert.equal(c.level,'bad'); assert.match(c.problems[0],/exchange rate/);
c = C.ticketCost({purchase_date:'2010-03-01',price_amount:10,price_currency:'CZK',payment_source:'benefit'},rates,limits);
assert.equal(c.level,'bad'); assert.match(c.problems[0],/limit/);

// společná zásoba rodiny: dávky − čerpáno; souhrn, zrušené a rodinné platby se nepočítají
const grants=[{tickets:56},{tickets:8}];
const tickets=[
 {id:'1',person_id:'a',status:'summary',count:30,payment_source:'benefit',year:2023},
 {id:'2',person_id:'a',status:'flown',payment_source:'benefit',from:'MNL',to:'PRG',outbound_date:'2026-03-02'},
 {id:'3',person_id:'b',status:'flown',payment_source:'benefit',from:'MNL',to:'PRG',outbound_date:'2026-03-02'},
 {id:'4',person_id:'b',status:'cancelled',payment_source:'benefit',from:'MNL',to:'PRG',outbound_date:'2026-05-02'},
 {id:'5',person_id:'b',status:'flown',payment_source:'family',from:'MNL',to:'PRG',outbound_date:'2026-07-02'},
 {id:'6',person_id:'c',status:'booked',payment_source:'benefit',from:'LHR',to:'PRG',outbound_date:'2026-12-02'}];
assert.deepEqual(C.pool(grants,tickets),{granted:64,used:33,remaining:31,booked:1});
assert.deepEqual(C.companions(tickets[1],tickets),['b']);
assert.deepEqual(C.usedByYear(tickets),{'2023':{benefit:30,family:0},'2026':{benefit:3,family:1}});
// tempo: 24 měsíců do konce smlouvy a 12 letenek = 6 ročně; po konci smlouvy nic
assert.equal(C.pace(12,'2028-06-30','2026-07-15').months,24); assert.equal(C.pace(12,'2028-06-30','2026-07-15').perYear,6);
assert.equal(C.pace(5,'2025-06-30','2026-07-15').ended,true); assert.equal(C.pace(5,null,'2026-07-15'),null);

// souhrn srážek
const d=C.deductions([{purchase_date:'2026-03-01',price_amount:70000,business_surcharge_amount:45000,price_currency:'PHP',payment_source:'benefit'}],rates,limits);
assert.equal(d.czk,6000); assert.equal(d.php,15000); assert.equal(d.count,1);

// CSV: uvozovky a ochrana proti vzorcům
assert.equal(C.csvCell('=1+1'),"'=1+1"); assert.equal(C.csvCell('-5'),'-5'); assert.equal(C.csvCell('a,b'),'"a,b"');
console.log('OK: všechny testy prošly');
