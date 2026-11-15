/* Rodinné cesty – záložka „Lety“: přehled všech letů s filtry a úpravou přímo v řádku.
   V kódu nejsou žádné soukromé údaje; ostrá data se načítají z chráněného Supabase.
   V režimu ?demo běží nad smyšlenými lety v paměti prohlížeče. */
(function () {
  'use strict';
  const S = {mode:null, db:null, refresh:null, people:[], locations:[], flights:[], editing:'', busy:false,
    filters:{q:'',person:'',year:'',status:''}, root:null, tabs:null, ready:false};
  const mk = (tag,cls,content) => {const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
  const check = res => {if(res.error)throw res.error;return res.data||[];};
  const fmt = d => d ? d.split('-').reverse().join('. ') : 'datum chybí';
  const airports = () => (typeof AIRPORTS !== 'undefined' ? AIRPORTS : []);
  const MAP_PARTS = ['.workspace','.timeline','.info-grid','#live-tools'];

  /* ---------- data ---------- */
  const DEMO_PEOPLE = [{id:'a',display_name:'Alex'},{id:'b',display_name:'Bára'},{id:'c',display_name:'Cyril'},{id:'d',display_name:'Dana'}];
  let demoSeq = 100;
  function demoData() {
    const loc = (iata) => {const a=airports().find(x=>x.iata===iata);return {id:'loc-'+iata,name:a.name,country_iso2:a.country,iata_code:a.iata,latitude:a.lat,longitude:a.lon};};
    const locations = ['MNL','BKK','SIN','NRT','PRG'].map(loc);
    locations.push({id:'loc-city',name:'Neznámé město (letiště neověřeno)',country_iso2:'PH',iata_code:null,latitude:null,longitude:null});
    const f = (id,from,to,date,verification,people,number,title) => ({id,trip_id:'t'+id,trip_title:title,from_id:from,to_id:to,date,flight_number:number||'',verification,people});
    return {people:DEMO_PEOPLE, locations, flights:[
      f('1','loc-MNL','loc-BKK','2024-03-02','verified',['a','b','c','d'],'','Ukázka · Bangkok'),
      f('2','loc-BKK','loc-MNL','2024-03-09','verified',['a','b','c','d'],'','Ukázka · Bangkok'),
      f('3','loc-MNL','loc-SIN','2025-01-18','verified',['a','b'],'','Ukázka · Singapur'),
      f('4','loc-MNL','loc-NRT','2025-10-04','proposed',['a','c'],'','Ukázka · Tokio'),
      f('5','loc-city','loc-PRG',null,'proposed',['a'],'','Ukázka · Návrat domů')]};
  }
  async function loadLive() {
    const [people,legs,locations,legPeople,trips] = await Promise.all(
      ['travel_people','travel_legs','travel_locations','travel_leg_people','travel_trips'].map(t=>S.db.from(t).select('*')));
    const title = new Map(check(trips).map(t=>[t.id,t.title]));
    const who = new Map();
    for(const r of check(legPeople)) {if(r.presence!=='confirmed'&&r.presence!=='planned')continue;(who.get(r.leg_id)||who.set(r.leg_id,[]).get(r.leg_id)).push(r.person_id);}
    return {people:check(people), locations:check(locations), flights:check(legs).filter(l=>l.mode==='flight').map(l=>({
      id:l.id,trip_id:l.trip_id,trip_title:title.get(l.trip_id)||'',from_id:l.from_location_id||'',to_id:l.to_location_id||'',
      date:l.departure_date||null,flight_number:l.flight_number||'',verification:l.verification,people:who.get(l.id)||[]}))};
  }
  async function load() {
    const d = S.mode==='demo' ? (S.demoStore||(S.demoStore=demoData())) : await loadLive();
    S.people=d.people;S.locations=d.locations;S.flights=d.flights;
  }

  /* ---------- pomocné ---------- */
  const place = id => S.locations.find(l=>l.id===id);
  const placeName = id => place(id)?.name||'místo neuvedeno';
  const personName = id => S.people.find(p=>p.id===id)?.display_name||'?';
  function problems(fl) {
    const bad=[],soft=[];
    if(!fl.date)bad.push('chybí datum');
    if(!fl.from_id||!fl.to_id)bad.push('chybí letiště');
    else if([fl.from_id,fl.to_id].some(i=>place(i)?.latitude==null))bad.push('chybí poloha na mapě');
    if(!fl.people.length)bad.push('bez osob');
    if(fl.verification!=='verified')soft.push('k ověření');
    return {bad,soft,level:bad.length?'bad':soft.length?'warn':'ok'};
  }
  function visible() {
    const f=S.filters,q=f.q.trim().toLocaleLowerCase('cs');
    return S.flights.filter(fl=>{
      const p=problems(fl);
      if(f.person&&!fl.people.includes(f.person))return false;
      if(f.year&&(fl.date||'').slice(0,4)!==f.year)return false;
      if(f.status&&p.level!==f.status)return false;
      if(q){const hay=[placeName(fl.from_id),placeName(fl.to_id),fl.trip_title,fl.flight_number,place(fl.from_id)?.iata_code,place(fl.to_id)?.iata_code,...fl.people.map(personName)].join(' ').toLocaleLowerCase('cs');if(!hay.includes(q))return false;}
      return true;
    }).sort((a,b)=>{if(!a.date&&b.date)return -1;if(a.date&&!b.date)return 1;return (b.date||'').localeCompare(a.date||'');});
  }
  function say(msg,kind){const box=S.root.querySelector('.fl-msg');box.textContent=msg||'';box.hidden=!msg;box.dataset.kind=kind||'info';}

  /* ---------- vykreslení ---------- */
  function placeSelect(selected) {
    const s=document.createElement('select');s.append(new Option('— neuvedeno —',''));
    for(const l of S.locations.slice().sort((a,b)=>a.name.localeCompare(b.name,'cs')))
      s.append(new Option(l.name+(l.latitude==null?' – bez polohy':''),l.id));
    const group=document.createElement('optgroup');group.label='Letiště (hotový seznam s polohou)';
    for(const a of airports().slice().sort((x,y)=>x.name.localeCompare(y.name,'cs')))
      if(!S.locations.some(l=>l.iata_code===a.iata))group.append(new Option(a.name+' ('+a.iata+')','ap:'+a.iata));
    if(group.children.length)s.append(group);
    s.value=selected||'';return s;
  }
  function lbl(text,control){const l=mk('label','fl-field');l.append(mk('span',null,text),control);return l;}
  function editor(fl) {
    const form=mk('form','fl-form');
    const from=placeSelect(fl.from_id),to=placeSelect(fl.to_id);
    const date=document.createElement('input');date.type='date';date.value=fl.date||'';
    const num=document.createElement('input');num.type='text';num.maxLength=60;num.value=fl.flight_number||'';num.placeholder='jen pokud znáte';
    const ver=document.createElement('select');ver.append(new Option('K ověření','proposed'),new Option('Ověřeno','verified'));ver.value=fl.verification==='verified'?'verified':'proposed';
    const who=mk('fieldset','fl-people');who.append(mk('legend',null,'Kdo letěl'));
    for(const p of S.people.filter(p=>p.active!==false)){const l=mk('label','fl-person');const c=document.createElement('input');c.type='checkbox';c.value=p.id;c.checked=fl.people.includes(p.id);l.append(c,document.createTextNode(' '+p.display_name));who.append(l);}
    const actions=mk('div','fl-actions');
    const save=mk('button','fl-btn fl-primary','Uložit');save.type='submit';
    const cancel=mk('button','fl-btn','Zrušit');cancel.type='button';cancel.addEventListener('click',()=>{S.editing='';render();});
    const del=mk('button','fl-btn fl-danger','Smazat let');del.type='button';del.addEventListener('click',()=>removeFlight(fl));
    actions.append(save,cancel,del);
    form.append(lbl('Odkud',from),lbl('Kam',to),lbl('Datum odletu',date),lbl('Číslo letu',num),lbl('Jistota',ver),who,actions);
    form.addEventListener('submit',ev=>{ev.preventDefault();saveFlight(fl,{from:from.value,to:to.value,date:date.value,number:num.value.trim(),verification:ver.value,people:[...who.querySelectorAll('input:checked')].map(x=>x.value)});});
    return form;
  }
  function card(fl) {
    const p=problems(fl),el=mk('article','fl-card fl-'+p.level);
    const head=mk('div','fl-head');
    const route=mk('strong','fl-route',placeName(fl.from_id)+' → '+placeName(fl.to_id));
    const badge=mk('span','fl-badge fl-b-'+p.level,p.level==='ok'?'ověřeno':p.level==='warn'?'k ověření':'k dořešení');
    head.append(route,badge);
    const meta=mk('div','fl-meta');
    meta.append(mk('span',null,fmt(fl.date)),mk('span',null,fl.people.length?fl.people.map(personName).join(', '):'bez osob'));
    if(fl.flight_number)meta.append(mk('span',null,'let '+fl.flight_number));
    if(fl.trip_title)meta.append(mk('span','fl-trip',fl.trip_title));
    el.append(head,meta);
    const notes=[...p.bad,...(p.level==='bad'&&p.soft.length?p.soft:[])];
    if(notes.length)el.append(mk('div','fl-notes',notes.join(' · ')));
    if(S.editing===fl.id)el.append(editor(fl));
    else{const b=mk('button','fl-btn','Upravit');b.type='button';b.addEventListener('click',()=>{S.editing=fl.id;render();});el.append(b);}
    return el;
  }
  function render() {
    if(!S.root)return;
    const years=[...new Set(S.flights.map(f=>(f.date||'').slice(0,4)).filter(Boolean))].sort().reverse();
    const yearSel=S.root.querySelector('.fl-year'),personSel=S.root.querySelector('.fl-person-filter');
    yearSel.replaceChildren(new Option('Všechny roky',''),...years.map(y=>new Option(y,y)));yearSel.value=years.includes(S.filters.year)?S.filters.year:'';S.filters.year=yearSel.value;
    personSel.replaceChildren(new Option('Všichni',''),...S.people.filter(p=>p.active!==false).map(p=>new Option(p.display_name,p.id)));personSel.value=S.people.some(p=>p.id===S.filters.person)?S.filters.person:'';S.filters.person=personSel.value;
    const list=S.root.querySelector('.fl-list'),rows=visible();list.replaceChildren();
    const total=S.flights.length,todo=S.flights.filter(f=>problems(f).level!=='ok').length;
    S.root.querySelector('.fl-count').textContent='Zobrazeno '+rows.length+' z '+total+' letů · k dořešení nebo ověření: '+todo;
    if(!rows.length)list.append(mk('p','fl-empty',total?'Žádný let neodpovídá filtru.':'Zatím žádné lety. Přidáte je v editoru cest nebo ve formuláři návštěvy.'));
    for(const fl of rows)list.append(card(fl));
  }

  /* ---------- ukládání ---------- */
  async function resolveAirport(value) {
    if(!value.startsWith('ap:'))return value||null;
    const a=airports().find(x=>x.iata===value.slice(3));if(!a)throw new Error('Neznámé letiště.');
    const known=S.locations.find(l=>l.iata_code===a.iata);if(known)return known.id;
    if(S.mode==='demo'){const row={id:'loc-'+a.iata,name:a.name,country_iso2:a.country,iata_code:a.iata,latitude:a.lat,longitude:a.lon};S.locations.push(row);return row.id;}
    const row=check(await S.db.from('travel_locations').insert({name:a.name,country_iso2:a.country,iata_code:a.iata,latitude:a.lat,longitude:a.lon}).select('*').single());
    S.locations.push(row);return row.id;
  }
  async function saveFlight(fl,v) {
    if(S.busy)return;
    if(v.date&&!/^\d{4}-\d{2}-\d{2}$/.test(v.date)){say('Neplatné datum.','error');return;}
    if(v.from&&v.from===v.to){say('Odlet a přílet nesmí být stejné místo.','error');return;}
    if(v.verification==='verified'&&(!v.date||!v.from||!v.to||!v.people.length)){say('Ověřený let potřebuje datum, obě místa a alespoň jednu osobu. Jinak ho nechte „k ověření“.','error');return;}
    S.busy=true;say('Ukládám…');
    try{
      const from_id=await resolveAirport(v.from),to_id=await resolveAirport(v.to);
      if(S.mode==='demo'){Object.assign(fl,{from_id:from_id||'',to_id:to_id||'',date:v.date||null,flight_number:v.number,verification:v.verification,people:v.people});}
      else{
        check(await S.db.from('travel_legs').update({from_location_id:from_id,to_location_id:to_id,departure_date:v.date||null,flight_number:v.number||null,verification:v.verification}).eq('id',fl.id));
        check(await S.db.from('travel_leg_people').delete().eq('leg_id',fl.id));
        if(v.people.length)check(await S.db.from('travel_leg_people').insert(v.people.map(person_id=>({leg_id:fl.id,person_id,presence:v.verification==='verified'?'confirmed':'planned'}))));
      }
      S.editing='';
      if(S.mode==='live'){await load();if(S.refresh)await S.refresh();}
      render();say('Let je uložený.','success');
    }catch(e){console.error('Lety',e);say('Uložení selhalo: '+(e?.message||e),'error');}
    finally{S.busy=false;}
  }
  async function removeFlight(fl) {
    if(S.busy)return;
    if(!confirm('Opravdu smazat tento let ('+placeName(fl.from_id)+' → '+placeName(fl.to_id)+')? Cestu ani pobyt to nesmaže.'))return;
    S.busy=true;say('Mažu…');
    try{
      if(S.mode==='demo')S.flights.splice(S.flights.indexOf(fl),1);
      else{check(await S.db.from('travel_legs').delete().eq('id',fl.id));await load();if(S.refresh)await S.refresh();}
      S.editing='';render();say('Let je smazaný.','success');
    }catch(e){console.error('Lety',e);say('Smazání selhalo: '+(e?.message||e),'error');}
    finally{S.busy=false;}
  }

  /* ---------- záložky ---------- */
  function showTab(name,push) {
    const flights=name==='lety';
    for(const sel of MAP_PARTS)document.querySelectorAll(sel).forEach(el=>{if(flights)el.dataset.flHidden='1';else delete el.dataset.flHidden;});
    S.root.hidden=!flights;
    S.tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===name)));
    if(push&&history.replaceState)history.replaceState(null,'',location.pathname+location.search+(flights?'#lety':location.hash==='#lety'?'':location.hash));
  }
  function build() {
    const style=document.createElement('style');
    style.textContent='[data-fl-hidden]{display:none!important}.fl-tabs{display:flex;gap:8px;margin:6px 0 14px}.fl-tab{background:#173246;color:#d1e0e9;border:1px solid #36566a;border-radius:20px;padding:9px 18px;font-weight:700;font-size:13px}.fl-tab[aria-pressed=true]{background:#1b615f;color:#f2fff8;border-color:#69d3c3}'
    +'.fl-view{margin-top:6px}.fl-view[hidden]{display:none!important}.fl-bar{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:8px;margin-bottom:10px}.fl-bar input,.fl-bar select,.fl-form input,.fl-form select{width:100%;background:#152e40;color:#fff;border:1px solid #426175;border-radius:9px;padding:10px;font:inherit}'
    +'.fl-count{font-size:12px;color:#9fb5c4;margin:0 0 10px}.fl-msg{padding:9px 12px;border-radius:9px;font-size:13px;margin:0 0 10px;background:#173246;border:1px solid #36566a}.fl-msg[hidden]{display:none}.fl-msg[data-kind=error]{background:#3d2328;border-color:#b85b68;color:#ffd5da}.fl-msg[data-kind=success]{background:#173d33;border-color:#4fae8d}'
    +'.fl-list{display:grid;gap:9px}.fl-card{background:#0d2334;border:1px solid #2c495d;border-left:5px solid #4fae8d;border-radius:12px;padding:12px 14px;display:grid;gap:7px}.fl-card.fl-warn{border-left-color:#f0be75}.fl-card.fl-bad{border-left-color:#e0707f}'
    +'.fl-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.fl-route{font-size:15px}.fl-badge{font-size:11px;border-radius:12px;padding:3px 9px;font-weight:700}.fl-b-ok{background:#1a4c3d;color:#b8ffe3}.fl-b-warn{background:#4a3a1c;color:#ffdca0}.fl-b-bad{background:#4d2430;color:#ffc4cd}'
    +'.fl-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#aac0ce}.fl-notes{font-size:12px;color:#ffb8c1}.fl-empty{color:#a8bbc6;font-size:13px}'
    +'.fl-btn{border:1px solid #3d6175;background:#173246;color:#e3f0f6;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;justify-self:start}.fl-primary{background:#2c827a;border-color:#83dfd0;color:#fff;font-weight:700}.fl-danger{border-color:#b85b68;color:#ffc4cd}'
    +'.fl-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:6px;padding-top:10px;border-top:1px solid #2c495d}.fl-field{display:grid;gap:4px;font-size:12px;color:#d4e4ee}.fl-people{grid-column:1/-1;border:1px solid #426175;border-radius:9px;padding:6px 10px}.fl-people legend{font-size:12px;color:#d4e4ee}.fl-person{display:inline-flex;gap:5px;margin-right:14px;font-size:13px;align-items:center}.fl-person input{width:auto}.fl-actions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}'
    +'@media(max-width:650px){.fl-bar{grid-template-columns:1fr 1fr}.fl-bar input{grid-column:1/-1}}';
    document.head.append(style);
    const tabs=mk('nav','fl-tabs');tabs.setAttribute('aria-label','Přepínač zobrazení');
    for(const [key,label] of [['mapa','Mapa a časová osa'],['lety','Lety']]){const b=mk('button','fl-tab',label);b.type='button';b.dataset.tab=key;b.addEventListener('click',()=>showTab(key,true));tabs.append(b);}
    const root=mk('section','fl-view');root.hidden=true;root.id='flights-view';root.setAttribute('aria-label','Přehled letů');
    const bar=mk('div','fl-bar');
    const q=document.createElement('input');q.type='search';q.placeholder='Hledat letiště, cestu, osobu…';q.setAttribute('aria-label','Hledat');q.addEventListener('input',()=>{S.filters.q=q.value;render();});
    const person=mk('select','fl-person-filter');person.setAttribute('aria-label','Osoba');person.addEventListener('change',()=>{S.filters.person=person.value;render();});
    const year=mk('select','fl-year');year.setAttribute('aria-label','Rok');year.addEventListener('change',()=>{S.filters.year=year.value;render();});
    const status=mk('select','fl-status');status.setAttribute('aria-label','Stav');
    status.append(new Option('Všechny stavy',''),new Option('Ověřené a úplné','ok'),new Option('K ověření','warn'),new Option('K dořešení (chybí údaje)','bad'));
    status.addEventListener('change',()=>{S.filters.status=status.value;render();});
    bar.append(q,person,year,status);
    root.append(bar,mk('p','fl-count'),mk('div','fl-msg'),mk('div','fl-list'));
    root.querySelector('.fl-msg').hidden=true;
    const anchor=document.querySelector('.workspace');
    anchor.parentNode.insertBefore(tabs,anchor);anchor.parentNode.insertBefore(root,anchor);
    S.root=root;S.tabs=tabs;
  }
  async function start(mode,db,refresh) {
    S.mode=mode;S.db=db||null;S.refresh=refresh||null;
    if(!S.root)build();
    try{await load();render();}
    catch(e){console.error('Lety',e);render();say('Přehled letů se nepodařilo načíst: '+(e?.message||e),'error');}
    showTab(location.hash==='#lety'?'lety':'mapa',false);
    S.ready=true;
  }
  async function sync() {if(!S.ready||S.busy)return;try{await load();render();}catch(e){console.error('Lety',e);say('Přehled letů se nepodařilo obnovit: '+(e?.message||e),'error');}}
  window.RodinneCestyFlights={mount:(db,refresh)=>start('live',db,refresh),sync};
  if(new URLSearchParams(location.search).has('demo')||location.protocol==='file:')start('demo');
})();
