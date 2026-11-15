'use strict';
// Veřejně známá letiště (IATA, země, souřadnice zaokrouhlené na setiny stupně).
// Jde o obecný číselník, ne o osobní údaje. Souřadnice jsou přibližné (pro kreslení trasy na mapě).
const AIRPORTS=[
['MNL','Manila','PH',14.51,121.02],['CEB','Cebu','PH',10.31,123.98],['PRG','Praha','CZ',50.10,14.26],
['VIE','Vídeň','AT',48.11,16.57],['FRA','Frankfurt','DE',50.03,8.57],['MUC','Mnichov','DE',48.35,11.79],
['LHR','Londýn Heathrow','GB',51.47,-0.45],['CDG','Paříž','FR',49.01,2.55],['AMS','Amsterdam','NL',52.31,4.76],
['FCO','Řím','IT',41.80,12.25],['BCN','Barcelona','ES',41.30,2.08],['IST','Istanbul','TR',41.26,28.74],
['DXB','Dubaj','AE',25.25,55.36],['DOH','Dauhá','QA',25.27,51.61],['SIN','Singapur','SG',1.36,103.99],
['BKK','Bangkok','TH',13.69,100.75],['HKT','Phuket','TH',8.11,98.32],['KUL','Kuala Lumpur','MY',2.75,101.71],
['CGK','Jakarta','ID',-6.13,106.66],['DPS','Bali','ID',-8.75,115.17],['SGN','Ho Či Minovo Město','VN',10.82,106.66],
['HAN','Hanoj','VN',21.22,105.81],['HKG','Hongkong','HK',22.31,113.92],['TPE','Tchaj-pej','TW',25.08,121.23],
['ICN','Soul','KR',37.46,126.44],['NRT','Tokio Narita','JP',35.77,140.39],['HND','Tokio Haneda','JP',35.55,139.78],
['KIX','Ósaka','JP',34.43,135.24],['PEK','Peking','CN',40.08,116.58],['PVG','Šanghaj','CN',31.14,121.81],
['DEL','Dillí','IN',28.56,77.10],['SYD','Sydney','AU',-33.94,151.18],['MEL','Melbourne','AU',-37.67,144.84],
['AKL','Auckland','NZ',-37.01,174.79],['JFK','New York','US',40.64,-73.78],['LAX','Los Angeles','US',33.94,-118.41],
['SFO','San Francisco','US',37.62,-122.38],['YVR','Vancouver','CA',49.19,-123.18],['CAI','Káhira','EG',30.12,31.41]
].map(([iata,name,country,lat,lon])=>({iata,name,country,lat,lon}));
