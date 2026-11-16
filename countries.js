// Úplný seznam zemí a území (ISO 3166-1 alpha-2 + Kosovo) s českými názvy.
// Mapa obsahuje jen větší státy, proto výběr zemí nesmí vycházet z jejích obrysů –
// jinak chybí např. Singapur, Malta, Maledivy nebo Hongkong.
(function(){
  const CODES='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
  // Přibližná poloha [délka, šířka] pro země a území, které na mapě nemají obrys.
  const POINTS={AD:[1.52,42.51],AG:[-61.85,17.12],AI:[-63.07,18.22],AS:[-170.7,-14.28],AW:[-70.03,12.52],AX:[19.94,60.1],BB:[-59.6,13.1],BH:[50.58,26.22],BL:[-62.85,17.9],BM:[-64.78,32.3],BQ:[-68.27,12.15],BV:[3.4,-54.42],CC:[96.87,-12.17],CK:[-159.78,-21.23],CV:[-23.51,14.93],CW:[-68.93,12.17],CX:[105.69,-10.45],DM:[-61.39,15.3],FM:[158.16,6.92],FO:[-6.77,62.01],GD:[-61.75,12.06],GF:[-52.33,4.94],GG:[-2.54,49.45],GI:[-5.35,36.14],GP:[-61.55,16.25],GS:[-36.51,-54.28],GU:[144.79,13.44],HK:[114.17,22.32],HM:[73.5,-53.1],IM:[-4.48,54.15],IO:[72.42,-7.31],JE:[-2.13,49.21],KI:[173.0,1.33],KM:[43.26,-11.7],KN:[-62.72,17.3],KY:[-81.38,19.29],LC:[-60.98,13.91],LI:[9.52,47.14],MC:[7.42,43.74],MF:[-63.07,18.07],MH:[171.38,7.09],MO:[113.54,22.2],MP:[145.75,15.2],MQ:[-61.02,14.64],MS:[-62.19,16.74],MT:[14.51,35.9],MU:[57.5,-20.16],MV:[73.51,4.18],NF:[167.95,-29.04],NR:[166.93,-0.53],NU:[-169.87,-19.05],PF:[-149.57,-17.53],PM:[-56.17,46.78],PN:[-130.1,-25.07],PW:[134.48,7.34],RE:[55.45,-20.88],SC:[55.45,-4.62],SG:[103.82,1.35],SH:[-5.72,-15.93],SJ:[15.65,78.22],SM:[12.45,43.94],ST:[6.73,0.34],SX:[-63.05,18.04],TC:[-71.8,21.8],TK:[-171.85,-9.2],TO:[-175.2,-21.14],TV:[179.19,-8.52],UM:[166.65,19.28],VA:[12.45,41.9],VC:[-61.2,13.16],VG:[-64.62,18.43],VI:[-64.93,18.34],WF:[-176.2,-13.28],WS:[-171.75,-13.83],YT:[45.17,-12.83]};
  const SHORT={HK:'Hongkong',MO:'Macao',PS:'Palestina',UM:'Menší odlehlé ostrovy USA'};
  let dn=null;try{dn=new Intl.DisplayNames(['cs'],{type:'region'});}catch(e){}
  const mapNames=()=>new Map([...document.querySelectorAll('#countries [data-iso2]')].map(x=>[x.dataset.iso2,x.dataset.name]));
  let cache=null;
  function list(){
    if(cache)return cache;
    const fromMap=mapNames();
    cache=CODES.map(code=>{let name=SHORT[code];if(!name){try{name=dn&&dn.of(code);}catch(e){}}
      if(!name||name===code)name=fromMap.get(code)||code;return {code,name};})
      .sort((a,b)=>a.name.localeCompare(b.name,'cs'));
    return cache;
  }
  window.COUNTRIES={
    list,
    name:code=>(list().find(c=>c.code===code)||{}).name||code,
    point:code=>POINTS[code]||null
  };
})();
