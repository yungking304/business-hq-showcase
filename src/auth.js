// Server-side password authentication for Business HQ.
// - One owner password, stored only as a Cloudflare Worker secret (HQ_PASSWORD_HASH, PBKDF2-SHA256; HQ_PASSWORD plain is accepted as a fallback).
// - Sessions live in D1 (hq_sessions); the browser only holds a random 256-bit token in a __Host- HttpOnly cookie, so logout really revokes.
// - Failed logins are recorded in D1 (hq_login_attempts) and rate limited per IP and globally.
// - A Cloudflare Access identity (ctx.access on the workers.dev hostname) is still accepted, so the existing Access-protected hostname keeps working.
const COOKIE='__Host-hq_session';
export const SESSION_TTL_MS=7*24*3600*1000;      // absolute lifetime
export const IDLE_TTL_MS=24*3600*1000;           // idle timeout
const WINDOW_MS=15*60*1000,IP_LIMIT=5,GLOBAL_LIMIT=40,PBKDF2_ITERATIONS=100000; // Cloudflare Workers' WebCrypto refuses PBKDF2 above 100,000 iterations
const enc=new TextEncoder();
const b64=u8=>btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=u8=>Array.from(new Uint8Array(u8),b=>b.toString(16).padStart(2,'0')).join('');
export function timingSafeEqual(a,b){const x=enc.encode(String(a)),y=enc.encode(String(b));let d=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i%x.length]||0)^(y[i%y.length]||0);return d===0}
async function sha256(s){return hex(await crypto.subtle.digest('SHA-256',enc.encode(s)))}
export async function pbkdf2(password,salt,iterations=PBKDF2_ITERATIONS){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256));
}
export async function hashPassword(password,iterations=PBKDF2_ITERATIONS){const salt=crypto.getRandomValues(new Uint8Array(16));return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(await pbkdf2(password,salt,iterations))}`}
export function configured(env){return !!(env.HQ_PASSWORD_HASH||env.HQ_PASSWORD)}
// A hash made with more iterations than Workers can compute can never be checked; the login page says to set it again.
export function hashCheckable(env){const n=Number(String(env.HQ_PASSWORD_HASH||'').split('$')[1]);return !env.HQ_PASSWORD_HASH||(Number.isInteger(n)&&n<=PBKDF2_ITERATIONS)}
export async function verifyPassword(env,password){
 if(typeof password!=='string'||!password||password.length>512)return false;
 if(env.HQ_PASSWORD_HASH){
  const [alg,iter,salt,hash]=String(env.HQ_PASSWORD_HASH).trim().split('$');
  if(alg!=='pbkdf2-sha256'||!salt||!hash)return false;
  const n=Number(iter);if(!Number.isInteger(n)||n<10000||n>PBKDF2_ITERATIONS)return false;
  return timingSafeEqual(b64(await pbkdf2(password,unb64(salt),n)),hash);
 }
 if(env.HQ_PASSWORD)return timingSafeEqual(password,env.HQ_PASSWORD);
 return false;
}
export async function ensureAuth(env){
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS hq_sessions (id TEXT PRIMARY KEY,created INTEGER NOT NULL,expires INTEGER NOT NULL,seen INTEGER NOT NULL,agent TEXT NOT NULL DEFAULT \'\')').run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS hq_login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,ip TEXT NOT NULL,at INTEGER NOT NULL)').run();
}
export function ip(req){return req.headers.get('CF-Connecting-IP')||req.headers.get('X-Forwarded-For')?.split(',')[0].trim()||'unknown'}
export function parseCookie(req){const out={};for(const part of (req.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim()}return out}
const cookie=(value,maxAge)=>`${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
export async function sessionFromRequest(req,env){
 const token=parseCookie(req)[COOKIE];if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const id=await sha256(token),now=Date.now();
 const row=await env.DB.prepare('SELECT * FROM hq_sessions WHERE id=?').bind(id).first();
 if(!row)return null;
 if(row.expires<=now||row.seen+IDLE_TTL_MS<=now){await env.DB.prepare('DELETE FROM hq_sessions WHERE id=?').bind(id).run();return null}
 if(now-row.seen>60000)await env.DB.prepare('UPDATE hq_sessions SET seen=? WHERE id=?').bind(now,id).run();
 return {id,created:row.created,expires:row.expires};
}
export async function createSession(req,env){
 const token=hex(crypto.getRandomValues(new Uint8Array(32))),now=Date.now();
 await env.DB.prepare('INSERT INTO hq_sessions(id,created,expires,seen,agent) VALUES(?,?,?,?,?)').bind(await sha256(token),now,now+SESSION_TTL_MS,now,String(req.headers.get('User-Agent')||'').slice(0,200)).run();
 await env.DB.prepare('DELETE FROM hq_sessions WHERE expires<=? OR seen<=?').bind(now,now-IDLE_TTL_MS).run();
 return cookie(token,Math.floor(SESSION_TTL_MS/1000));
}
export async function destroySession(req,env){
 const token=parseCookie(req)[COOKIE];if(token&&/^[a-f0-9]{64}$/.test(token))await env.DB.prepare('DELETE FROM hq_sessions WHERE id=?').bind(await sha256(token)).run();
 return cookie('',0);
}
export async function rateLimited(env,addr){
 const since=Date.now()-WINDOW_MS;
 const r=await env.DB.prepare('SELECT SUM(ip=?) mine,COUNT(*) total FROM hq_login_attempts WHERE at>?').bind(addr,since).first();
 return Number(r?.mine||0)>=IP_LIMIT||Number(r?.total||0)>=GLOBAL_LIMIT;
}
export async function recordFailure(env,addr){
 const now=Date.now();
 await env.DB.prepare('INSERT INTO hq_login_attempts(ip,at) VALUES(?,?)').bind(addr,now).run();
 await env.DB.prepare('DELETE FROM hq_login_attempts WHERE at<=?').bind(now-WINDOW_MS).run();
}
export async function clearFailures(env,addr){await env.DB.prepare('DELETE FROM hq_login_attempts WHERE ip=?').bind(addr).run()}
export function safeNext(v){return typeof v==='string'&&/^\/(?![\/\\])[\x21-\x7e]{0,200}$/.test(v)?v:'/'}
export function loginPage({error='',next='/',ready=true}={}){
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex, nofollow"><title>Sign in · Business HQ</title><style>
:root{--bg:#F5F5F7;--surface:#FFFFFF;--line:#E5E5EA;--text:#1D1D1F;--muted:#6E6E73;--accent:#0066CC;--warn:#C2410C;--warn-soft:#FDF1EA;color-scheme:light dark}
@media(prefers-color-scheme:dark){:root{--bg:#000;--surface:#1C1C1E;--line:#2C2C2E;--text:#F5F5F7;--muted:#98989D;--accent:#0A84FF;--warn:#FF9F0A;--warn-soft:#3A2A10}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;padding:24px}
form{width:100%;max-width:360px;background:var(--surface);border-radius:20px;padding:32px 28px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 0 0 1px rgba(0,0,0,.04);display:flex;flex-direction:column;gap:14px}
.mark{width:36px;height:36px;border-radius:10px;background:var(--text);display:grid;place-items:center;color:var(--bg);font-weight:700}
h1{margin:4px 0 0;font-size:22px;letter-spacing:-.02em}p{margin:0;color:var(--muted);font-size:13px}
label{font-size:12px;font-weight:600;color:var(--muted)}
input{width:100%;height:44px;padding:0 14px;border:1px solid var(--line);border-radius:12px;background:transparent;color:inherit;font:inherit}
button{height:44px;border:0;border-radius:12px;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.err{padding:10px 12px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-size:13px}
</style></head><body><form method="post" action="/login" autocomplete="off"><div class="mark">HQ</div><h1>Business HQ</h1><p>Private workspace. Enter the HQ password to continue.</p>${error?`<div class="err" role="alert">${esc(error)}</div>`:''}${ready?`<label for="pw">Password</label><input id="pw" name="password" type="password" autocomplete="current-password" required autofocus maxlength="512"><input type="hidden" name="next" value="${esc(next)}"><button type="submit">Sign in</button>`:`<div class="err" role="alert">No HQ password has been set yet. Run <code>node scripts/set-password.mjs</code> from the business-hq repo on your Mac, then reload.</div>`}</form></body></html>`;
}
export async function readLoginForm(req){
 const ct=req.headers.get('content-type')||'';let password='',next='/';
 if(ct.includes('application/json')){const b=await req.json().catch(()=>({}));password=b.password;next=b.next}
 else{const f=await req.formData().catch(()=>null);password=f?.get('password');next=f?.get('next')}
 return {password:typeof password==='string'?password:'',next:safeNext(next)};
}
