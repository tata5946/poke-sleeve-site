import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
const out = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(out, '../..');
const read = f => fs.readFileSync(path.join(root,f),'utf8');
const html = read('detail.html');
const script = h => [...h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].find(m => !/\bsrc=/.test(m[1]) && m[2].includes('function buildAiMarketDiagnosis'))[2];
const source = script(html), hash = s => crypto.createHash('sha256').update(s).digest('hex');
const elements = new Map();
const element = id => {
  if(!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',querySelector:()=>null});
  return elements.get(id);
};
const context = createContext({console, URL,URLSearchParams,Date,Intl,setTimeout,clearTimeout,
  window:{matchMedia:()=>({matches:false}),addEventListener(){},common:null},
  document:{getElementById:element,addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[],baseURI:'https://pokesuri-navi.com/'},
  location:{href:'https://pokesuri-navi.com/',search:'',pathname:'/'},navigator:{},localStorage:{getItem:()=>null},fetch:()=>{throw Error('Rendering audit must not fetch');}});
runInContext(read('assets/pricing.js')+'\n'+source,context);
const results = [];
for(const sleeve of JSON.parse(read('data.json')).sleeves) {
  const route = /^\d{6,7}$/.test(String(sleeve.id)) ? '4521329'+sleeve.id : sleeve.id;
  const file = 'sleeve/'+route+'/index.html', page = read(file);
  const initial = page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  context.sleeve = sleeve;
  const points = runInContext('getSeriesForMode(sleeve,"all")',context);
  context.points = points;
  element('weeklyChart').innerHTML='';
  if(points.length >= 2) runInContext('renderPriceAreaChart("weeklyChart","Price history",points,"all")',context);
  else if(points.length === 1) runInContext('renderSinglePriceCard("weeklyChart",points[0],"all")',context);
  const markup = element('weeklyChart').innerHTML;
  const node = initial.match(/<div id="weeklyChart">([\s\S]*?)<\/div>/)?.[1] || '';
  const embedded = JSON.parse(page.match(/window\.__SLEEVE_PAGE_DATA = (.*?);<\/script>/)[1]);
  results.push({id:sleeve.id,url:'https://pokesuri-navi.com/'+file.replace(/index\.html$/,''),runtime_points:points.length,runtime_svg:/<svg\b/.test(markup),runtime_single_card:points.length===1&&markup.length>0,initial_chart_has_svg:/<svg\b/.test(node),history_table_css_hidden:/#weeklyTable\s*\{\s*display:\s*none/.test(read('assets/site.css')),same_runtime_script:hash(script(page))===hash(source),embedded_product_matches:String(embedded.id)===String(sleeve.id),renderer_markup_sha256:hash(markup),runtime_first_date:points[0]?.date,runtime_last_date:points.at(-1)?.date});
}
if(results.some(r=>!r.same_runtime_script||!r.embedded_product_matches))throw Error('Per-product rendering code/input differs');
fs.writeFileSync(path.join(out,'product-rendering.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({checked:results.length,with_graph:results.filter(r=>r.runtime_svg).length,single_card:results.filter(r=>r.runtime_single_card).length,without_history:results.filter(r=>!r.runtime_points).length,initial_graphs:results.filter(r=>r.initial_chart_has_svg).length,hidden_tables:results.filter(r=>r.history_table_css_hidden).length,shared_script_match:results.every(r=>r.same_runtime_script)}));
