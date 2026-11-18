/* Rodinné cesty – záložka „Flight entitlement“ (anglicky).
   Zatím jen režim ?demo: smyšlená data v paměti prohlížeče. Skutečná data se po schválení
   napojí na chráněný Supabase (tabulky travel_entitlement_*, travel_tickets).
   Výpočty jsou v entitlement-calc.js. V kódu nejsou žádné soukromé údaje. */
(function () {
  'use strict';
  const C = window.EntitlementCalc;
  const DEMO = new URLSearchParams(location.search).has('demo') || location.protocol === 'file:';
  if (!C || !window.RodinneCestyFlights || !DEMO) return; // živý režim se zapne až po schválení schématu
  const S = {people: [], grants: [], limits: [], rates: [], tickets: [], root: null, sub: 'summary', editing: '',
    filters: {q: '', person: '', year: '', source: '', level: ''}, busy: false};
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
    const tickets = [{id: 's-2023', person_id: '', status: 'summary', count: 30, year: 2023, payment_source: 'benefit',
      notes: 'Earlier years claimed retroactively in one batch (no per-flight detail)'}];
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
      if (S.editing === 'new') list.append(ticketForm({id: '', person_id: S.people[0].id, status: 'booked', payment_source: 'benefit', cabin: 'economy', price_currency: 'PHP', business_surcharge_amount: 0}));
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
    if (t.status === 'summary') head.append(mk('div', 'en-name', t.count + ' tickets · ' + t.year + ' (summary)'));
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
    if (!summary) {f.person = select(personOpts(), t.person_id); fs.append(lbl('Traveller', f.person));}
    if (summary) {
      f.count = input('number', t.count, {min: 0, step: 1}); f.year = input('number', t.year, {min: 2018, max: 2100, step: 1});
      fs.append(lbl('Tickets used', f.count), lbl('Year', f.year));
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
    const read = () => summary ? Object.assign({}, t, {count: Number(f.count.value), year: Number(f.year.value), notes: f.notes.value.trim()}) :
      Object.assign({}, t, {person_id: f.person.value, purchase_date: f.purchase.value, outbound_date: f.out.value, return_date: f.back.value,
        from: f.from.value.trim().toUpperCase(), to: f.to.value.trim().toUpperCase(), cabin: f.cabin.value, payment_source: f.source.value, status: f.status.value,
        price_amount: f.price.value === '' ? NaN : Number(f.price.value), price_currency: f.cur.value, business_surcharge_amount: Number(f.sur.value || 0), notes: f.notes.value.trim()});
    const upd = () => {
      if (summary) {preview.textContent = ''; return;}
      const c = cost(read());
      preview.textContent = c.totalCzk == null ? (c.problems[0] ? '⚠ ' + c.problems[0] : '') :
        'Total ' + money(c.totalPhp, 'PHP') + ' · ' + money(c.totalCzk, 'CZK') + (c.level === 'over' ? ' → deduction ' + money(c.overPhp, 'PHP') + ' (' + money(c.overCzk, 'CZK') + ')' : c.level === 'ok' ? ' · within limit' : '');
    };
    form.addEventListener('input', upd); form.addEventListener('change', upd); upd();
    form.addEventListener('submit', e => {
      e.preventDefault(); const v = read(); const err = validate(v);
      if (err) return say(err, 'error');
      if (!t.id) {v.id = uid(); S.tickets.push(v);} else S.tickets[S.tickets.findIndex(x => x.id === t.id)] = v;
      S.editing = ''; say('Saved (demo data lives only in this browser tab).', 'success'); render();
    });
    const act = mk('div', 'en-actions'); const save = mk('button', 'en-btn en-primary', 'Save'); save.type = 'submit';
    act.append(save, btn('Cancel', '', () => {S.editing = ''; S.renderList();}));
    if (t.id) act.append(btn('Delete', 'en-danger', () => {if (!confirm('Delete this record?')) return; S.tickets.splice(S.tickets.findIndex(x => x.id === t.id), 1); S.editing = ''; say('Deleted.', 'success'); render();}));
    fs.append(act); form.append(fs); return form;
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
    form.addEventListener('submit', e => {e.preventDefault(); const err = onSave(ctl); if (err) say(err, 'error'); else {say('Saved (demo).', 'success'); render();}});
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
      const td = document.createElement('td'); td.append(btn('Delete', 'en-danger', () => {if (confirm('Delete this limit?')) {S.limits.splice(S.limits.indexOf(l), 1); render();}})); tr.append(td); lt.append(tr);
    }
    sec.append(lt, simpleForm([['from', 'Valid from', input('date', '')], ['to', 'Valid to (optional)', input('date', '')], ['amt', 'Limit', input('number', '', {min: 0, step: '0.01'})], ['cur', 'Currency', select(CURRENCIES.map(c => [c, c]), 'CZK')]],
      c => {if (!c.from.value || c.amt.value === '') return 'Valid from and the limit are required.'; if (c.to.value && c.to.value < c.from.value) return 'Valid to is before valid from.';
        S.limits.push({id: uid(), valid_from: c.from.value, valid_to: c.to.value || null, amount: Number(c.amt.value), currency: c.cur.value}); return '';}, 'Add limit'));
    box.append(sec);
    // grants
    sec = mk('div', 'en-section'); sec.append(mk('h3', null, 'Entitlement grants (whole family)'));
    sec.append(mk('p', 'en-note', 'Enter the total number of return tickets for the family, e.g. 4 people × 2 tickets = 8. Remaining = all grants − tickets used.'));
    const gt = mk('table', 'en-table'); gt.innerHTML = '<tr><th>Period</th><th>Tickets</th><th>Reason</th><th>Note</th><th></th></tr>';
    for (const g of S.grants.slice().sort((a, b) => a.valid_from.localeCompare(b.valid_from))) {
      const tr = document.createElement('tr');
      for (const v of [date(g.valid_from) + ' – ' + date(g.valid_to), g.tickets, g.reason, g.source_note || '']) tr.append(Object.assign(document.createElement('td'), {textContent: v}));
      const td = document.createElement('td'); td.append(btn('Delete', 'en-danger', () => {if (confirm('Delete this grant?')) {S.grants.splice(S.grants.indexOf(g), 1); render();}})); tr.append(td); gt.append(tr);
    }
    sec.append(gt, simpleForm([['from', 'Valid from', input('date', '')], ['to', 'Valid to', input('date', '')],
      ['n', 'Tickets (family total)', input('number', 8, {min: 1, step: 1})], ['r', 'Reason', select([['Base entitlement', 'Base entitlement'], ['Contract extension', 'Contract extension'], ['Claimed retroactively', 'Claimed retroactively']], 'Contract extension')], ['o', 'Note', input('text', '', {maxLength: 120})]],
      c => {if (!c.from.value || !c.to.value || !(Number(c.n.value) >= 1)) return 'Period and number of tickets are required.'; if (c.to.value < c.from.value) return 'Valid to is before valid from.';
        S.grants.push({id: uid(), valid_from: c.from.value, valid_to: c.to.value, tickets: Number(c.n.value), reason: c.r.value, source_note: c.o.value.trim()}); return '';}, 'Add grant'));
    box.append(sec);
    // rates
    sec = mk('div', 'en-section'); sec.append(mk('h3', null, 'Exchange rates (CZK per 1 unit)'));
    sec.append(mk('p', 'en-note', 'Demo rates are made up. In the live version the daily rate of the purchase date is stored with each ticket.'));
    const rt = mk('table', 'en-table'); rt.innerHTML = '<tr><th>From date</th><th>PHP</th><th>EUR</th><th>USD</th><th>GBP</th></tr>';
    for (const d of [...new Set(S.rates.map(r => r.date))].sort()) {
      const tr = document.createElement('tr'); tr.append(Object.assign(document.createElement('td'), {textContent: date(d)}));
      for (const c of ['PHP', 'EUR', 'USD', 'GBP']) {const r = S.rates.find(x => x.date === d && x.currency === c); tr.append(Object.assign(document.createElement('td'), {textContent: r ? r.czk_per_unit : '—'}));}
      rt.append(tr);
    }
    sec.append(rt); box.append(sec);
  }

  /* ---------- Export ---------- */
  function summaryRows() {
    const P = C.pool(S.grants, S.tickets), by = C.usedByYear(S.tickets);
    const rows = [['Item', 'Tickets'], ['Granted in total', P.granted], ['Used', P.used], ['Remaining', P.remaining], ['Booked, not flown yet', P.booked], ['', ''], ['Year', 'Used from entitlement']];
    for (const y of Object.keys(by).sort()) rows.push([y, by[y].benefit]);
    return rows;
  }
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
  function printView() {
    document.getElementById('en-print')?.remove();
    const host = mk('div', 'en-print-host'); host.id = 'en-print';
    const table = rows => {const t = document.createElement('table'); rows.forEach((r, i) => {const tr = document.createElement('tr'); r.forEach(v => tr.append(Object.assign(document.createElement(i ? 'td' : 'th'), {textContent: v == null ? '' : v}))); t.append(tr);}); return t;};
    host.append(mk('h1', null, 'Home leave tickets – entitlement overview'), mk('p', null, 'Generated ' + date(new Date().toISOString().slice(0, 10)) + ' (demo data)'),
      mk('h2', null, 'Summary'), table(summaryRows()), mk('h2', null, 'Tickets'), table(ticketRows()));
    document.body.append(host); document.body.classList.add('en-printing');
    const done = () => {document.body.classList.remove('en-printing'); host.remove(); window.removeEventListener('afterprint', done);};
    window.addEventListener('afterprint', done); window.print();
  }
  function renderExport(box) {
    box.append(mk('p', 'en-note', 'For the colleague who keeps the official record. Files are generated in your browser and are not stored anywhere.'));
    const s = mk('div', 'en-section');
    s.append(btn('Download summary (CSV)', 'en-primary', () => download('entitlement-summary.csv', summaryRows())), document.createTextNode(' '),
      btn('Download all tickets (CSV)', 'en-primary', () => download('entitlement-tickets.csv', ticketRows())), document.createTextNode(' '),
      btn('Print / save as PDF', '', printView));
    box.append(s);
    const t = mk('table', 'en-table'); summaryRows().forEach((r, i) => {const tr = document.createElement('tr'); r.forEach(v => tr.append(Object.assign(document.createElement(i ? 'td' : 'th'), {textContent: v}))); t.append(tr);});
    box.append(mk('h3', null, 'Preview – summary'), t);
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
    const d = demoData(); Object.assign(S, d);
    const root = mk('section', 'en-view'); root.id = 'entitlement-view'; root.hidden = true; root.setAttribute('aria-label', 'Flight entitlement');
    const sub = mk('nav', 'en-sub');
    for (const [k, l] of [['summary', 'Summary'], ['tickets', 'Tickets'], ['rules', 'Rules'], ['export', 'Export']]) {
      const b = mk('button', null, l); b.type = 'button'; b.dataset.sub = k; b.addEventListener('click', () => setSub(k, true)); sub.append(b);
    }
    root.append(sub, mk('div', 'en-msg'), mk('div', 'en-body')); root.querySelector('.en-msg').hidden = true;
    const anchor = document.getElementById('flights-view'); anchor.parentNode.insertBefore(root, anchor.nextSibling);
    S.root = root;
  }
  const link = document.createElement('link'); link.rel = 'stylesheet';
  const me = document.currentScript; link.href = 'entitlement.css' + (me && me.src.includes('?') ? me.src.slice(me.src.indexOf('?')) : ''); document.head.append(link);
  RodinneCestyFlights.addTab('entitlement', 'Flight entitlement');
  build();
  document.addEventListener('rc-tab', e => {S.root.hidden = e.detail !== 'entitlement';});
  const m = location.hash.match(/^#entitlement\/(summary|tickets|rules|export)$/); if (m) S.sub = m[1];
  render();
  if (location.hash.startsWith('#entitlement')) RodinneCestyFlights.showTab('entitlement', false);
})();
