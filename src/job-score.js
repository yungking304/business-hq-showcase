// Scoring: every lead gets a track (full | part | none), a fit 0-100, one line why, one line gap, and the facts a card
// shows (company, location tier, pay, remote). With ANTHROPIC_API_KEY the model reads the profile's inventory and the
// posting; without it a transparent keyword heuristic runs. Both return the same shape. Spend is recorded in the
// expense ledger like the Etsy concepts, under the same AI hard limit.
import {aiConfig} from './etsy.js';
const txt=(v,n=20000)=>String(v??'').slice(0,n);
const month=()=>new Date().toISOString().slice(0,7);
export const TIERS=['Austin','Houston','Dallas','Bryan / College Station','Remote','Elsewhere'];
export function tierOf(location,description=''){
 const l=(location+' '+description.slice(0,300)).toLowerCase();
 if(/austin/.test(l))return 'Austin';if(/houston/.test(l))return 'Houston';if(/dallas|fort worth|plano|irving|frisco/.test(l))return 'Dallas';if(/bryan|college station/.test(l))return 'Bryan / College Station';
 if(/remote|work from home|anywhere/.test(l)&&!/not remote|no remote|on-?site only/.test(l))return 'Remote';return 'Elsewhere';
}
function prioritized(company,profile){const c=String(company||'').toLowerCase();return (profile.priority_employers||[]).some(p=>c.includes(String(p).toLowerCase()))}
export function heuristicScore(job,profile){
 const title=job.title.toLowerCase(),all=(job.title+' '+job.location+' '+job.description).toLowerCase();
 const part=/part[ -]?time|contract|freelance|consultant|hourly|evenings?|per diem/.test(all)&&!/full[ -]?time/.test(title);
 const t=part?profile.tracks.part:profile.tracks.full;
 if(!t.enabled)return none('Track disabled');
 if(t.avoid.some(a=>title.includes(a.toLowerCase())))return none('Title is on the avoid list');
 if(/\b(intern|internship|entry[ -]level|principal engineer|staff engineer)\b/.test(title))return none('Level or type outside both tracks');
 const tier=tierOf(job.location,job.description);
 if(part&&tier!=='Remote')return none('Part-time must be remote');
 let fit=20;const hits=t.titles.filter(k=>title.includes(k.toLowerCase()));fit+=Math.min(35,hits.length*18);
 if(/quality|haccp|sqf|compliance|audit|food safety/.test(all))fit+=10;if(/program|project|process improvement|six sigma|lean|training|implementation|rollout/.test(all))fit+=10;
 if(prioritized(job.company,profile))fit+=15;
 const geoRank=(profile.geo||[]).findIndex(g=>tier.toLowerCase().startsWith(String(g).toLowerCase().split(' ')[0]));fit+=geoRank<0?-10:Math.max(0,8-geoRank*2);
 fit=Math.max(0,Math.min(100,fit));
 const pay=job.pay||payFromText(job.description);
 return {track:part?'part':'full',fit,reason:hits.length?'Title matches '+hits.slice(0,2).join(', ')+(prioritized(job.company,profile)?' at a priority employer':''):'Related role; title does not name a target function',gap:/\bpmp\b[^.]{0,40}required/.test(all)?'PMP listed as required (exam pending)':/\b(?:bachelor|master)[^.]{0,60}(?:engineering|computer science)\b/.test(all)?'Asks for an engineering or CS degree':'',company:job.company||'',location:job.location||'',tier,pay,remote:tier==='Remote'?1:0,worth_move:tier==='Elsewhere'&&fit>=(profile.worth_the_move||85)?1:0,employer_domain:guessDomain(job.company),mode:'heuristic'};
}
const none=why=>({track:'none',fit:0,reason:why,gap:'',company:'',location:'',tier:'',pay:'',remote:0,worth_move:0,employer_domain:'',mode:'heuristic'});
export function payFromText(d){const m=String(d||'').match(/(?:USD\s*|\$)\s*\d[\d,]*(?:\.\d+)?\s*[kK]?\s*(?:[-–—]|to)\s*(?:USD\s*|\$)?\s*\d[\d,]*(?:\.\d+)?\s*[kK]?(?:\s*(?:per|\/)\s*(?:year|annum|hour|hr|week))?/);return m?m[0].replace(/\s+/g,' ').trim().slice(0,60):''}
const DOMAINS={apple:'apple.com',google:'google.com','texas a&m':'tamu.edu',teex:'teex.org',amazon:'amazon.com',microsoft:'microsoft.com',tesla:'tesla.com',dell:'dell.com',hp:'hp.com',meta:'meta.com',samsung:'samsung.com',oracle:'oracle.com',ibm:'ibm.com',indeed:'indeed.com',linkedin:'linkedin.com'};
export function guessDomain(company){const c=String(company||'').toLowerCase().trim();if(!c)return '';for(const k of Object.keys(DOMAINS))if(c.includes(k))return DOMAINS[k];const w=c.replace(/[^a-z0-9 ]/g,'').split(/\s+/).filter(x=>!/^(inc|llc|corp|corporation|company|co|ltd|the|group|technologies|technology|systems|university|of)$/.test(x));return w.length?w.slice(0,2).join('')+'.com':''}
function prompt(profile,jobs){
 return `You score job postings for one candidate. Read the candidate inventory, then each posting, and return ONLY a JSON array (no prose) with one object per posting, same order, keys:
{"i":index,"track":"full"|"part"|"none","fit":0-100,"reason":"one line, max 110 chars, why it fits","gap":"one line, max 110 chars, the biggest thing he lacks or '' ","company":"employer name","location":"city/state or Remote","tier":one of ${JSON.stringify(TIERS)},"pay":"pay as stated or ''","remote":0|1,"employer_domain":"primary website domain like apple.com or ''"}
Rules: track "part" only if the role is part-time/contract/hourly AND remote; "full" for regular full-time roles; "none" when the role is clearly wrong for him (engineering IC, sales quota, medical, trades, internships) or below both tracks' pay floors. Full-time floor $${profile.tracks.full.min_salary.toLocaleString()}/yr; part-time floor $${profile.tracks.part.min_weekly}/week. Prefer in order: ${(profile.geo||[]).join(' > ')}. Priority employers (add up to +15): ${(profile.priority_employers||[]).join(', ')}. Fit 85+ means he should apply today; 70-84 strong; 50-69 maybe; under 50 skip. Be strict: do not reward "product manager" or "engineering manager" titles unless the duties are program/process/quality work he has done. Never invent pay.

CANDIDATE INVENTORY
${profile.inventory}

POSTINGS
${jobs.map((j,i)=>`[${i}] ${j.company||'(company unknown)'} — ${j.title}\nLocation: ${j.location||'(unknown)'}\nPay: ${j.pay||'(not stated)'}\n${txt(j.description,3500)}`).join('\n\n')}`;
}
async function aiSpend(env){return (await env.DB.prepare("SELECT COALESCE(SUM(amount),0) spent FROM expenses WHERE month=? AND service LIKE 'AI%'").bind(month()).first()).spent}
export async function aiScore(env,profile,jobs){
 const cfg=aiConfig(env);if(!cfg.key||!jobs.length)return null;
 const est=(jobs.length*1200+profile.inventory.length/4)/1e6*cfg.priceIn+jobs.length*120/1e6*cfg.priceOut;
 const spent=await aiSpend(env);if(spent+est>cfg.hard)return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);let res;
 try{res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':cfg.key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:cfg.model,max_tokens:4000,messages:[{role:'user',content:prompt(profile,jobs)}]}),signal:controller.signal})}catch{clearTimeout(timer);return null}finally{clearTimeout(timer)}
 if(!res.ok)return null;const body=await res.json().catch(()=>null);const text=body?.content?.map(c=>c.text||'').join('')||'';
 const usage=body?.usage||{};const cost=(usage.input_tokens||0)/1e6*cfg.priceIn+(usage.output_tokens||0)/1e6*cfg.priceOut;
 try{await env.DB.prepare('INSERT INTO expenses(service,amount,month,note) VALUES(?,?,?,?)').bind('AI jobs',Math.round(cost*10000)/10000,month(),'Scored '+jobs.length+' job postings').run()}catch{}
 let arr;try{arr=JSON.parse(text.slice(text.indexOf('['),text.lastIndexOf(']')+1))}catch{return null}if(!Array.isArray(arr))return null;
 const out=[];for(const j of jobs){const i=out.length;const r=arr.find(x=>Number(x?.i)===i)||{};const tier=TIERS.includes(r.tier)?r.tier:tierOf(String(r.location||j.location),j.description);const fit=Math.max(0,Math.min(100,Math.round(Number(r.fit)||0)));
  out.push({track:['full','part','none'].includes(r.track)?r.track:'none',fit,reason:txt(r.reason,160),gap:txt(r.gap,160),company:txt(r.company||j.company,120),location:txt(r.location||j.location,200),tier,pay:txt(r.pay||j.pay,80),remote:tier==='Remote'||Number(r.remote)===1?1:0,worth_move:tier==='Elsewhere'&&fit>=(profile.worth_the_move||85)?1:0,employer_domain:txt(r.employer_domain,120).toLowerCase().replace(/^https?:\/\//,'').replace(/\/.*$/,'')||guessDomain(r.company||j.company),mode:'ai'})}
 return out;
}
export async function scoreJobs(env,profile,jobs){
 const chunks=[];for(let i=0;i<jobs.length;i+=8)chunks.push(jobs.slice(i,i+8));
 const out=[];for(const chunk of chunks){const ai=await aiScore(env,profile,chunk);out.push(...(ai||chunk.map(j=>heuristicScore(j,profile))))}
 return out;
}
