/* Rodinné cesty – editor historických cest, hranic a dopravních úseků.
   Žádné soukromé údaje v kódu; všechny hodnoty se načítají z chráněného Supabase. */
(function () {
  'use strict';
  const S = {db:null, refresh:null, travel:null, root:null, trips:[],stops:[],legs:[],locations:[],stopPeople:[],legPeople:[],tripId:''};
  const id = name => document.getElementById('ed-' + name);
  const val = (form,name) => form.elements.namedItem(name).value.trim();
  const text = (el,value) => {el.textContent = value == null ? '' : String(value); return el;};
  const mk = (tag,cls,content) => {const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)text(n,content);return n;};
  const check = res => {if(res.error)throw res.error;return res.data;};
  const today = () => {const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const allCountries = () => [...document.querySelectorAll('#countries [data-iso2]')].map(x=>({code:x.dataset.iso2,name:x.dataset.name||x.dataset.iso2})).filter(x=>/^[A-Z]{2}$/.test(x.code)).sort((a,b)=>a.name.localeCompare(b.name,'cs'));
  const isoNames = () => new Map(allCountries().map(c=>[c.code,c.name]));
  const stamp = date => date||'datum neznámé';
  const fmt = (date) => date ? date.split('-').reverse().join('.') : 'datum neznámé';
  const show = (msg,kind) => {const box=id('status');text(box,msg);box.hidden=!msg;box.dataset.kind=kind||'info';};
  function btn(label,callback,danger){const b=mk('button','ed-button'+(danger?' ed-danger':''),label);b.type='button';b.addEventListener('click',callback);return b;}
  function countries(select,placeholder) {
    select.replaceChildren(new Option(placeholder||'Vyber zemi',''));
    for(const c of allCountries())select.add(new Option(c.name+' ('+c.code+')',c.code));
  }
  function peopleChecklist(target,rows,chosen) {
    target.replaceChildren();
    for(const p of S.travel.people.filter(p=>p.active)) {
      const label=mk('label','ed-person');const box=document.createElement('input');box.type='checkbox';box.value=p.id;box.checked=chosen.has(p.id);
      label.append(box,document.createTextNode(' '+p.display_name));target.append(label);
    }
    if(!target.children.length)target.append(mk('p','empty','Žádné osoby v databázi.'));
  }
  function checked(target){return [...target.querySelectorAll('input:checked')].map(x=>x.value);}
  function field(form,name,value){const input=form.elements.namedItem(name);if(input)input.value=value??'';}
  function currentTrip(){return S.trips.find(t=>t.id===S.tripId);}
  function enabled(on){S.root.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=!on);}
  async function data() {
    const tables=['travel_stops','travel_legs','travel_locations','travel_stop_people','travel_leg_people'];
    const results=await Promise.all(tables.map(t=>S.db.from(t).select('*')));
    const d=results.map(check);[S.stops,S.legs,S.locations,S.stopPeople,S.legPeople]=d;
  }
  function updateChoice() {
    const selection=id('trip-choice'),previous=S.tripId;
    selection.replaceChildren(new Option('Vyber cestu k úpravě…',''));
    const sorted=S.trips.slice().sort((a,b)=>((a.actual_start||a.planned_start||'')<(b.actual_start||b.planned_start||'')?1:-1));
    for(const t of sorted) selection.add(new Option((t.actual_start||t.planned_start||'bez data')+' · '+t.title+' ['+(t.status==='completed'?'uskutečněná':'plán')+']',t.id));
    S.tripId=sorted.some(t=>t.id===previous)?previous:'';
    selection.value=S.tripId;
    editTrip();
  }
  function showRows(target,rows,describe,onEdit,onRemove) {
    target.replaceChildren();
    if(!rows.length){target.append(mk('p','empty','Zatím žádné záznamy.'));return;}
    for(const row of rows) {
      const line=mk('div','ed-record'),summary=mk('div','ed-record-text',describe(row)),actions=mk('div','ed-actions');
      actions.append(btn('Upravit',()=>onEdit(row)),btn('Smazat',()=>onRemove(row),true));
      line.append(summary,actions);target.append(line);
    }
  }
  function resetStop(row) {
    const f=id('stop-form');f.reset();
    field(f,'recordId',row?.id||'');field(f,'country',row?.country_iso2||'');
    field(f,'arrival',row?.arrival_date||'');field(f,'departure',row?.departure_date||'');
    field(f,'precision',row?.date_precision||'exact');field(f,'kind',row?.kind||'stay');
    field(f,'verification',row?.verification||'proposed');field(f,'notes',row?.notes||'');
    const chosen=new Set(S.stopPeople.filter(r=>r.stop_id===row?.id&&r.presence==='confirmed').map(r=>r.person_id));
    peopleChecklist(id('stop-people'),null,chosen);
    text(id('stop-submit'),row?'Uložit změny pobytu':'Přidat pobyt / hranici');
  }
  function resetLeg(row) {
    const f=id('leg-form');f.reset();field(f,'recordId',row?.id||'');
    field(f,'mode',row?.mode||'flight');field(f,'departure',row?.departure_date||'');
    field(f,'arrival',row?.arrival_date||'');field(f,'verification',row?.verification||'proposed');
    field(f,'flight',row?.flight_number||'');field(f,'notes',row?.notes||'');
    for(const end of ['from','to']) {
      const select=f.elements.namedItem(end+'Id');select.replaceChildren(new Option('Místo neznámé',''),new Option('+ Přidat nové místo','__new'));
      for(const place of S.locations.slice().sort((a,b)=>a.name.localeCompare(b.name,'cs')))
        select.add(new Option(place.name+' ('+place.country_iso2+')',place.id));
      if(typeof AIRPORTS!=='undefined'){
        const group=document.createElement('optgroup');group.label='Letiště (hotový seznam s polohou)';
        for(const a of AIRPORTS.slice().sort((x,y)=>x.name.localeCompare(y.name,'cs')))
          if(!S.locations.some(p=>p.iata_code===a.iata))group.append(new Option(a.name+' ('+a.iata+')','ap:'+a.iata));
        if(group.children.length)select.append(group);
      }
      const chosen=row?.[end+'_location_id']||'';
      select.value=S.locations.some(x=>x.id===chosen)?chosen:'';
      f.querySelector('[data-new-place="'+end+'"]').hidden=select.value!=='__new';
    }
    const chosen=new Set(S.legPeople.filter(r=>r.leg_id===row?.id&&r.presence==='confirmed').map(r=>r.person_id));
    peopleChecklist(id('leg-people'),null,chosen);
    text(id('leg-submit'),row?'Uložit změny přesunu':'Přidat let / přesun');
  }
  function editTrip() {
    const panel=id('panel');panel.hidden=!S.tripId;
    const trip=currentTrip();if(!trip)return;
    const f=id('trip-form');field(f,'title',trip.title);field(f,'status',trip.status);
    field(f,'actualStart',trip.actual_start);field(f,'actualEnd',trip.actual_end);
    field(f,'category',trip.category);field(f,'notes',trip.notes);
    resetStop();resetLeg();
    const stops=S.stops.filter(s=>s.trip_id===trip.id).sort((a,b)=>a.stop_order-b.stop_order);
    const countryNames=isoNames();
    showRows(id('stops'),stops,s=>fmt(s.arrival_date)+' · '+(countryNames.get(s.country_iso2)||s.country_iso2)+' · '+(s.kind==='stay'?'pobyt':s.kind==='transit'?'průjezd':'letiště')+' · '+(s.verification==='verified'?'ověřeno':'k ověření'),resetStop,r=>remove('travel_stops',r.id));
    const legs=S.legs.filter(l=>l.trip_id===trip.id).sort((a,b)=>a.leg_order-b.leg_order);
    const loc=x=>S.locations.find(l=>l.id===x)?.name||'místo nezadané';
    const modes={flight:'Letadlo',car:'Auto',train:'Vlak',bus:'Autobus',boat:'Loď',other:'Jiné'};
    showRows(id('legs'),legs,l=>(modes[l.mode]||l.mode)+' · '+loc(l.from_location_id)+' → '+loc(l.to_location_id)+' · '+fmt(l.departure_date)+(l.flight_number?' · '+l.flight_number:'')+' · '+(l.verification==='verified'?'ověřeno':'k ověření'),resetLeg,r=>remove('travel_legs',r.id));
  }
  async function remove(table,rowId) {
    if(!confirm('Opravdu smazat tento záznam? Změna ovlivní i mapu.'))return;
    try{enabled(false);check(await S.db.from(table).delete().eq('id',rowId));await reload();show('Záznam byl smazán.','ok');}
    catch(e){console.error(e);show('Smazání selhalo: '+e.message,'error');}
    finally{enabled(true);}
  }
  async function createTrip() {
    const title=window.prompt('Název nové cesty (například „Výlet do Rakouska autem“)')?.trim();
    if(!title)return;
    if(title.length>180)return show('Název musí mít maximálně 180 znaků.','error');
    try{
      enabled(false);
      const row=check(await S.db.from('travel_trips').insert({title,status:'planned',category:'private'}).select('id').single());
      S.tripId=row.id;await reload();
      show('Cesta byla založena. Přidej pobyty a přesuny a případně ji označ jako uskutečněnou.','ok');
    }catch(e){console.error(e);show('Založení cesty selhalo: '+e.message,'error');}
    finally{enabled(true);}
  }
  async function saveTrip(ev) {
    ev.preventDefault();const f=ev.currentTarget,t=currentTrip();if(!t)return;
    const start=val(f,'actualStart'),end=val(f,'actualEnd'),status=val(f,'status');
    if(!val(f,'title'))return show('Název cesty nesmí být prázdný.','error');
    if(start&&end&&end<start)return show('Datum konce nemůže předcházet začátku.','error');
    if(status==='completed'&&start>today())return show('Budoucí cestu nelze potvrdit jako uskutečněnou.','error');
    try{enabled(false);check(await S.db.from('travel_trips').update({title:val(f,'title'),status,category:val(f,'category'),actual_start:start||null,actual_end:end||null,notes:val(f,'notes'),updated_at:new Date().toISOString()}).eq('id',t.id));
      await reload();show('Základní údaje cesty uloženy.','ok');
    }catch(e){console.error(e);show('Uložení cesty selhalo: '+e.message,'error');}
    finally{enabled(true);}
  }
  async function saveStop(ev) {
    ev.preventDefault();const f=ev.currentTarget,t=currentTrip();if(!t)return;
    const country=val(f,'country'),precision=val(f,'precision'),kind=val(f,'kind'),verification=val(f,'verification');
    let arrival=val(f,'arrival'),departure=val(f,'departure');
    if(!country)return show('Vyber zemi.','error');
    if(precision==='unknown')arrival=null;
    else if(!arrival)return show('Zadej datum nebo zvol „Neznámé datum“.','error');
    else if(precision==='month')arrival=arrival.slice(0,7)+'-01';
    else if(precision==='year')arrival=arrival.slice(0,4)+'-01-01';
    if(departure&&arrival&&departure<arrival)return show('Odjezd nemůže být před příjezdem.','error');
    if(kind==='stay'&&verification==='verified'&&arrival&&arrival>today())return show('Návštěva v budoucnosti zatím nemůže být ověřená.','error');
    const people=checked(id('stop-people')),idExisting=val(f,'recordId');
    if(verification==='verified'&&kind==='stay'&&t.status==='completed'&&!people.length)return show('Pro potvrzený pobyt vyber alespoň jednoho cestujícího.','error');
    try{
      enabled(false);let record=idExisting;
      const payload={country_iso2:country,arrival_date:arrival||null,departure_date:departure||null,date_precision:precision,kind,verification,notes:val(f,'notes')};
      if(record) check(await S.db.from('travel_stops').update(payload).eq('id',record));
      else {let rows=S.stops.filter(x=>x.trip_id===t.id);payload.trip_id=t.id;payload.stop_order=1+Math.max(0,...rows.map(x=>x.stop_order));
        record=check(await S.db.from('travel_stops').insert(payload).select('id').single()).id;}
      check(await S.db.from('travel_stop_people').delete().eq('stop_id',record));
      if(people.length)check(await S.db.from('travel_stop_people').insert(people.map(person_id=>({stop_id:record,person_id,presence:verification==='verified'?'confirmed':'planned'}))));
      await reload();show('Pobyt / hraniční záznam uložen.','ok');
    }catch(e){console.error(e);show('Uložení pobytu selhalo: '+e.message+' (zkontroluj případně související osoby).','error');}
    finally{enabled(true);}
  }
  async function resolvePlace(f,end) {
    const choice=val(f,end+'Id');
    if(choice.startsWith('ap:')){
      const a=(typeof AIRPORTS!=='undefined'?AIRPORTS:[]).find(x=>x.iata===choice.slice(3));
      if(!a)throw new Error('Neznámé letiště '+choice.slice(3)+'.');
      const known=S.locations.find(p=>p.iata_code===a.iata);if(known)return known.id;
      return check(await S.db.from('travel_locations').insert({name:a.name,country_iso2:a.country,iata_code:a.iata,latitude:a.lat,longitude:a.lon}).select('id').single()).id;
    }
    if(choice!=='__new')return choice||null;
    const name=val(f,end+'Name'),country=val(f,end+'Country');
    if(!name||!country)throw new Error('U nového místa vyplň název a zemi ('+end+').');
    const la=val(f,end+'Lat'),lo=val(f,end+'Lon');
    if(Boolean(la)!==Boolean(lo))throw new Error('Vyplň obě souřadnice, nebo žádnou.');
    const existing=S.locations.find(p=>p.name.toLocaleLowerCase('cs')===name.toLocaleLowerCase('cs')&&p.country_iso2===country);
    if(existing)return existing.id;
    const payload={name,country_iso2:country,latitude:la?Number(la):null,longitude:lo?Number(lo):null};
    if((la&&(!Number.isFinite(payload.latitude)||Math.abs(payload.latitude)>90))||(lo&&(!Number.isFinite(payload.longitude)||Math.abs(payload.longitude)>180)))throw new Error('Neplatné souřadnice.');
    return check(await S.db.from('travel_locations').insert(payload).select('id').single()).id;
  }
  async function saveLeg(ev) {
    ev.preventDefault();const f=ev.currentTarget,t=currentTrip();if(!t)return;
    const departure=val(f,'departure'),arrival=val(f,'arrival'),verification=val(f,'verification');
    if(departure&&arrival&&arrival<departure)return show('Příjezd nemůže být před odjezdem.','error');
    if(verification==='verified'&&departure&&departure>today())return show('Budoucí přesun zatím nelze ověřit.','error');
    try{
      enabled(false);
      const from_location_id=await resolvePlace(f,'from'),to_location_id=await resolvePlace(f,'to');
      if(!from_location_id&&!to_location_id)throw new Error('Vyplň alespoň jedno místo přesunu.');
      if(from_location_id&&to_location_id&&from_location_id===to_location_id)throw new Error('Výchozí a cílové místo musí být rozdílné.');
      const idExisting=val(f,'recordId'),people=checked(id('leg-people'));
      const payload={from_location_id,to_location_id,departure_date:departure||null,arrival_date:arrival||null,mode:val(f,'mode'),verification,flight_number:val(f,'flight')||null,notes:val(f,'notes')};
      let record=idExisting;
      if(record) check(await S.db.from('travel_legs').update(payload).eq('id',record));
      else {payload.trip_id=t.id;payload.leg_order=1+Math.max(0,...S.legs.filter(x=>x.trip_id===t.id).map(x=>x.leg_order));
        record=check(await S.db.from('travel_legs').insert(payload).select('id').single()).id;}
      check(await S.db.from('travel_leg_people').delete().eq('leg_id',record));
      if(people.length)check(await S.db.from('travel_leg_people').insert(people.map(person_id=>({leg_id:record,person_id,presence:verification==='verified'?'confirmed':'planned'}))));
      await reload();show('Přesun uložen. Datum a dopravní prostředek můžeš kdykoli opravit.','ok');
    }catch(e){console.error(e);show('Uložení přesunu selhalo: '+e.message,'error');}
    finally{enabled(true);}
  }
  async function reload(){await S.refresh();}
  function mount(db,refresh,travel) {
    if(S.root)return;
    S.db=db;S.refresh=refresh;S.travel=travel;
    const root=document.createElement('section');root.id='travel-editor';root.className='ed-wrap';
    root.innerHTML='<h3>Upravit uložené cesty a přesuny</h3><p class="empty">Lety i cesty autem, vlakem a lodí můžeš doplňovat a opravovat. Neznámé datum nebo místo nech prázdné. Razítko v pasu samo o sobě nedokazuje letecký spoj.</p><label>Vyber cestu <select id="ed-trip-choice"></select></label><p id="ed-status" class="ed-status" role="status" hidden></p>'+
    '<button id="ed-new-trip" class="ed-button" type="button" style="margin:8px 0">+ Nová cesta (i autem)</button><div id="ed-panel" hidden><h4>Údaje cesty</h4><form id="ed-trip-form" class="ed-form"><label>Název<input name="title" maxlength="180" required></label><label>Stav<select name="status"><option value="planned">Plánovaná</option><option value="completed">Uskutečněná</option><option value="cancelled">Zrušená</option></select></label><label>Typ cesty<select name="category"><option value="family">Rodinná</option><option value="private">Soukromá</option><option value="work">Pracovní</option></select></label><label>Začátek<input type="date" name="actualStart"></label><label>Konec<input type="date" name="actualEnd"></label><label class="ed-wide">Poznámky<textarea name="notes" rows="2"></textarea></label><button type="submit" class="ed-primary">Uložit cestu</button></form>'+
    '<h4>Pobyty a hraniční záznamy</h4><div id="ed-stops"></div><form id="ed-stop-form" class="ed-form"><input type="hidden" name="recordId"><label>Země<select name="country" id="ed-stop-country"></select></label><label>Příjezd<input type="date" name="arrival"></label><label>Odjezd<input type="date" name="departure"></label><label>Přesnost data<select name="precision"><option value="exact">Přesné</option><option value="month">Pouze měsíc</option><option value="year">Pouze rok</option><option value="unknown">Neznámé</option></select></label><label>Typ<select name="kind"><option value="stay">Skutečný pobyt</option><option value="transit">Průjezd / přestup</option><option value="airport_only">Pouze letiště</option></select></label><label>Jistota<select name="verification"><option value="proposed">K ověření</option><option value="verified">Ověřeno</option><option value="rejected">Nesprávný záznam</option></select></label><fieldset class="ed-wide"><legend>Kdo se pobytu účastnil?</legend><div id="ed-stop-people" class="ed-people"></div></fieldset><label class="ed-wide">Poznámky<textarea name="notes" rows="2"></textarea></label><button type="submit" class="ed-primary" id="ed-stop-submit">Přidat pobyt / hranici</button><button type="button" class="ed-button" id="ed-stop-reset">Nový záznam</button></form>'+
    '<h4>Úseky cesty – letadlo, auto a další doprava</h4><div id="ed-legs"></div><form id="ed-leg-form" class="ed-form"><input type="hidden" name="recordId"><label>Odkud<select name="fromId" id="ed-from-choice"></select></label><label>Kam<select name="toId" id="ed-to-choice"></select></label><div class="ed-place ed-wide" data-new-place="from" hidden><strong>Nové výchozí místo</strong><div class="ed-form"><label>Město / letiště<input name="fromName" maxlength="160"></label><label>Země<select name="fromCountry" id="ed-from-country"></select></label><label>Šířka (volitelné)<input name="fromLat" type="number" step="any" min="-90" max="90"></label><label>Délka (volitelné)<input name="fromLon" type="number" step="any" min="-180" max="180"></label></div></div><div class="ed-place ed-wide" data-new-place="to" hidden><strong>Nové cílové místo</strong><div class="ed-form"><label>Město / letiště<input name="toName" maxlength="160"></label><label>Země<select name="toCountry" id="ed-to-country"></select></label><label>Šířka (volitelné)<input name="toLat" type="number" step="any" min="-90" max="90"></label><label>Délka (volitelné)<input name="toLon" type="number" step="any" min="-180" max="180"></label></div></div><label>Doprava<select name="mode"><option value="flight">Letadlo</option><option value="car">Auto</option><option value="train">Vlak</option><option value="bus">Autobus</option><option value="boat">Loď</option><option value="other">Jiné</option></select></label><label>Odjezd / odlet<input type="date" name="departure"></label><label>Příjezd / přílet<input type="date" name="arrival"></label><label>Číslo letu (jen pokud znáš)<input name="flight" maxlength="60"></label><label>Jistota<select name="verification"><option value="proposed">K ověření</option><option value="verified">Potvrzený přesun</option><option value="rejected">Nesprávný záznam</option></select></label><fieldset class="ed-wide"><legend>Kdo cestoval tímto úsekem?</legend><div id="ed-leg-people" class="ed-people"></div></fieldset><label class="ed-wide">Poznámky<textarea name="notes" rows="2"></textarea></label><button type="submit" class="ed-primary" id="ed-leg-submit">Přidat let / přesun</button><button type="button" class="ed-button" id="ed-leg-reset">Nový úsek</button></form></div>';
    const style=document.createElement('style');style.textContent='.ed-wrap{margin-top:20px;padding-top:16px;border-top:1px solid #426071}.ed-wrap h4{font-size:15px;margin:20px 0 10px}.ed-wrap label{display:grid;gap:5px;font-size:12px}.ed-wrap input,.ed-wrap select,.ed-wrap textarea{width:100%;box-sizing:border-box;border:1px solid #506d80;border-radius:8px;background:#142e40;color:white;padding:9px;font:inherit}.ed-wrap textarea{resize:vertical}.ed-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0 20px}.ed-wide{grid-column:1/-1}.ed-form fieldset{border:1px solid #486476;border-radius:10px;padding:10px}.ed-people{display:flex;flex-wrap:wrap;gap:10px}.ed-person{display:inline-flex!important;align-items:center;gap:5px}.ed-person input{width:auto}.ed-button,.ed-primary{border:1px solid #527587;border-radius:9px;background:#21495b;color:#edf9ff;padding:8px 12px;cursor:pointer}.ed-primary{background:#177d73;border-color:#24b6a0}.ed-danger{color:#ffb5a8;border-color:#8a4d4c;background:#3e242c}.ed-record{display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px solid #385264;padding:9px 0}.ed-record-text{flex:1;font-size:13px}.ed-actions{display:flex;gap:5px}.ed-status{padding:10px;margin:10px 0;border:1px solid #688c99;border-radius:8px}.ed-status[data-kind="error"]{color:#ffbdad}.ed-status[data-kind="ok"]{color:#91e4c5}.ed-place{padding:12px;border:1px dashed #65869b;border-radius:10px}@media(max-width:650px){.ed-form{grid-template-columns:1fr}.ed-record{align-items:flex-start;flex-direction:column}.ed-actions{width:100%}}';
    document.head.append(style);document.getElementById('live-tools').append(root);S.root=root;
    countries(id('stop-country'));countries(id('from-country'));countries(id('to-country'));
    id('trip-choice').addEventListener('change',e=>{S.tripId=e.target.value;editTrip();});
    id('new-trip').addEventListener('click',createTrip);
    id('trip-form').addEventListener('submit',saveTrip);id('stop-form').addEventListener('submit',saveStop);id('leg-form').addEventListener('submit',saveLeg);
    id('stop-reset').addEventListener('click',()=>resetStop());id('leg-reset').addEventListener('click',()=>resetLeg());
    for(const end of ['from','to'])id(end+'-choice').addEventListener('change',e=>{id('leg-form').querySelector('[data-new-place="'+end+'"]').hidden=e.target.value!=='__new';});
    sync(travel);
  }
  async function sync(travel) {
    if(!S.root)return;
    S.travel=travel;S.trips=travel.trips||[];
    try{await data();updateChoice();}
    catch(e){console.error('Editor cest',e);show('Nepodařilo se načíst editor: '+e.message,'error');}
  }
  window.RodinneCestyEditor={mount,sync};
})();