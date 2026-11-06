import {handleCommerce,scheduledCommerce} from './commerce.js';
import {handleEtsy,scheduledEtsy} from './etsy.js';
import {handleScout,scheduledScout} from './scout.js';
import {handlePublish,scheduledPublish,approveDraft,rejectDraft,reopenDraft,syncPublishing} from './publish.js';
import {handlePromo,scheduledPromo} from './promo.js';
import {handleHero,scheduledHero,catchUp} from './hero.js';
import {handleOauth,scheduledAttach} from './etsy-oauth.js';
import {handleStats,scheduledStats} from './etsy-stats.js';
import {handleJobs,scheduledJobs} from './jobs.js';
import {handleAgency,scheduledAgency,handleInbound} from './agency.js';
import {handleStudio,handleStudioAgent} from './studio.js';
import {handleToday,mobileAsset,rollTasks} from './today.js';
import {handlePush,notifyNeeds} from './push.js';
import {handleRefresh,refreshAsset,syncFreeShipping} from './refresh.js';
import {handleRebuild,retireReplaced} from './rebuild.js';
import {handlePersonalize,personalizeAsset,scheduledPersonalize} from './personalize.js';
import {handleLab,handleLabAgent,labAsset} from './lab.js';
import {handleContent,contentAsset,scheduledContent,scheduledHealth} from './content.js';
import {handleSocial,publicMedia} from './social.js';
import {socialAsset} from './app-social.js';
import {handleHome,homeAsset} from './home.js';
import {etsyAppAsset} from './app-etsy.js';
import {cerulaneAppAsset} from './app-cerulane.js';
import {jobsAppAsset} from './app-jobs.js';
import {ensureAuth,configured,verifyPassword,sessionFromRequest,createSession,destroySession,rateLimited,recordFailure,clearFailures,ip,loginPage,readLoginForm,safeNext,hashCheckable} from './auth.js';
import studiojs from './studio-client.js.txt';
import agencyjs from './agency-client.js.txt';
import jobsjs from './jobs-client.js.txt';
import html from './ui.html.txt';
import appjs from './client.js.txt';
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const h={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; media-src 'self'; img-src 'self' data: https://images.printify.com https://images-api.printify.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const num=(v,min,max)=>{const x=Number(v);return Number.isFinite(x)&&x>=min&&x<=max?x:null};
const txt=(v,n=1500)=>String(v??'').slice(0,n);
const month=()=>new Date().toISOString().slice(0,7);
async function spend(env){const m=month();const r=await env.DB.prepare('SELECT COALESCE(SUM(amount),0) spent FROM expenses WHERE month=?').bind(m).first();const by=(await env.DB.prepare('SELECT service,ROUND(SUM(amount),4) amount,COUNT(*) n FROM expenses WHERE month=? GROUP BY service').bind(m).all()).results;return {spent:r.spent,month:m,by_service:by,budget:Number(env.MONTHLY_BUDGET_USD||100),aiSoft:Number(env.AI_SOFT_LIMIT_USD||30),aiHard:Number(env.AI_HARD_LIMIT_USD||40)};}
async function route(req,env,identity,ctx){const url=new URL(req.url),p=url.pathname,m=req.method;
 if(p==='/classic'&&m==='GET')return new Response(html,{headers:h});
 if(p==='/jobs.js'&&m==='GET')return new Response(jobsjs,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(p==='/agency.js'&&m==='GET')return new Response(agencyjs,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(p==='/studio.js'&&m==='GET')return new Response(studiojs,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(p==='/app.js'&&m==='GET')return new Response(appjs,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(m==='GET'){const a=homeAsset(p)||etsyAppAsset(p)||cerulaneAppAsset(p)||jobsAppAsset(p)||mobileAsset(p)||refreshAsset(p)||personalizeAsset(p)||labAsset(p)||contentAsset(p)||socialAsset(p);if(a)return a}
 if(p.startsWith('/media/')&&m==='GET'){const r=await publicMedia(p,env);if(r)return r}
 if(!p.startsWith('/api/'))return json({error:'Not found'},404);
 if(p==='/api/home')return handleHome(req,env);
 if(p.startsWith('/api/today'))return handleToday(req,env);
 if(p.startsWith('/api/push/'))return handlePush(req,env);
 if(p==='/api/refresh'||p.startsWith('/api/refresh/'))return handleRefresh(req,env);
 if(p==='/api/personalize'||p.startsWith('/api/personalize/'))return handlePersonalize(req,env);
 if(p==='/api/lab'||p.startsWith('/api/lab/'))return handleLab(req,env);
 if(p==='/api/content'||p.startsWith('/api/content/'))return handleContent(req,env);
 if(p==='/api/social'||p.startsWith('/api/social/'))return handleSocial(req,env);
 if(p.startsWith('/api/studio/'))return handleStudio(req,env);
 if(p.startsWith('/api/jobs/'))return handleJobs(req,env,identity);
 if(p.startsWith('/api/agency/'))return handleAgency(req,env,identity);
 if(p==='/api/commerce/rebuild'||p.startsWith('/api/commerce/rebuild/'))return handleRebuild(req,env);
 if(p.startsWith('/api/commerce/etsy/stats'))return handleStats(req,env);
 if(p==='/api/commerce/etsy/scout')return handleScout(req,env);
 if(p.startsWith('/api/commerce/etsy/oauth')||p==='/api/commerce/etsy/attach')return handleOauth(req,env);
 if(p.startsWith('/api/commerce/etsy/'))return handleEtsy(req,env);
 if(p.startsWith('/api/commerce/promo'))return handlePromo(req,env);
 if(p.startsWith('/api/commerce/hero'))return handleHero(req,env,ctx);
 if(['/api/commerce/render','/api/commerce/render/pending','/api/commerce/mockups','/api/commerce/sync-publishing','/api/commerce/catalog'].includes(p))return handlePublish(req,env);
 if(p.startsWith('/api/commerce/'))return handleCommerce(req,env);
 if(m==='GET'&&p==='/api/overview'){
 const [niches,drafts,expenses,tasks,budget]=await Promise.all([
 env.DB.prepare('SELECT * FROM niches ORDER BY id DESC').all(),env.DB.prepare('SELECT *,ROUND(selling_price-production_cost-shipping_cost-other_cost-(selling_price*0.095+0.45),2) AS estimated_profit FROM drafts ORDER BY id DESC').all(),env.DB.prepare('SELECT * FROM expenses ORDER BY id DESC LIMIT 100').all(),env.DB.prepare("SELECT * FROM tasks WHERE status<>'merged' ORDER BY id DESC LIMIT 40").all(),spend(env)]);
 return json({niches:niches.results,drafts:drafts.results.map(d=>{let m=[];try{m=JSON.parse(d.mockups||'[]')}catch{}return {...d,mockups:m}}),expenses:expenses.results,tasks:tasks.results,budget,integrations:{etsy:env.ETSY_API_KEY?'api_key_search':'not_configured',printify:env.PRINTIFY_API_TOKEN?'read_only':'not_configured',tiktok:'not_authorized'},automation:{research:env.ETSY_API_KEY?'etsy search + scoring (daily, opt-in)':'daily task prompt only',drafting:env.ANTHROPIC_API_KEY?'ai concepts under AI_HARD_LIMIT_USD':'template concepts',publishing:'disabled',fulfillment:'managed manually in Printify'}});
 }
 let b={};if(m==='POST'){try{b=await req.json()}catch{return json({error:'Invalid JSON'},400)}}
 if(m==='POST'&&p==='/api/niches'){
 const name=txt(b.name,120).trim();if(!name)return json({error:'Name required'},400);
 const keys=['demand','competition','margin','longevity','simplicity'];const vals=keys.map(k=>b[k]==null||b[k]===''?null:num(b[k],0,10));if(vals.some((v,i)=>b[keys[i]]!==''&&b[keys[i]]!=null&&v===null))return json({error:'Scores must be 0–10'},400);
 try{await env.DB.prepare('INSERT INTO niches(name,demand,competition,margin,longevity,simplicity,evidence,evidence_url,status) VALUES(?,?,?,?,?,?,?,?,?)').bind(name,...vals,txt(b.evidence),txt(b.evidence_url,500),b.evidence?'evaluating':'research').run();return json({ok:true})}catch{return json({error:'Duplicate niche or database error'},400)}
 }
 if(m==='POST'&&p==='/api/niches/score'){
 const id=num(b.id,1,1e9);if(!id)return json({error:'Invalid ID'},400);
 const keys=['demand','competition','margin','longevity','simplicity'];const vals=keys.map(k=>b[k]===''||b[k]==null?null:num(b[k],0,10));if(vals.some((v,i)=>b[keys[i]]!==''&&b[keys[i]]!=null&&v===null))return json({error:'Scores must be 0–10'},400);
 await env.DB.prepare('UPDATE niches SET demand=?,competition=?,margin=?,longevity=?,simplicity=?,evidence=?,evidence_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(...vals,txt(b.evidence),txt(b.evidence_url,500),b.evidence?'evaluating':'research',id).run();return json({ok:true});
 }
 if(m==='POST'&&p==='/api/drafts'){
 const product=txt(b.product_name,180).trim(),pr=num(b.selling_price,0,100000),co=num(b.production_cost,0,100000),sh=num(b.shipping_cost,0,100000),ot=num(b.other_cost||0,0,100000);
 if(!product||[pr,co,sh,ot].some(x=>x===null))return json({error:'Valid product name, price and costs required'},400);
 await env.DB.prepare('INSERT INTO drafts(niche_id,product_name,description,selling_price,production_cost,shipping_cost,other_cost) VALUES(?,?,?,?,?,?,?)').bind(b.niche_id?num(b.niche_id,1,1e9):null,product,txt(b.description,3000),pr,co,sh,ot).run();return json({ok:true});
 }
 if(m==='POST'&&p==='/api/drafts/status'){
 const id=num(b.id,1,1e9),status=txt(b.status);if(!id||!['draft','approved','rejected'].includes(status))return json({error:'Invalid draft/status'},400);
 try{const r=status==='approved'?await approveDraft(env,id,{acknowledgeRisk:b.acknowledge_risk===true}):status==='rejected'?await rejectDraft(env,id):await reopenDraft(env,id);return json(r.body,r.status)}catch(e){return json({error:e.message||'Request failed'},502)}
 }
 if(m==='POST'&&p==='/api/expenses'){
 const a=num(b.amount,0,100000);if(a===null||!txt(b.service).trim())return json({error:'Valid service and amount required'},400);
 const bud=await spend(env);if(bud.spent+a>bud.budget)return json({error:`Blocked: monthly $${bud.budget} ceiling exceeded.`,spent:bud.spent},409);
 await env.DB.prepare('INSERT INTO expenses(service,amount,month,note) VALUES(?,?,?,?)').bind(txt(b.service,100),a,month(),txt(b.note,500)).run();return json({ok:true});
 }
 if(m==='POST'&&p==='/api/tasks/status'){
 const id=num(b.id,1,1e9),status=txt(b.status);if(!id||!['open','done'].includes(status))return json({error:'Invalid task/status'},400);
 await env.DB.prepare('UPDATE tasks SET status=? WHERE id=?').bind(status,id).run();return json({ok:true});
 }
 return json({error:'Not found'},404);
}
// The login form posts to itself; with no-referrer Chrome sends `Origin: null` and the same-origin check refuses it.
const htmlRes=(body,status=200,extra={})=>new Response(body,{status,headers:{...h,'referrer-policy':'same-origin',...extra}});
const redirect=(to,extra={})=>new Response(null,{status:303,headers:{location:to,'cache-control':'no-store',...extra}});
export default {async fetch(request,env,ctx){try{
 const url=new URL(request.url),p=url.pathname,m=request.method,sameOrigin=request.headers.get('Origin')===url.origin;
 if(p.startsWith('/api/studio/agent/'))return await handleStudioAgent(request,env); // Mac agent: dedicated token (+ Access service token on workers.dev)
 if(p.startsWith('/api/lab/agent/'))return await handleLabAgent(request,env); // Mac mini lab mirror: LAB_AGENT_TOKEN (+ Access service token)
 if(p==='/health'&&m==='GET')return json({ok:true,service:'Business HQ',mode:'research-and-approval-only'});
 await ensureAuth(env);
 if(p==='/login'){
  if(m==='GET'){if(await sessionFromRequest(request,env))return redirect(safeNext(url.searchParams.get('next')));return htmlRes(loginPage({next:safeNext(url.searchParams.get('next')),ready:configured(env)}))}
  if(m==='POST'){
   if(!sameOrigin)return htmlRes(loginPage({error:'Same-origin request required.'}),403);
   if(!configured(env))return htmlRes(loginPage({ready:false}),503);
   if(!hashCheckable(env))return htmlRes(loginPage({error:'The saved HQ password can’t be checked by Cloudflare. Run node scripts/set-password.mjs again, then sign in.'}),503);
   const addr=ip(request);
   if(await rateLimited(env,addr))return htmlRes(loginPage({error:'Too many sign-in attempts. Try again in 15 minutes.'}),429,{'retry-after':'900'});
   const {password,next}=await readLoginForm(request);
   if(await verifyPassword(env,password)){await clearFailures(env,addr);return redirect(next,{'set-cookie':await createSession(request,env)})}
   await recordFailure(env,addr);return htmlRes(loginPage({error:'Incorrect password.',next}),401);
  }
  return json({error:'Method not allowed'},405);
 }
 if(p==='/logout'){if(m!=='POST')return json({error:'Method not allowed'},405);if(!sameOrigin)return json({error:'Same-origin request required.'},403);return redirect('/login',{'set-cookie':await destroySession(request,env)})}
 let identity=null;const session=await sessionFromRequest(request,env);
 if(session)identity={email:'owner@hq',via:'session'};
 else if(ctx?.access?.getIdentity){const id=await ctx.access.getIdentity().catch(()=>null);if(id?.email)identity={email:id.email,via:'access'}} // Cloudflare Access still fronts the workers.dev hostname
 if(!identity){if(p.startsWith('/api/'))return json({error:'Sign-in required.',login:'/login'},401);return redirect('/login?next='+encodeURIComponent(p+url.search))}
 if(m!=='GET'&&m!=='HEAD'&&!sameOrigin)return json({error:'Same-origin request required.'},403);
 return await route(request,env,identity,ctx)
}catch(err){return json({error:'Server error',message:'Check database setup or Worker logs.'},500)}},async scheduled(event,env){const budget=(event.scheduledTime||Date.now())+13*60*1000;if(event.cron==='*/10 * * * *'){await scheduledHealth(env).catch(()=>{});const min=new Date(event.scheduledTime).getUTCMinutes();if(min===10||min===50){const auto=await env.DB.prepare("SELECT detail FROM events WHERE event_type='commerce.etsy.automatic' ORDER BY id DESC LIMIT 1").first().catch(()=>null);let on=false;try{on=!!JSON.parse(auto?.detail||'{}').enabled}catch{}if(on)await catchUp(env,{deadline:budget}).catch(()=>{});return}if(min!==30)return;await scheduledContent(env);await scheduledPersonalize(env).catch(()=>{});await notifyNeeds(env).catch(()=>{});return;}if(event.cron==='0 */6 * * *'){await Promise.allSettled([scheduledCommerce(env),scheduledJobs(env),syncPublishing(env),scheduledAgency(env),syncFreeShipping(env),retireReplaced(env)]);await scheduledPromo(env);await scheduledHero(env,{deadline:budget});await scheduledAttach(env);await scheduledStats(env);await notifyNeeds(env).catch(()=>{});return;}await rollTasks(env);await scheduledScout(env);await scheduledEtsy(env);await scheduledPublish(env);await scheduledHero(env,{deadline:budget});await scheduledAttach(env);await notifyNeeds(env).catch(()=>{});},async email(message,env,ctx){await handleInbound(message,env);await notifyNeeds(env).catch(()=>{})}}

