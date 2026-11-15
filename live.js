'use strict';
// Reálný režim: jen databáze chráněná společným přihlášením Rozcestníku.
// Nikdy nekopírovat osobní cestovní údaje do veřejného repozitáře.
const travel = {db:null, people:[],trips:[],attendance:[]};
const byId=id=>document.getElementById(id);
const must=(result)=>{if(result.error)throw result.error;return result.data||[]};
const today=()=>new Date().toLocaleDateString('en-CA');
const errorText=e=>e?.message||String(e);
function message(value,type='note'){const el=byId('live-message');el.hidden=!value;el.textContent=value;el.dataset.type=type;}
function report(e){console.error('Rodinné cesty',e);message('Chyba: '+errorText(e),'error');}
async function table(name,columns='*'){return must(await travel.db.from(name).select(columns));}
function busy(value){document.querySelectorAll('[data-live-action]').forEach(x=>x.disabled=value);}
function options(){
 const el=byId('visit-country');el.replaceChildren(new Option('Vyber zemi…',''));
 const arr=[...document.querySelectorAll('#countries [data-iso2]')].map(x=>({id:x.dataset.iso2,name:x.dataset.name}))
 .filter(x=>/^[A-Z]{2}$/.test(x.id)).sort((a,b)=>a.name.localeCompare(b.name,'cs'));
 arr.forEach(x=>el.add(new Option(x.name+' ('+x.id+')',x.id)));
}
function peopleOptions(){
 const el=byId('visit-people');el.replaceChildren();
 for(const p of travel.people.filter(x=>x.active)){
  const lbl=document.createElement('label');lbl.className='person-input';
  const input=document.createElement('input');input.type='checkbox';input.name='person';input.value=p.id;
  lbl.append(input,document.createTextNode(' '+p.display_name));el.append(lbl);
 }
}
function resetVisit(){
 byId('visit-form').reset();
 delete byId('visit-form').dataset.tripId;
 byId('visit-form').hidden=true;
 byId('save-visit').textContent='Uložit uskutečněnou návštěvu';
}
function visitPeople(){return [...document.querySelectorAll('#visit-people input:checked')].map(x=>x.value);}
function openVisit(id=''){
 resetVisit();
 const trip=travel.trips.find(x=>x.id===id);
 byId('visit-form').hidden=false;
 byId('visit-form').dataset.tripId=id;
 byId('visit-name').value=trip?.title||'';
 byId('visit-date').value=trip?.planned_start||today();
 if(trip){
  const ids=new Set(travel.attendance.filter(x=>x.trip_id===id).map(x=>x.person_id));
  document.querySelectorAll('#visit-people input').forEach(x=>x.checked=ids.has(x.value));
  byId('save-visit').textContent='Potvrdit návštěvu';
 }
 byId('visit-name').focus();
}
function plans(){
 const root=byId('planned-list');root.replaceChildren();
 const pending=travel.trips.filter(x=>x.status==='planned').sort((a,b)=>(a.planned_start||'').localeCompare(b.planned_start||''));
 byId('planned-count').textContent=String(pending.length);
 if(!pending.length){const p=document.createElement('p');p.className='empty';p.textContent='Žádné plánované cesty.';root.append(p);}
 for(const t of pending.slice(0,60)){
  const card=document.createElement('div');card.className='planned-item';
  const title=document.createElement('strong');title.textContent=t.title;
  const date=document.createElement('small');date.textContent=(t.planned_start||'Datum neznámé')+' – '+(t.planned_end||'?');
  const b=document.createElement('button');b.type='button';b.className='tool';b.textContent='Potvrdit pobyt';b.dataset.liveAction='confirm';
  b.addEventListener('click',()=>openVisit(t.id));card.append(title,date,b);root.append(card);
 }
}
function timeline(trips,stops,people){
 const allowed=new Set(trips.filter(x=>x.status==='completed').map(x=>x.id));
 const confirmed=new Map();
 for(const row of people.filter(x=>x.presence==='confirmed')){
  const ids=confirmed.get(row.stop_id)||[];ids.push(row.person_id);confirmed.set(row.stop_id,ids);
 }
 const rec=stops.filter(x=>allowed.has(x.trip_id)&&x.kind==='stay'&&x.verification==='verified'&&x.arrival_date)
  .flatMap(s=>{const persons=confirmed.get(s.id)||[];if(!persons.length)return [];
    const trip=trips.find(t=>t.id===s.trip_id);
    return [{id:s.id,date:s.arrival_date,country:s.country_iso2,name:trip.title,people:persons}];
  }).sort((a,b)=>a.date.localeCompare(b.date));
 const geo=new Map([...document.querySelectorAll('#countries [data-iso2]')].map(x=>[x.dataset.iso2,x.dataset.name]));
 for(const r of rec){if(!DEST[r.country])DEST[r.country]={name:geo.get(r.country)||r.country,city:geo.get(r.country)||r.country,p:null};}
 TRIPS.splice(0,TRIPS.length,...rec);
 PEOPLE.splice(0,PEOPLE.length,...travel.people.map(p=>({id:p.id,name:p.display_name})));
 const now=new Date();END={y:now.getFullYear(),m:now.getMonth()};
 TOTAL=(END.y-START.y)*12+END.m-START.m;current=TOTAL;filter='all';selectedCountry=null;
 byId('people-filters').replaceChildren();makeFilters();
 byId('month-range').max=String(TOTAL);
 const years=byId('year-labels');years.replaceChildren();
 for(let y=START.y;y<=END.y;y+=2){const s=document.createElement('span');s.textContent=y;years.append(s);}
 render();
}
async function refresh(){
 const [persons,trips,stops,stopPeople,participants]=await Promise.all([
  table('travel_people'),table('travel_trips'),table('travel_stops'),table('travel_stop_people'),table('travel_trip_people')
 ]);
 travel.people=persons;travel.trips=trips;travel.attendance=participants;
 peopleOptions();plans();timeline(trips,stops,stopPeople);
}
async function saveVisit(event){
 event.preventDefault();
 const title=byId('visit-name').value.trim(),country=byId('visit-country').value,date=byId('visit-date').value,persons=visitPeople();
 if(!title||!country||!/^20\d{2}-\d{2}-\d{2}$/.test(date)||!persons.length){message('Vyber název, datum, zemi a alespoň jednu osobu.','error');return;}
 busy(true);let created=null,stop=null;
 try{
  const existing=byId('visit-form').dataset.tripId||null;
  let id=existing;
  if(!id){id=must(await travel.db.from('travel_trips').insert({title,status:'completed',category:'private',actual_start:date,actual_end:date}).select('id').single()).id;created=id;}
  const prior=must(await travel.db.from('travel_stops').select('stop_order').eq('trip_id',id));
  const order=1+Math.max(0,...prior.map(x=>x.stop_order));
  stop=must(await travel.db.from('travel_stops').insert({trip_id:id,stop_order:order,country_iso2:country,arrival_date:date,date_precision:'exact',kind:'stay',verification:'verified'}).select('id').single()).id;
  must(await travel.db.from('travel_stop_people').insert(persons.map(person_id=>({stop_id:stop,person_id,presence:'confirmed'}))));
  must(await travel.db.from('travel_trip_people').upsert(persons.map(person_id=>({trip_id:id,person_id,participation:'confirmed'})),{onConflict:'trip_id,person_id'}));
  if(existing)must(await travel.db.from('travel_trips').update({title,status:'completed',actual_start:date,actual_end:date,updated_at:new Date().toISOString()}).eq('id',id));
  resetVisit();await refresh();message('Návštěva je potvrzená a uložená.','success');
 }catch(e){
  if(stop){const r=await travel.db.from('travel_stops').delete().eq('id',stop);if(r.error)console.error('Úklid zastávky:',r.error);}
  if(created){const r=await travel.db.from('travel_trips').delete().eq('id',created);if(r.error)console.error('Úklid cesty:',r.error);}
  report(e);
 }finally{busy(false);}
}
async function syncPlans(){
 busy(true);message('Načítám plánované cesty…');
 let total=0;
 try{
  const [links,group,individual]=await Promise.all([
   table('travel_plan_links','source_table,source_id'),
   table('plan_cesty','id,zacatek,konec,destinace,stav'),
   table('plan_volno','id,osoba,zacatek,konec,typ,popis,cesta_id')
  ]);
  const exists=new Set(links.map(x=>x.source_table+':'+x.source_id));
  const plans=[
   ...group.filter(x=>x.stav==='potvrzena').map(x=>({source:'plan_cesty',id:x.id,title:'Plánovač · '+(x.destinace||'Rodinná cesta'),start:x.zacatek,end:x.konec,category:'family'})),
   ...individual.filter(x=>['cesta','sluzebni'].includes(x.typ)&&!x.cesta_id).map(x=>({source:'plan_volno',id:x.id,title:'Plánovač · '+(x.popis||'Individuální cesta'),start:x.zacatek,end:x.konec,category:x.typ==='sluzebni'?'work':'private',person:x.osoba}))
  ];
  for(const p of plans){
   const key=p.source+':'+p.id;if(exists.has(key))continue;
   const id=must(await travel.db.from('travel_trips').insert({title:p.title.slice(0,180),planned_start:p.start,planned_end:p.end,category:p.category,status:'planned'}).select('id').single()).id;
   try{
    must(await travel.db.from('travel_plan_links').insert({trip_id:id,source_table:p.source,source_id:p.id}));
    const person=travel.people.find(x=>x.planner_person_key===p.person);
    if(person)must(await travel.db.from('travel_trip_people').insert({trip_id:id,person_id:person.id,participation:'planned'}));
   }catch(e){await travel.db.from('travel_trips').delete().eq('id',id);throw e;}
   exists.add(key);total++;
  }
  await refresh();message(total?'Načteno '+total+' nových plánů. Zatím nejde o potvrzené návštěvy.':'Žádné nové plány.','success');
 }catch(e){report(e);}finally{busy(false);}
}
async function initLive(){
 const auth=window.RodinaAuth;
 if(!auth?.client){byId('locked-view').hidden=false;return;}
 try{
  const session=await auth.vyzadujPrihlaseni();if(!session)return;
  travel.db=auth.client;byId('locked-view').hidden=true;byId('main-app').hidden=false;byId('live-tools').hidden=false;
  byId('mode-label').textContent='RODINNÁ DATABÁZE';byId('mode-label').classList.add('live-pill');
  byId('footnote').textContent='Soukromé cesty se načítají z chráněného Supabase. Samotné plánování nikdy neodemkne zemi.';
  options();
  byId('add-visit').addEventListener('click',()=>openVisit());
  byId('cancel-visit').addEventListener('click',resetVisit);
  byId('visit-form').addEventListener('submit',saveVisit);
  byId('sync-planner').addEventListener('click',syncPlans);
  byId('month-range').addEventListener('input',e=>{stop();current=Number(e.target.value);render();});
  byId('play').addEventListener('click',play);
  byId('speed').addEventListener('change',()=>{if(timer!==null){stop();play();}});
  byId('back').addEventListener('click',()=>{stop();current--;render();});
  byId('forward').addEventListener('click',()=>{stop();current++;render();});
  byId('asia-btn').addEventListener('click',()=>setView(true));
  byId('world-btn').addEventListener('click',()=>setView(false));
  document.querySelectorAll('#countries [data-iso2]').forEach(el=>el.addEventListener('click',()=>showCountry(el.dataset.iso2)));
  await refresh();message('Databáze je připravena. Přidej první ověřenou návštěvu nebo načti plány.');
 }catch(e){report(e);}
}
if(!(new URLSearchParams(location.search).has('demo')||location.protocol==='file:'))initLive();
