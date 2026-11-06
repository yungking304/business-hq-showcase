// Web push for the phone page: VAPID auth (RFC 8292) + aes128gcm payload encryption (RFC 8291), WebCrypto only.
// Keys: VAPID_PUBLIC_KEY (var, base64url uncompressed P-256 point) and VAPID_PRIVATE_JWK (secret, JWK with d,x,y).
import {needsList,centralHour} from './today.js';

const enc=new TextEncoder();
export const b64u={
 to:u8=>btoa(String.fromCharCode(...new Uint8Array(u8))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
 from:s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(s).length+3)%4)),c=>c.charCodeAt(0)),
};
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length}return o};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
// Only real push services; an endpoint is otherwise an arbitrary URL the Worker would POST to.
const PUSH_HOSTS=/^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;
export const QUIET={from:22,to:7}; // Central time; nothing is sent in this window, it waits for the next run

async function hkdf(ikm,salt,info,bytes){
 const key=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bytes*8));
}

// RFC 8291 §3: one aes128gcm record. `as` (our ephemeral ECDH keys) and `salt` are injectable for the RFC test vector.
export async function encryptPayload(text,{p256dh,auth},{as,salt}={}){
 const uaPublic=b64u.from(p256dh),authSecret=b64u.from(auth);
 as??=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 salt??=crypto.getRandomValues(new Uint8Array(16));
 const asPublic=new Uint8Array(await crypto.subtle.exportKey('raw',as.publicKey));
 const ua=await crypto.subtle.importKey('raw',uaPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:ua},as.privateKey,256));
 const ikm=await hkdf(ecdh,authSecret,cat(enc.encode('WebPush: info\0'),uaPublic,asPublic),32);
 const cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),12);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,cat(enc.encode(text),new Uint8Array([2]))));
 const rs=new Uint8Array([0,0,16,0]); // record size 4096
 return cat(salt,rs,new Uint8Array([asPublic.length]),asPublic,ct);
}

export async function vapidHeader(endpoint,env,now=Date.now()){
 const jwk=JSON.parse(env.VAPID_PRIVATE_JWK);
 const key=await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',d:jwk.d,x:jwk.x,y:jwk.y},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const part=o=>b64u.to(enc.encode(JSON.stringify(o)));
 const unsigned=part({typ:'JWT',alg:'ES256'})+'.'+part({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:env.VAPID_SUBJECT||'https://example.com'});
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned)); // raw r||s, as JWS wants
 return `vapid t=${unsigned}.${b64u.to(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export const configured=env=>!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_JWK);

export async function ensurePush(env){
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY,p256dh TEXT NOT NULL,auth TEXT NOT NULL,agent TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,last_ok TEXT,fails INTEGER NOT NULL DEFAULT 0)").run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS push_state (key TEXT PRIMARY KEY,value TEXT NOT NULL)').run();
}

// Sends to every subscribed device. Gone subscriptions (404/410) are removed; other failures are counted.
export async function notifyAll(env,msg){
 if(!configured(env))return {sent:0,failed:0,skipped:'VAPID keys not set'};
 await ensurePush(env);
 const subs=(await env.DB.prepare('SELECT * FROM push_subs').all()).results;let sent=0,failed=0;
 for(const s of subs){
  try{
   const body=await encryptPayload(JSON.stringify(msg),s);
   const r=await fetch(s.endpoint,{method:'POST',headers:{authorization:await vapidHeader(s.endpoint,env),'content-encoding':'aes128gcm','content-type':'application/octet-stream',ttl:'86400',urgency:'normal'},body});
   if(r.status===404||r.status===410){await env.DB.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(s.endpoint).run();failed++;continue}
   if(r.ok){sent++;await env.DB.prepare('UPDATE push_subs SET last_ok=?,fails=0 WHERE endpoint=?').bind(new Date().toISOString(),s.endpoint).run()}
   else{failed++;await env.DB.prepare('UPDATE push_subs SET fails=fails+1 WHERE endpoint=?').bind(s.endpoint).run()}
  }catch{failed++}
 }
 return {sent,failed};
}

// Pings when any "Needs you" count goes up since the last ping. Quiet hours hold it back without losing it.
export async function notifyNeeds(env,now=new Date()){
 if(!configured(env))return {skipped:'not configured'};
 await ensurePush(env);
 const h=centralHour(now);if(h>=QUIET.from||h<QUIET.to)return {skipped:'quiet hours'};
 const needs=await needsList(env);
 const prev=JSON.parse((await env.DB.prepare("SELECT value FROM push_state WHERE key='needs'").first())?.value||'{}');
 const up=needs.filter(n=>n.count>(prev[n.label]||0));
 await env.DB.prepare("INSERT INTO push_state(key,value) VALUES('needs',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(JSON.stringify(Object.fromEntries(needs.map(n=>[n.label,n.count])))).run();
 if(!up.length)return {sent:0,new:0};
 const top=up.sort((a,b)=>(b.count-(prev[b.label]||0))-(a.count-(prev[a.label]||0)));
 const r=await notifyAll(env,{title:'Needs you',body:top.map(n=>`${n.count} ${n.label.toLowerCase()}`).join(' · '),url:top.length===1?top[0].href:'/m',tag:'needs',badge:needs.reduce((a,n)=>a+n.count,0)});
 return {...r,new:up.length};
}

export async function handlePush(req,env){
 const p=new URL(req.url).pathname,m=req.method;
 if(m==='GET'&&p==='/api/push/key')return json({key:env.VAPID_PUBLIC_KEY||null,configured:configured(env)});
 if(m!=='POST')return json({error:'Not found'},404);
 let b;try{b=await req.json()}catch{return json({error:'Invalid JSON'},400)}
 await ensurePush(env);
 if(p==='/api/push/subscribe'){
  let u;try{u=new URL(String(b?.endpoint))}catch{return json({error:'Invalid subscription'},400)}
  const p256dh=String(b?.keys?.p256dh||''),auth=String(b?.keys?.auth||'');
  if(u.protocol!=='https:'||!PUSH_HOSTS.test(u.hostname)||!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh)||!/^[A-Za-z0-9_-]{16,32}$/.test(auth))return json({error:'Invalid subscription'},400);
  await env.DB.prepare('INSERT INTO push_subs(endpoint,p256dh,auth,agent,created) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,fails=0').bind(u.href,p256dh,auth,String(req.headers.get('User-Agent')||'').slice(0,200),new Date().toISOString()).run();
  return json({ok:true});
 }
 if(p==='/api/push/unsubscribe'){await env.DB.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(String(b?.endpoint||'')).run();return json({ok:true})}
 if(p==='/api/push/test'){const r=await notifyAll(env,{title:'HQ',body:'Notifications are on. You’ll get a ping when something needs you.',url:'/m',tag:'test'});return json(r,r.sent?200:502)}
 return json({error:'Not found'},404);
}
