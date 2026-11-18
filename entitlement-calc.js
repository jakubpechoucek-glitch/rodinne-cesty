/* Flight entitlement – výpočty bez práce se stránkou (jdou testovat v Node).
   Žádná skutečná data: vše se předává jako parametry. */
(function (root) {
  'use strict';

  /* Kurz: rates = [{date:'YYYY-MM-DD', currency:'PHP', czk_per_unit:0.4}], platí poslední kurz k danému dni (nebo dřívější).
     Pokud k dni není žádný dřívější kurz, použije se nejstarší dostupný a ukáže se to ve výsledku (estimated). */
  function rateFor(rates, currency, date) {
    if (currency === 'CZK') return {czk_per_unit: 1, estimated: false};
    const list = rates.filter(r => r.currency === currency).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) return null;
    let hit = null;
    for (const r of list) if (r.date <= date) hit = r;
    if (hit) return {czk_per_unit: hit.czk_per_unit, estimated: false};
    return {czk_per_unit: list[0].czk_per_unit, estimated: true};
  }
  function convert(rates, amount, from, to, date) {
    if (from === to) return {amount, estimated: false};
    const a = rateFor(rates, from, date), b = rateFor(rates, to, date);
    if (!a || !b) return null;
    return {amount: amount * a.czk_per_unit / b.czk_per_unit, estimated: a.estimated || b.estimated};
  }

  /* Limit platný v daný den: rule = {valid_from, valid_to|null, amount, currency}. Při překryvu vyhrává pozdější začátek. */
  function limitAt(limits, date) {
    let hit = null;
    for (const l of limits) {
      if (l.valid_from <= date && (!l.valid_to || date <= l.valid_to) && (!hit || l.valid_from > hit.valid_from)) hit = l;
    }
    return hit;
  }

  /* Cena jedné letenky.
     t = {purchase_date, price_amount, price_currency, business_surcharge_amount, payment_source:'benefit'|'family', status} */
  function ticketCost(t, rates, limits) {
    const out = {total: null, totalCzk: null, totalPhp: null, limitCzk: null, overCzk: 0, overPhp: 0,
      level: 'none', estimated: false, problems: []};
    if (t.status === 'summary') {out.level = 'summary'; return out;}
    const price = Number(t.price_amount), sur = Number(t.business_surcharge_amount || 0);
    if (!isFinite(price)) {out.problems.push('missing price'); out.level = 'bad'; return out;}
    out.total = price + sur;
    const date = t.purchase_date || t.outbound_date;
    if (!date) {out.problems.push('missing purchase date'); out.level = 'bad'; return out;}
    const czk = convert(rates, out.total, t.price_currency, 'CZK', date);
    const php = convert(rates, out.total, t.price_currency, 'PHP', date);
    if (!czk || !php) {out.problems.push('missing exchange rate ' + t.price_currency); out.level = 'bad'; return out;}
    out.totalCzk = czk.amount; out.totalPhp = php.amount; out.estimated = czk.estimated || php.estimated;
    if (t.payment_source !== 'benefit') {out.level = 'family'; return out;}
    const lim = limitAt(limits, date);
    if (!lim) {out.problems.push('no limit valid on purchase date'); out.level = 'bad'; return out;}
    const limCzk = convert(rates, lim.amount, lim.currency, 'CZK', date);
    if (!limCzk) {out.problems.push('missing exchange rate ' + lim.currency); out.level = 'bad'; return out;}
    out.limitCzk = limCzk.amount;
    out.overCzk = Math.max(0, out.totalCzk - out.limitCzk);
    const overPhp = convert(rates, out.overCzk, 'CZK', 'PHP', date);
    out.overPhp = overPhp ? overPhp.amount : 0;
    out.level = out.overCzk > 0 ? 'over' : 'ok';
    return out;
  }

  /* Počet čerpaných letenek jednoho záznamu: souhrnný záznam má count, běžná letenka 1.
     Z benefitu se čerpá jen payment_source === 'benefit'. Zrušené letenky (status 'cancelled') se nepočítají. */
  function used(t) {
    if (t.status === 'cancelled' || t.payment_source !== 'benefit') return 0;
    return t.status === 'summary' ? Number(t.count || 0) : 1;
  }

  /* Zůstatek osoby: dávky + přijaté převody − odeslané převody − čerpáno. */
  function balance(personId, grants, transfers, tickets) {
    const granted = grants.filter(g => g.person_id === personId).reduce((s, g) => s + Number(g.tickets), 0);
    const received = transfers.filter(x => x.to_person_id === personId).reduce((s, x) => s + Number(x.tickets), 0);
    const sent = transfers.filter(x => x.from_person_id === personId).reduce((s, x) => s + Number(x.tickets), 0);
    const u = tickets.filter(t => t.person_id === personId).reduce((s, t) => s + used(t), 0);
    const entitled = granted + received - sent;
    return {granted, received, sent, entitled, used: u, remaining: entitled - u};
  }

  /* Kdo s kým letěl: ostatní osoby se stejnou trasou a stejným datem odletu (jen běžné letenky). */
  function companions(t, tickets) {
    if (t.status === 'summary') return [];
    return tickets.filter(o => o.id !== t.id && o.status !== 'summary' && o.status !== 'cancelled' &&
      o.from === t.from && o.to === t.to && o.outbound_date === t.outbound_date).map(o => o.person_id);
  }

  /* Čerpání po kalendářních letech podle data odletu (souhrnné záznamy mají vlastní rok `year`). */
  function usedByYear(personId, tickets) {
    const m = {};
    for (const t of tickets) {
      if (t.person_id !== personId) continue;
      const n = used(t); if (!n) continue;
      const y = t.status === 'summary' ? String(t.year || '') : (t.outbound_date || '').slice(0, 4);
      m[y || 'unknown'] = (m[y || 'unknown'] || 0) + n;
    }
    return m;
  }

  /* Součty srážek ze mzdy (jen letenky z benefitu nad limitem, bez zrušených). */
  function deductions(tickets, rates, limits) {
    let czk = 0, php = 0, n = 0;
    for (const t of tickets) {
      if (t.status === 'cancelled') continue;
      const c = ticketCost(t, rates, limits);
      if (c.overCzk > 0) {czk += c.overCzk; php += c.overPhp; n++;}
    }
    return {czk, php, count: n};
  }

  /* CSV pro kolegyni (anglicky). Hodnota začínající = + - @ se uvozuje apostrofem proti vložení vzorce v Excelu. */
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {return rows.map(r => r.map(csvCell).join(',')).join('\r\n');}

  const api = {rateFor, convert, limitAt, ticketCost, used, balance, companions, usedByYear, deductions, toCsv, csvCell};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EntitlementCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
