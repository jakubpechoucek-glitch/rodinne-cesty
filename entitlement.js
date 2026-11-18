/* Rodinné cesty – záložka „Flight entitlement“ (anglicky).
   Režim ?demo: smyšlená data v paměti prohlížeče. Živý režim: chráněný Supabase
   (travel_entitlement_grants, travel_entitlement_limits, travel_fx_rates, travel_tickets).
   Výpočty jsou v entitlement-calc.js. V kódu nejsou žádné soukromé údaje. */
(function () {
  'use strict';
  const C = window.EntitlementCalc;
  const DEMO = new URLSearchParams(location.search).has('demo') || location.protocol === 'file:';
  if (!C || !window.RodinneCestyFlights) return;
  const S = {people: [], grants: [], limits: [], rates: [], tickets: [], root: null, sub: 'summary', editing: '',
    filters: {q: '', person: '', year: '', source: '', level: ''}, busy: false, mode: 'demo', db: null, started: false};
  const mk = (tag, cls, text) => {const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n;};
  const num = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0});
  const money = (v, cur) => cur + ' ' + num.format(Math.round(v));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = d => d ? (+d.slice(8, 10)) + ' ' + MONTHS[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : '—';
  const pname = id => id ? (S.people.find(p => p.id === id) || {}).display_name || '?' : '';
  const CURRENCIES = ['PHP', 'CZK', 'EUR', 'USD', 'GBP'];
  const airports = () => (typeof AIRPORTS !== 'undefined' ? AIRPORTS : []);
  const uid = () => 'x' + Math.random().toString(36).slice(2, 9);

  /* ---------- smyšlená data (demo) ---------- */
  function demoData() {
    const ids = ['a', 'b', 'c', 'd'];
    const people = [['a', 'Alex'], ['b', 'Bára'], ['c', 'Cyril'], ['d', 'Dana']].map(([id, n]) => ({id, display_name: n}));
    const grants = [
      {id: 'g1', valid_from: '2018-07-01', valid_to: '2025-06-30', tickets: 56, reason: 'Base entitlement', source_note: '4 people × 14'},
      {id: 'g2', valid_from: '2025-07-01', valid_to: '2026-06-30', tickets: 8, reason: 'Contract extension', source_note: '4 people × 2'},
      {id: 'g3', valid_from: '2026-07-01', valid_to: '2028-06-30', tickets: 8, reason: 'Contract extension', source_note: '4 people × 2'}];
    const tickets = [];
    for (const p of ids) {
      tickets.push({id: 's-r-' + p, person_id: p, status: 'summary', count: 9, year: 2023, payment_source: 'benefit', notes: 'Claimed retroactively for earlier years (no per-flight detail)'},
        {id: 's-j-' + p, person_id: p, status: 'summary', count: 1, year: 2023, outbound_date: '2023-07-01', payment_source: 'benefit', notes: 'Month only, no flight detail'});
    }
    const t = (person, out, back, purchase, from, to, cabin, source, price, cur, sur, status, notes) => tickets.push({id: uid(), person_id: person,
      outbound_date: out, return_date: back, purchase_date: purchase, from, to, cabin, payment_source: source, price_amount: price,
      price_currency: cur, business_surcharge_amount: sur || 0, status, notes: notes || ''});
    for (const p of ids) t(p, '2024-01-10', '2024-01-28', '2023-11-20', 'MNL', 'PRG', 'economy', 'benefit', 58000, 'PHP', 0, 'flown');
    for (const p of ['a', 'b']) t(p, '2024-07-05', '2024-07-30', '2024-04-02', 'MNL', 'PRG', 'economy', 'benefit', 61000, 'PHP', 0, 'flown');
    t('c', '2025-04-10', '2025-04-20', '2025-02-15', 'LHR', 'PRG', 'economy', 'benefit', 150, 'EUR', 0, 'flown', 'Flight from the city where this person studies');
    t('a', '2025-07-04', '2025-08-01', '2025-04-20', 'MNL', 'PRG', 'business', 'benefit', 64000, 'PHP', 52000, 'flown', 'Business class: surcharge counts towards the limit');
    for (const p of ['b', 'd']) t(p, '2025-07-04', '2025-08-01', '2025-04-20', 'MNL', 'PRG', 'economy', 'benefit', 63000, 'PHP', 0, 'flown');
    t('d', '2026-03-12', '2026-03-30', '2026-01-20', 'MNL', 'PRG', 'economy', 'benefit', 59000, 'PHP', 0, 'cancelled', 'Cancelled, not counted');
    for (const p of ['a', 'b']) t(p, '2026-08-01', '2026-08-25', '2026-06-15', 'MNL', 'PRG', 'economy', 'benefit', 72000, 'PHP', 0, 'booked');
    t('d', '2026-08-01', '2026-08-25', '2026-06-15', 'MNL', 'PRG', 'economy', 'family', 950, 'EUR', 0, 'booked', 'Paid by the family, entitlement not used');
    const rates = [];
    for (const [d, php, eur, usd, gbp] of [['2023-01-01', 0.40, 24.0, 22.0, 27.5], ['2024-01-01', 0.41, 24.8, 22.8, 28.5], ['2025-01-01', 0.40, 25.0, 23.9, 29.5], ['2026-01-01', 0.39, 24.5, 21.0, 28.0]])
      rates.push({date: d, currency: 'PHP', czk_per_unit: php}, {date: d, currency: 'EUR', czk_per_unit: eur}, {date: d, currency: 'USD', czk_per_unit: usd}, {date: d, currency: 'GBP', czk_per_unit: gbp});
    return {people, grants, tickets, rates, limits: [{id: 'l1', valid_from: '2018-01-01', valid_to: '2026-12-31', amount: 38000, currency: 'CZK'}, {id: 'l2', valid_from: '2027-01-01', valid_to: null, amount: 42000, currency: 'CZK'}]};
  }

  /* ---------- úložiště: demo (paměť) a živé (Supabase) ---------- */
  const must = res => {if (res.error) throw res.error; return res.data || [];};
  const ticketOut = t => ({person_id: t.person_id || null, status: t.status, payment_source: t.payment_source,
    purchase_date: t.purchase_date || null, outbound_date: t.outbound_date || null, return_date: t.return_date || null,
    from_iata: t.status === 'summary' ? null : t.from, to_iata: t.status === 'summary' ? null : t.to, cabin: t.cabin || 'economy',
    price_amount: t.status === 'summary' ? null : t.price_amount, price_currency: t.status === 'summary' ? null : t.price_currency,
    business_surcharge_amount: t.business_surcharge_amount || 0, ticket_count: t.status === 'summary' ? t.count : null,
    summary_year: t.status === 'summary' ? t.year : null, notes: t.notes || '', updated_at: new Date().toISOString()});
  const ticketIn = r => ({id: r.id, person_id: r.person_id || '', status: r.status, payment_source: r.payment_source, purchase_date: r.purchase_date,
    outbound_date: r.outbound_date, return_date: r.return_date, from: r.from_iata, to: r.to_iata, cabin: r.cabin,
    price_amount: r.price_amount == null ? null : Number(r.price_amount), price_currency: r.price_currency,
    business_surcharge_amount: Number(r.business_surcharge_amount || 0), count: r.ticket_count, year: r.summary_year, notes: r.notes || ''});
  const store = {
    async load() {
      if (S.mode === 'demo') return;
      const [people, grants, limits, rates, tickets] = await Promise.all(['travel_people', 'travel_entitlement_grants', 'travel_entitlement_limits', 'travel_fx_rates', 'travel_tickets']
        .map(t => S.db.from(t).select('*')));
      S.people = must(people).map(p => ({id: p.id, display_name: p.display_name}));
      S.grants = must(grants).map(g => ({id: g.id, valid_from: g.valid_from, valid_to: g.valid_to, tickets: Number(g.tickets), reason: g.reason, source_note: g.source_note || ''}));
      S.limits = must(limits).map(l => ({id: l.id, valid_from: l.valid_from, valid_to: l.valid_to, amount: Number(l.amount), currency: l.currency}));
      S.rates = must(rates).map(r => ({date: r.rate_date, currency: r.currency, czk_per_unit: Number(r.czk_per_unit), source: r.source}));
      S.tickets = must(tickets).map(ticketIn);
    },
    async saveTicket(v) {
      if (S.mode === 'demo') {if (!v.id) {v.id = uid(); S.tickets.push(v);} else S.tickets[S.tickets.findIndex(x => x.id === v.id)] = v; return;}
      if (v.id) must(await S.db.from('travel_tickets').update(ticketOut(v)).eq('id', v.id)); else must(await S.db.from('travel_tickets').insert(ticketOut(v)));
      await this.load();
    },
    async deleteTicket(id) {
      if (S.mode === 'demo') {S.tickets.splice(S.tickets.findIndex(x => x.id === id), 1); return;}
      must(await S.db.from('travel_tickets').delete().eq('id', id)); await this.load();
    },
    async addGrant(g) {if (S.mode === 'demo') {S.grants.push({id: uid(), ...g}); return;} must(await S.db.from('travel_entitlement_grants').insert(g)); await this.load();},
    async deleteGrant(id) {if (S.mode === 'demo') {S.grants.splice(S.grants.findIndex(x => x.id === id), 1); return;} must(await S.db.from('travel_entitlement_grants').delete().eq('id', id)); await this.load();},
    async addLimit(l) {if (S.mode === 'demo') {S.limits.push({id: uid(), ...l}); return;} must(await S.db.from('travel_entitlement_limits').insert(l)); await this.load();},
    async deleteLimit(id) {if (S.mode === 'demo') {S.limits.splice(S.limits.findIndex(x => x.id === id), 1); return;} must(await S.db.from('travel_entitlement_limits').delete().eq('id', id)); await this.load();},
    async addRate(r) {
      if (S.mode === 'demo') {S.rates = S.rates.filter(x => !(x.date === r.rate_date && x.currency === r.currency)); S.rates.push({date: r.rate_date, currency: r.currency, czk_per_unit: r.czk_per_unit}); return;}
      must(await S.db.from('travel_fx_rates').upsert(r, {onConflict: 'rate_date,currency'})); await this.load();
    },
    /* Kurzy ČNB k danému dni (existující funkce databáze fin_kurzy_cnb: PHP, EUR, USD, GBP v CZK za 1 jednotku). */
    async ensureRates(day, currencies) {
      if (S.mode === 'demo') return '';
      const need = [...new Set(['PHP', ...currencies].filter(c => c !== 'CZK'))].filter(c => !S.rates.some(r => r.date === day && r.currency === c));
      if (!need.length) return '';
      const res = await S.db.rpc('fin_kurzy_cnb', {datum: day});
      if (res.error) throw res.error;
      const rows = need.filter(c => res.data && res.data[c.toLowerCase()] != null).map(c => ({rate_date: day, currency: c, czk_per_unit: Number(res.data[c.toLowerCase()]), source: 'CNB'}));
      const missing = need.filter(c => !rows.some(r => r.currency === c));
      if (rows.length) must(await S.db.from('travel_fx_rates').upsert(rows, {onConflict: 'rate_date,currency'}));
      await this.load();
      return missing.length ? 'CNB has no rate for ' + missing.join(', ') + ' on ' + date(day) + '. Add it manually in Rules.' : '';
    }
  };
  /* Provede zápis, ukáže srozumitelný stav a chybu nezamlčí. */
  async function perform(fn, okMsg) {
    if (S.busy) return false;
    S.busy = true;
    try {const warn = await fn(); say(warn ? okMsg + ' Warning: ' + warn : okMsg, warn ? 'error' : 'success'); render(); return true;}
    catch (e) {console.error('Entitlement', e); say('Action failed: ' + (e && e.message || e), 'error'); return false;}
    finally {S.busy = false;}
  }
  const savedMsg = () => S.mode === 'demo' ? 'Saved (demo data lives only in this browser tab).' : 'Saved.';

  /* ---------- pomocné ---------- */
  const cost = t => C.ticketCost(t, S.rates, S.limits);
  const today = () => new Date().toISOString().slice(0, 10);
  const say = (msg, kind) => {const b = S.root.querySelector('.en-msg'); b.textContent = msg || ''; b.hidden = !msg; b.dataset.kind = kind || 'info';};
  const lbl = (text, control, wide) => {const l = mk('label', 'en-field' + (wide ? ' en-wide' : '')); l.append(mk('span', null, text), control); return l;};
  const input = (type, value, extra) => {const i = document.createElement('input'); i.type = type; i.value = value == null ? '' : value; Object.assign(i, extra || {}); return i;};
  const select = (opts, value) => {const s = document.createElement('select'); for (const [v, l] of opts) s.append(new Option(l, v)); s.value = value; return s;};
  const personOpts = () => S.people.map(p => [p.id, p.display_name]);
  const btn = (text, cls, fn) => {const b = mk('button', 'en-btn ' + (cls || ''), text); b.type = 'button'; b.addEventListener('click', fn); return b;};
  const year = t => t.status === 'summary' ? String(t.year || '') : (t.outbound_date || '').slice(0, 4);

  /* ---------- Summary ---------- */
  function renderSummary(box) {
    const P = C.pool(S.grants, S.tickets);
    if (S.mode === 'live' && !S.grants.length && !S.loadFailed) box.append(mk('div', 'en-msg', 'No entitlement grants yet. Start in Rules: add the entitlement grants and the price limit, then add tickets in the Tickets tab.'));
    const end = S.grants.reduce((m, g) => g.valid_to && g.valid_to > m ? g.valid_to : m, '');
    const pace = C.pace(P.remaining, end, today());
    const ded = C.deductions(S.tickets, S.rates, S.limits);
    const bad = S.tickets.filter(t => t.status !== 'cancelled' && cost(t).level === 'bad').length;
    const level = P.remaining <= 0 ? 'bad' : P.remaining <= 4 ? 'warn' : '';
    const hero = mk('div', 'en-card en-hero ' + level);
    const big = mk('div', 'en-big', String(P.remaining)); big.append(mk('small', null, ' return tickets remaining'));
    const bar = mk('div', 'en-bar'); const fill = document.createElement('i'); fill.style.width = (P.granted ? Math.min(100, Math.max(0, P.used / P.granted * 100)) : 0) + '%'; bar.append(fill);
    const meta = mk('div', 'en-meta'); meta.append(mk('span', null, 'Used ' + P.used + ' of ' + P.granted + ' granted'));
    if (P.booked) meta.append(mk('span', null, 'of which ' + P.booked + ' booked, not flown yet'));
    hero.append(big, bar, meta);
    if (pace && !pace.ended) hero.append(mk('div', 'en-pace', 'Contract runs until ' + date(end) + ' (' + pace.months + ' months left). To use everything up, that is about ' + (Math.round(pace.perYear * 10) / 10) + ' tickets per year.'));
    else if (pace && pace.ended) hero.append(mk('div', 'en-pace', 'The last entitlement period ended on ' + date(end) + '. Add a new grant in Rules if the contract was extended.'));
    box.append(hero);
    const tiles = mk('div', 'en-tiles');
    const tile = (label, bigText, cls, small) => {const d = mk('div', 'en-tile ' + (cls || '')); d.append(mk('span', null, label), mk('b', null, bigText)); if (small) d.append(mk('small', null, small)); tiles.append(d);};
    tile('Granted in total', String(P.granted), '', S.grants.length + ' grant' + (S.grants.length === 1 ? '' : 's'));
    tile('Used', String(P.used));
    tile('To deduct from salary', money(ded.php, 'PHP'), ded.count ? 'warn' : 'ok', ded.count ? money(ded.czk, 'CZK') + ' · ' + ded.count + ' ticket' + (ded.count > 1 ? 's' : '') + ' over the limit' : 'No ticket over the limit');
    box.append(tiles);
    if (bad) box.append(mk('div', 'en-msg', bad + ' ticket' + (bad > 1 ? 's' : '') + ' cannot be priced (missing rate, limit or price). Check the Tickets tab.'));
    const by = C.usedByYear(S.tickets), years = Object.keys(by).sort();
    const sec = mk('div', 'en-section'); sec.append(mk('h3', null, 'Tickets used per year'));
    const mx = Math.max(1, ...years.map(y => by[y].benefit + by[y].family));
    for (const y of years) {
      const row = mk('div', 'en-yrow'); row.append(mk('span', 'en-ylab', y));
      const track = mk('div', 'en-ytrack');
      const seg = (n, cls) => {if (!n) return; const i = mk('i', cls, String(n)); i.style.width = (n / mx * 100) + '%'; track.append(i);};
      seg(by[y].benefit, 'en-seg-b'); seg(by[y].family, 'en-seg-f'); row.append(track); sec.append(row);
    }
    sec.append(mk('p', 'en-note', 'Green = from the entitlement, blue = paid by the family (not counted). 2023 includes tickets claimed retroactively for earlier years.'));
    box.append(sec);
  }

  /* ---------- Tickets ---------- */
  const SRC = {benefit: 'Entitlement', family: 'Paid by family'};
  function visible() {
    const f = S.filters, q = f.q.trim().toLowerCase();
    return S.tickets.filter(t => {
      if (f.person && t.person_id !== f.person) return false;
      if (f.year && year(t) !== f.year) return false;
      if (f.source && t.payment_source !== f.source) return false;
      if (f.level) {const c = cost(t); if (f.level === 'over' && c.level !== 'over') return false; if (f.level === 'cancelled' && t.status !== 'cancelled') return false;}
      if (q && ![t.person_id ? pname(t.person_id) : '', t.from, t.to, t.notes, t.cabin, t.status].join(' ').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (b.outbound_date || String(b.year || '')).localeCompare(a.outbound_date || String(a.year || '')));
  }
  function renderTickets(box) {
    const f = S.filters;
    const bar = mk('div', 'en-bar-f');
    const q = input('search', f.q, {placeholder: 'Search person, airport, note…'}); q.addEventListener('input', () => {f.q = q.value; renderList();});
    const pf = select([['', 'All people'], ...personOpts()], f.person); pf.addEventListener('change', () => {f.person = pf.value; renderList();});
    const years = [...new Set(S.tickets.map(year).filter(Boolean))].sort().reverse();
    const yf = select([['', 'All years'], ...years.map(y => [y, y])], f.year); yf.addEventListener('change', () => {f.year = yf.value; renderList();});
    const sf = select([['', 'All payers'], ['benefit', 'Entitlement'], ['family', 'Paid by family']], f.source); sf.addEventListener('change', () => {f.source = sf.value; renderList();});
    const lf = select([['', 'All statuses'], ['over', 'Over the limit'], ['cancelled', 'Cancelled']], f.level); lf.addEventListener('change', () => {f.level = lf.value; renderList();});
    bar.append(q, pf, yf, sf, lf);
    const top = mk('div', 'en-head'); top.append(mk('p', 'en-note en-count'), btn('+ Add ticket', 'en-primary', () => {S.editing = 'new'; renderList();}));
    const list = mk('div', 'en-list');
    box.append(bar, top, list);
    function renderList() {
      list.textContent = '';
      const rows = visible();
      top.querySelector('.en-count').textContent = rows.length + ' of ' + S.tickets.length + ' records';
      if (S.editing === 'new') list.append(ticketForm({id: '', person_id: (S.people[0] || {}).id || '', status: 'booked', payment_source: 'benefit', cabin: 'economy', price_currency: 'PHP', business_surcharge_amount: 0}));
      if (!rows.length && S.editing !== 'new') list.append(mk('p', 'en-empty', 'No tickets match the filters.'));
      for (const t of rows) list.append(S.editing === t.id ? ticketForm(t) : ticketCard(t));
    }
    S.renderList = renderList; renderList();
  }
  function ticketCard(t) {
    const c = t.status === 'summary' ? {level: 'summary'} : cost(t);
    const cancelled = t.status === 'cancelled';
    const cls = cancelled ? 'summary' : c.level === 'over' ? 'warn' : c.level === 'bad' ? 'bad' : c.level === 'family' ? 'family' : c.level === 'summary' ? 'summary' : '';
    const card = mk('div', 'en-card ' + cls);
    const head = mk('div', 'en-head');
    if (t.status === 'summary') head.append(mk('div', 'en-name', (t.person_id ? pname(t.person_id) + ' · ' : '') + t.count + ' ticket' + (t.count === 1 ? '' : 's') + ' · ' + (t.outbound_date ? MONTHS[+t.outbound_date.slice(5, 7) - 1] + ' ' : '') + t.year + ' (summary)'));
    else head.append(mk('div', 'en-name', pname(t.person_id) + ' · ' + t.from + ' → ' + t.to));
    const badges = mk('div', 'en-chips');
    const badge = (text, k) => badges.append(mk('span', 'en-badge en-b-' + k, text));
    if (cancelled) badge('Cancelled', 'sum');
    else if (c.level === 'summary') badge('Summary of earlier years', 'sum');
    else if (c.level === 'over') badge('Over limit · deduct ' + money(c.overPhp, 'PHP'), 'warn');
    else if (c.level === 'ok') badge('Within limit', 'ok');
    else if (c.level === 'family') badge('Paid by family', 'family');
    else badge('Needs attention', 'bad');
    if (t.status === 'booked') badge('Booked', 'sum');
    head.append(badges); card.append(head);
    if (t.status !== 'summary') {
      const m = mk('div', 'en-meta');
      m.append(mk('span', null, 'Out ' + date(t.outbound_date)), mk('span', null, 'Back ' + date(t.return_date)), mk('span', null, t.cabin === 'business' ? 'Business' : 'Economy'), mk('span', null, SRC[t.payment_source]));
      card.append(m);
      const comp = C.companions(t, S.tickets);
      if (comp.length && !cancelled) card.append(mk('div', 'en-meta', 'Flew with ' + comp.map(pname).join(', ')));
      const mo = mk('div', 'en-money');
      const price = t.price_currency + ' ' + num.format(Number(t.price_amount)) + (Number(t.business_surcharge_amount) ? ' + ' + num.format(Number(t.business_surcharge_amount)) + ' business surcharge' : '');
      mo.append(mk('span', null, 'Price ' + price));
      if (c.totalCzk != null) {
        mo.append(mk('span', null, 'Total ' + money(c.totalPhp, 'PHP') + ' · ' + money(c.totalCzk, 'CZK') + (c.estimated ? ' (rate estimated)' : '')));
        if (c.level === 'over' || c.level === 'ok') mo.append(mk('span', c.level === 'over' ? 'over' : 'ok', c.level === 'over'
          ? 'Limit ' + money(c.limitCzk, 'CZK') + ' → deduction ' + money(c.overPhp, 'PHP') + ' (' + money(c.overCzk, 'CZK') + ')'
          : 'Limit ' + money(c.limitCzk, 'CZK') + ' · no deduction'));
      }
      for (const pr of c.problems || []) mo.append(mk('span', 'over', '⚠ ' + pr));
      card.append(mo);
    }
    if (t.notes) card.append(mk('div', 'en-note', t.notes));
    card.append(btn('Edit', '', () => {S.editing = t.id; S.renderList();}));
    return card;
  }
  function ticketForm(t) {
    const form = mk('form', 'en-card'); const fs = mk('div', 'en-form');
    const summary = t.status === 'summary';
    const f = {};
    f.person = select(personOpts(), t.person_id); fs.append(lbl('Traveller', f.person));
    if (summary) {
      f.count = input('number', t.count, {min: 0, step: 1}); f.year = input('number', t.year, {min: 2018, max: 2100, step: 1}); f.month = input('month', t.outbound_date ? t.outbound_date.slice(0, 7) : '');
      fs.append(lbl('Tickets used', f.count), lbl('Month (optional)', f.month), lbl('Year (if no month)', f.year));
    } else {
      f.purchase = input('date', t.purchase_date); f.out = input('date', t.outbound_date); f.back = input('date', t.return_date);
      const dl = document.createElement('datalist'); dl.id = 'en-airports'; for (const a of airports()) {const o = document.createElement('option'); o.value = a.iata; o.label = a.name; dl.append(o);}
      f.from = input('text', t.from, {maxLength: 3, placeholder: 'MNL'}); f.to = input('text', t.to, {maxLength: 3, placeholder: 'PRG'});
      f.from.setAttribute('list', 'en-airports'); f.to.setAttribute('list', 'en-airports');
      f.cabin = select([['economy', 'Economy'], ['business', 'Business']], t.cabin);
      f.source = select([['benefit', 'Entitlement (company benefit)'], ['family', 'Paid by the family']], t.payment_source);
      f.status = select([['booked', 'Booked'], ['flown', 'Flown'], ['cancelled', 'Cancelled']], t.status);
      f.price = input('number', t.price_amount, {min: 0, step: '0.01'}); f.cur = select(CURRENCIES.map(c => [c, c]), t.price_currency);
      f.sur = input('number', t.business_surcharge_amount, {min: 0, step: '0.01'});
      fs.append(dl, lbl('Purchase date (exchange rate day)', f.purchase), lbl('Outbound', f.out), lbl('Return', f.back), lbl('From (IATA)', f.from), lbl('To (IATA)', f.to),
        lbl('Cabin', f.cabin), lbl('Paid by', f.source), lbl('Status', f.status), lbl('Price (original currency)', f.price), lbl('Currency', f.cur), lbl('Business surcharge', f.sur));
    }
    f.notes = input('text', t.notes, {maxLength: 200}); fs.append(lbl('Notes', f.notes, true));
    const preview = mk('div', 'en-note en-wide'); fs.append(preview);
    const read = () => summary ? Object.assign({}, t, {person_id: f.person.value, count: Number(f.count.value), year: f.month.value ? Number(f.month.value.slice(0, 4)) : Number(f.year.value), outbound_date: f.month.value ? f.month.value + '-01' : null, notes: f.notes.value.trim()}) :
      Object.assign({}, t, {person_id: f.person.value, purchase_date: f.purchase.value, outbound_date: f.out.value, return_date: f.back.value,
        from: f.from.value.trim().toUpperCase(), to: f.to.value.trim().toUpperCase(), cabin: f.cabin.value, payment_source: f.source.value, status: f.status.value,
        price_amount: f.price.value === '' ? NaN : Number(f.price.value), price_currency: f.cur.value, business_surcharge_amount: Number(f.sur.value || 0), notes: f.notes.value.trim()});
    const upd = () => {
      if (summary) {preview.textContent = ''; return;}
      const c = cost(read());
      preview.textContent = c.totalCzk == null ? (c.problems[0] ? (S.mode === 'live' && /exchange rate/.test(c.problems[0]) ? 'The exchange rate of the purchase date will be fetched from the Czech National Bank when you save.' : '⚠ ' + c.problems[0]) : '') :
        'Total ' + money(c.totalPhp, 'PHP') + ' · ' + money(c.totalCzk, 'CZK') + (c.level === 'over' ? ' → deduction ' + money(c.overPhp, 'PHP') + ' (' + money(c.overCzk, 'CZK') + ')' : c.level === 'ok' ? ' · within limit' : '');
    };
    form.addEventListener('input', upd); form.addEventListener('change', upd); upd();
    form.addEventListener('submit', async e => {
      e.preventDefault(); const v = read(); const err = validate(v);
      if (err) return say(err, 'error');
      const ok = await perform(async () => {
        await store.saveTicket(v);
        S.editing = '';
        if (v.status === 'summary') return '';
        try {return await store.ensureRates(v.purchase_date, [v.price_currency]);}
        catch (e2) {console.error('Entitlement rates', e2); return 'Ticket saved, but the CNB exchange rate could not be fetched (' + (e2 && e2.message || e2) + '). Add it manually in Rules.';}
      }, savedMsg());
    });
    const actions = mk('div', 'en-actions'); const save = mk('button', 'en-btn en-primary', 'Save'); save.type = 'submit';
    actions.append(save, btn('Cancel', '', () => {S.editing = ''; S.renderList();}));
    if (t.id) actions.append(btn('Delete', 'en-danger', () => {if (confirm('Delete this record?')) perform(async () => {await store.deleteTicket(t.id); S.editing = ''; return '';}, 'Deleted.');}));
    fs.append(actions); form.append(fs); return form;
  }
  function validate(v) {
    if (v.status === 'summary') return (!Number.isInteger(v.count) || v.count < 0) ? 'Tickets used must be a whole number.' : (!v.year ? 'Year is required.' : '');
    if (!/^[A-Z]{3}$/.test(v.from) || !/^[A-Z]{3}$/.test(v.to)) return 'Airports must be 3-letter IATA codes (e.g. MNL).';
    if (!v.outbound_date) return 'Outbound date is required.';
    if (v.return_date && v.return_date < v.outbound_date) return 'Return date cannot be before the outbound date.';
    if (!isFinite(v.price_amount) || v.price_amount < 0) return 'Enter the ticket price (0 or more).';
    if (v.business_surcharge_amount < 0) return 'Surcharge cannot be negative.';
    if (!v.purchase_date) return 'Purchase date is required (the exchange rate and limit are taken from this day).';
    return '';
  }

  /* ---------- Rules ---------- */
  function simpleForm(fields, onSave, label) {
    const form = mk('form', 'en-form'); const ctl = {};
    for (const [key, text, el] of fields) {ctl[key] = el; form.append(lbl(text, el));}
    const b = mk('button', 'en-btn en-primary', label); b.type = 'submit'; form.append(b);
    form.addEventListener('submit', async e => {
      e.preventDefault(); const r = await onSave(ctl);
      if (typeof r === 'string' && r) say(r, 'error'); else if (typeof r === 'function') await perform(r, savedMsg());
    });
    return form;
  }
  function renderRules(box) {
    box.append(mk('p', 'en-note', 'Rules are editable. The limit and exchange rate used for a ticket are those valid on its purchase date. The entitlement is one shared pool for the whole family.'));
    // limit
    let sec = mk('div', 'en-section'); sec.append(mk('h3', null, 'Price limit per return ticket'));
    const lt = mk('table', 'en-table'); lt.innerHTML = '<tr><th>Valid from</th><th>Valid to</th><th>Limit</th><th></th></tr>';
    for (const l of S.limits.slice().sort((a, b) => a.valid_from.localeCompare(b.valid_from))) {
      const tr = document.createElement('tr');
      for (const v of [date(l.valid_from), l.valid_to ? date(l.valid_to) : 'open-ended', money(l.amount, l.currency)]) tr.append(Object.assign(document.createElement('td'), {textContent: v}));
      const td = document.createElement('td'); td.append(btn('Delete', 'en-danger', () => {if (confirm('Delete this limit?')) perform(async () => {await store.deleteLimit(l.id); return '';}, 'Deleted.');})); tr.append(td); lt.append(tr);
    }
    sec.append(lt, simpleForm([['from', 'Valid from', input('date', '')], ['to', 'Valid to (optional)', input('date', '')], ['amt', 'Limit', input('number', '', {min: 0, step: '0.01'})], ['cur', 'Currency', select(CURRENCIES.map(c => [c, c]), 'CZK')]],
      c => {if (!c.from.value || c.amt.value === '') return 'Valid from and the limit are required.'; if (c.to.value && c.to.value < c.from.value) return 'Valid to is before valid from.';
        const row = {valid_from: c.from.value, valid_to: c.to.value || null, amount: Number(c.amt.value), currency: c.cur.value}; return async () => {await store.addLimit(row); return '';};}, 'Add limit'));
    box.append(sec);
    // grants
    sec = mk('div', 'en-section'); sec.append(mk('h3', null, 'Entitlement grants (whole family)'));
    sec.append(mk('p', 'en-note', 'Enter the total number of return tickets for the family, e.g. 4 people × 2 tickets = 8. Remaining = all grants − tickets used.'));
    const gt = mk('table', 'en-table'); gt.innerHTML = '<tr><th>Period</th><th>Tickets</th><th>Reason</th><th>Note</th><th></th></tr>';
    for (const g of S.grants.slice().sort((a, b) => a.valid_from.localeCompare(b.valid_from))) {
      const tr = document.createElement('tr');
      for (const v of [date(g.valid_from) + ' – ' + date(g.valid_to), g.tickets, g.reason, g.source_note || '']) tr.append(Object.assign(document.createElement('td'), {textContent: v}));
      const td = document.createElement('td'); td.append(btn('Delete', 'en-danger', () => {if (confirm('Delete this grant?')) perform(async () => {await store.deleteGrant(g.id); return '';}, 'Deleted.');})); tr.append(td); gt.append(tr);
    }
    sec.append(gt, simpleForm([['from', 'Valid from', input('date', '')], ['to', 'Valid to', input('date', '')],
      ['n', 'Tickets (family total)', input('number', 8, {min: 1, step: 1})], ['r', 'Reason', select([['Base entitlement', 'Base entitlement'], ['Contract extension', 'Contract extension'], ['Claimed retroactively', 'Claimed retroactively']], 'Contract extension')], ['o', 'Note', input('text', '', {maxLength: 120})]],
      c => {if (!c.from.value || !c.to.value || !(Number(c.n.value) >= 1)) return 'Period and number of tickets are required.'; if (c.to.value < c.from.value) return 'Valid to is before valid from.';
        const row = {valid_from: c.from.value, valid_to: c.to.value, tickets: Number(c.n.value), reason: c.r.value, source_note: c.o.value.trim()}; return async () => {await store.addGrant(row); return '';};}, 'Add grant'));
    box.append(sec);
    // rates
    sec = mk('div', 'en-section'); sec.append(mk('h3', null, 'Exchange rates (CZK per 1 unit)'));
    sec.append(mk('p', 'en-note', S.mode === 'demo' ? 'Demo rates are made up.' : 'Rates come from the Czech National Bank (daily rate of the ticket purchase date) and are fetched automatically when you save a ticket. You can also enter a rate manually.'));
    const rt = mk('table', 'en-table'); rt.innerHTML = '<tr><th>Date</th><th>PHP</th><th>EUR</th><th>USD</th><th>GBP</th></tr>';
    for (const d of [...new Set(S.rates.map(r => r.date))].sort().reverse().slice(0, 40)) {
      const tr = document.createElement('tr'); tr.append(Object.assign(document.createElement('td'), {textContent: date(d)}));
      for (const c of ['PHP', 'EUR', 'USD', 'GBP']) {const r = S.rates.find(x => x.date === d && x.currency === c); tr.append(Object.assign(document.createElement('td'), {textContent: r ? r.czk_per_unit : '—'}));}
      rt.append(tr);
    }
    sec.append(rt, simpleForm([['d', 'Date', input('date', '')], ['c', 'Currency', select(CURRENCIES.filter(c => c !== 'CZK').map(c => [c, c]), 'PHP')], ['r', 'CZK per 1 unit', input('number', '', {min: 0, step: 'any'})]],
      c => {if (!c.d.value || !(Number(c.r.value) > 0)) return 'Date and a positive rate are required.'; const row = {rate_date: c.d.value, currency: c.c.value, czk_per_unit: Number(c.r.value), source: 'manual'}; return async () => {await store.addRate(row); return '';};}, 'Add / replace rate'));
    box.append(sec);
  }

  /* ---------- Export ---------- */
  function ticketRows() {
    const rows = [['Traveller', 'Status', 'Outbound', 'Return', 'From', 'To', 'Cabin', 'Paid by', 'Purchase date', 'Price', 'Currency', 'Business surcharge', 'Total CZK', 'Total PHP', 'Limit CZK', 'Deduction CZK', 'Deduction PHP', 'Notes']];
    for (const t of S.tickets.slice().sort((a, b) => (a.outbound_date || '').localeCompare(b.outbound_date || ''))) {
      if (t.status === 'summary') {rows.push(['', 'summary (' + t.year + ')', '', '', '', '', '', SRC[t.payment_source], '', '', '', '', '', '', '', '', '', t.count + ' tickets used; ' + t.notes]); continue;}
      const c = cost(t); const r = x => x == null ? '' : Math.round(x);
      rows.push([pname(t.person_id), t.status, t.outbound_date, t.return_date, t.from, t.to, t.cabin, SRC[t.payment_source], t.purchase_date, t.price_amount, t.price_currency, t.business_surcharge_amount,
        r(c.totalCzk), r(c.totalPhp), r(c.limitCzk), r(c.overCzk), r(c.overPhp), t.notes]);
    }
    return rows;
  }
  function download(name, rows) {
    const blob = new Blob(['﻿' + C.toCsv(rows)], {type: 'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  /* Přehled pro zaměstnavatele ve tvaru jeho tabulky: bloky po letech, osoby, měsíce, Tickets / Used / Remaining. */
  const hrReport = () => C.hrReport(S.people, S.grants, S.tickets, today());
  function hrRows(rep) {
    const rows = [];
    for (const b of rep.blocks) {
      rows.push(['Ticketing transactions ' + b.year], ['Name', ...MONTHS, 'Tickets', 'Used', 'Remaining']);
      for (const r of b.rows) rows.push([r.name, ...r.months.map(m => m || ''), r.tickets, r.used, r.remaining]);
      rows.push([]);
    }
    rows.push(['Remaining tickets as of ' + date(today())], ['Name', 'Remaining']);
    for (const r of rep.remainingNow) rows.push([r.name, r.remaining]);
    rows.push(['Total', rep.totalRemaining]);
    return rows;
  }
  function hrBlockEl(b) {
    const t = document.createElement('table'); t.className = 'en-table en-hr';
    const cap = document.createElement('caption'); cap.textContent = 'Ticketing transactions ' + b.year; t.append(cap);
    const head = document.createElement('tr');
    for (const h of ['Name', ...MONTHS, 'Tickets', 'Used', 'Remaining']) head.append(Object.assign(document.createElement('th'), {textContent: h}));
    t.append(head);
    for (const r of b.rows) {
      const tr = document.createElement('tr');
      tr.append(Object.assign(document.createElement('td'), {textContent: r.name, className: 'en-hr-name'}));
      for (const m of r.months) tr.append(Object.assign(document.createElement('td'), {textContent: m || '', className: 'en-hr-m'}));
      tr.append(Object.assign(document.createElement('td'), {textContent: r.tickets, className: 'en-hr-n'}), Object.assign(document.createElement('td'), {textContent: r.used, className: 'en-hr-n'}),
        Object.assign(document.createElement('td'), {textContent: r.remaining, className: 'en-hr-n en-hr-rem ' + (r.remaining <= 0 ? 'en-r0' : r.remaining <= 1 ? 'en-r1' : 'en-r2')}));
      t.append(tr);
    }
    return t;
  }
  function hrNotes(rep) {
    const out = [];
    for (const b of rep.blocks) {
      const u = b.rows.map(r => r.unmonthed).filter(Boolean);
      if (!u.length) continue;
      const same = u.every(x => x === u[0]) && u.length === b.rows.length;
      out.push('* ' + b.year + ': ' + (same ? u[0] + ' ticket' + (u[0] === 1 ? '' : 's') + ' per person' : b.unmonthed + ' ticket' + (b.unmonthed === 1 ? '' : 's') + ' in total') + ' without a month (e.g. claimed retroactively for earlier years) are included in Used.');
    }
    out.push('Entitlement granted to the family is divided equally between the ' + S.people.length + ' people. Tickets = remaining from the previous year + new entitlement of the year.');
    if (rep.unassigned) out.push('⚠ ' + rep.unassigned + ' used ticket' + (rep.unassigned === 1 ? ' is' : 's are') + ' not assigned to a person and not shown in the table.');
    return out;
  }
  function confirmEl(rep) {
    const t = document.createElement('table'); t.className = 'en-table en-confirm';
    const head = document.createElement('tr'); for (const h of ['Name', 'Remaining tickets']) head.append(Object.assign(document.createElement('th'), {textContent: h})); t.append(head);
    for (const r of rep.remainingNow) {const tr = document.createElement('tr'); tr.append(Object.assign(document.createElement('td'), {textContent: r.name}), Object.assign(document.createElement('td'), {textContent: r.remaining, className: 'en-hr-n'})); t.append(tr);}
    const tr = document.createElement('tr'); tr.className = 'en-total'; tr.append(Object.assign(document.createElement('td'), {textContent: 'Total'}), Object.assign(document.createElement('td'), {textContent: rep.totalRemaining, className: 'en-hr-n'})); t.append(tr);
    return t;
  }
  function download(name, rows) {
    const blob = new Blob(['\ufeff' + C.toCsv(rows)], {type: 'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function printView() {
    document.getElementById('en-print')?.remove();
    const rep = hrReport(), host = mk('div', 'en-print-host'); host.id = 'en-print';
    host.append(mk('h1', null, 'Home leave tickets – overview for confirmation'), mk('p', null, 'Status as of ' + date(today()) + (S.mode === 'demo' ? ' (demo data)' : '')),
      mk('h2', null, 'Remaining tickets'), confirmEl(rep), mk('p', null, 'Please confirm that the remaining tickets above match your records.'));
    for (const b of rep.blocks) host.append(hrBlockEl(b));
    for (const n of hrNotes(rep)) host.append(mk('p', 'en-fn', n));
    document.body.append(host); document.body.classList.add('en-printing');
    const done = () => {document.body.classList.remove('en-printing'); host.remove(); window.removeEventListener('afterprint', done);};
    window.addEventListener('afterprint', done); window.print();
  }
  function renderExport(box) {
    const rep = hrReport();
    box.append(mk('h3', null, 'Overview for the employer – please confirm'));
    box.append(mk('p', 'en-note', 'Same layout as the employer\'s own table: one block per year, months of departure, Tickets (available) / Used / Remaining. Send it, and ask only for a confirmation that the remaining tickets are correct.'));
    const s = mk('div', 'en-section');
    s.append(btn('Print / save as PDF', 'en-primary', printView), document.createTextNode(' '),
      btn('Download table (CSV)', '', () => download('entitlement-overview.csv', hrRows(rep))), document.createTextNode(' '),
      btn('Download ticket details (CSV)', '', () => download('entitlement-tickets.csv', ticketRows())));
    box.append(s);
    const conf = mk('div', 'en-section'); conf.append(mk('h3', null, 'Remaining tickets as of ' + date(today())), confirmEl(rep),
      mk('p', 'en-note', 'To confirm: the remaining tickets above match the employer\'s records.'));
    box.append(conf);
    for (const b of rep.blocks) {const w = mk('div', 'en-section'); w.append(hrBlockEl(b)); box.append(w);}
    for (const n of hrNotes(rep)) box.append(mk('p', 'en-note', n));
  }

  /* ---------- kostra ---------- */
  function render() {
    const body = S.root.querySelector('.en-body'); body.textContent = '';
    S.root.querySelectorAll('.en-sub button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sub === S.sub)));
    ({summary: renderSummary, tickets: renderTickets, rules: renderRules, export: renderExport}[S.sub])(body);
  }
  function setSub(sub, push) {
    S.sub = sub; S.editing = ''; render();
    if (push && history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#entitlement/' + sub);
  }
  function build() {
    const root = mk('section', 'en-view'); root.id = 'entitlement-view'; root.hidden = true; root.setAttribute('aria-label', 'Flight entitlement');
    const sub = mk('nav', 'en-sub');
    for (const [k, l] of [['summary', 'Summary'], ['tickets', 'Tickets'], ['rules', 'Rules'], ['export', 'HR report']]) {
      const b = mk('button', null, l); b.type = 'button'; b.dataset.sub = k; b.addEventListener('click', () => setSub(k, true)); sub.append(b);
    }
    root.append(sub, mk('div', 'en-msg'), mk('div', 'en-body')); root.querySelector('.en-msg').hidden = true;
    const anchor = document.getElementById('flights-view'); anchor.parentNode.insertBefore(root, anchor.nextSibling);
    S.root = root;
  }
  const link = document.createElement('link'); link.rel = 'stylesheet';
  const me = document.currentScript; const ver = me && me.src.includes('?') ? me.src.slice(me.src.indexOf('?')) : '';
  link.href = 'entitlement.css' + ver; document.head.append(link);

  async function start(mode, db) {
    if (S.started) return; S.started = true;
    S.mode = mode; S.db = db || null;
    if (mode === 'demo') Object.assign(S, demoData());
    RodinneCestyFlights.addTab('entitlement', 'Flight entitlement');
    build();
    document.addEventListener('rc-tab', e => {S.root.hidden = e.detail !== 'entitlement';});
    const m = location.hash.match(/^#entitlement\/(summary|tickets|rules|export)$/); if (m) S.sub = m[1];
    if (mode === 'live') {
      S.root.querySelector('.en-body').textContent = 'Loading…';
      try {await store.load();}
      catch (e) {console.error('Entitlement', e); render(); say('Could not load the entitlement data: ' + (e && e.message || e), 'error'); S.loadFailed = true;}
    }
    render();
    if (location.hash.startsWith('#entitlement')) RodinneCestyFlights.showTab('entitlement', false);
  }
  window.RodinneCestyEntitlement = {mount: db => start('live', db)};
  if (DEMO) start('demo');
})();
