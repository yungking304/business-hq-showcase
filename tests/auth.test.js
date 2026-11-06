import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {hashPassword,verifyPassword,timingSafeEqual,safeNext,ensureAuth,createSession,sessionFromRequest,parseCookie} from '../src/auth.js';
function env(extra={}){const db=new DatabaseSync(':memory:');const DB={prepare(sql){let vals=[];const s={bind(...v){vals=v;return s},async run(){const r=db.prepare(sql).run(...vals);return {meta:{changes:r.changes}}},async first(){return db.prepare(sql).get(...vals)||null},async all(){return {results:db.prepare(sql).all(...vals)}}};return s}};return {DB,db,...extra}}
const cookieOf=r=>(r.headers.get('set-cookie')||'').split(';')[0];
const form=(password,headers={})=>new Request('https://hq.example/login',{method:'POST',headers:{Origin:'https://hq.example','content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({password,next:'/#jobs'}).toString()});
async function worker(){
 let src=readFileSync(new URL('../src/index.js',import.meta.url),'utf8').replace("import html from './ui.html.txt';","const html='ui';").replace("import appjs from './client.js.txt';","const appjs='app';").replace("import jobsjs from './jobs-client.js.txt';","const jobsjs='jobs';").replace("import agencyjs from './agency-client.js.txt';","const agencyjs='agency';").replace("import studiojs from './studio-client.js.txt';","const studiojs='studio';");
 const path=new URL('../src/.test-index-auth.mjs',import.meta.url);writeFileSync(path,src);try{return (await import(path.href)).default}finally{unlinkSync(path)}
}
test('password hashes verify with PBKDF2 and reject wrong or malformed input',async()=>{
 const h=await hashPassword('correct horse battery',20000);assert.match(h,/^pbkdf2-sha256\$20000\$/);
 assert.equal(await verifyPassword({HQ_PASSWORD_HASH:h},'correct horse battery'),true);
 assert.equal(await verifyPassword({HQ_PASSWORD_HASH:h},'correct horse batter'),false);
 assert.equal(await verifyPassword({HQ_PASSWORD_HASH:'garbage'},'x'),false);
 assert.equal(await verifyPassword({HQ_PASSWORD:'plain'},'plain'),true);
 assert.equal(await verifyPassword({HQ_PASSWORD:'plain'},'Plain'),false);
 assert.equal(await verifyPassword({},'anything'),false);
 assert.equal(timingSafeEqual('abc','abc'),true);assert.equal(timingSafeEqual('abc','abd'),false);assert.equal(timingSafeEqual('abc','ab'),false);
 assert.equal(safeNext('/#jobs'),'/#jobs');assert.equal(safeNext('//evil.com'),'/');assert.equal(safeNext('https://evil.com'),'/');assert.equal(safeNext(null),'/');
});
test('dashboard and APIs are closed without a session; login opens them; logout revokes',async()=>{
 const w=await worker();const e=env({HQ_PASSWORD_HASH:await hashPassword('open sesame',20000)});
 assert.equal((await w.fetch(new Request('https://hq.example/'),e,{})).status,303);
 assert.equal((await w.fetch(new Request('https://hq.example/api/overview'),e,{})).status,401);
 assert.equal((await w.fetch(new Request('https://hq.example/health'),e,{})).status,200);
 assert.equal((await w.fetch(new Request('https://hq.example/login'),e,{})).headers.get('referrer-policy'),'same-origin','the form must send its real Origin');
 const bad=await w.fetch(form('wrong'),e,{});assert.equal(bad.status,401);assert.equal(bad.headers.get('set-cookie'),null);
 const ok=await w.fetch(form('open sesame'),e,{});assert.equal(ok.status,303);assert.equal(ok.headers.get('location'),'/#jobs');
 const c=cookieOf(ok);assert.match(c,/^__Host-hq_session=[a-f0-9]{64}$/);assert.match(ok.headers.get('set-cookie'),/HttpOnly/);assert.match(ok.headers.get('set-cookie'),/Secure/);
 assert.equal((await w.fetch(new Request('https://hq.example/'),e,{})).status,303);
 const page=await w.fetch(new Request('https://hq.example/classic',{headers:{Cookie:c}}),e,{});assert.equal(page.status,200);assert.equal(await page.text(),'ui');
 const home=await w.fetch(new Request('https://hq.example/',{headers:{Cookie:c}}),e,{});assert.equal(home.status,200);assert.match(await home.text(),/<title>HQ<\/title>/);
 assert.equal((await w.fetch(new Request('https://hq.example/login',{headers:{Cookie:c}}),e,{})).status,303);
 assert.equal((await w.fetch(new Request('https://hq.example/logout',{method:'POST',headers:{Cookie:c}}),e,{})).status,403);
 const out=await w.fetch(new Request('https://hq.example/logout',{method:'POST',headers:{Cookie:c,Origin:'https://hq.example'}}),e,{});assert.equal(out.status,303);assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await w.fetch(new Request('https://hq.example/',{headers:{Cookie:c}}),e,{})).status,303);
 assert.equal(e.db.prepare('SELECT COUNT(*) n FROM hq_sessions').get().n,0);
 const forged=await w.fetch(new Request('https://hq.example/api/overview',{headers:{Cookie:'__Host-hq_session='+'f'.repeat(64)}}),e,{});assert.equal(forged.status,401);
});
test('login is rate limited per IP and refuses cross-origin posts; Access identity still accepted',async()=>{
 const w=await worker();const e=env({HQ_PASSWORD:'pw'});
 for(let i=0;i<5;i++)assert.equal((await w.fetch(form('nope',{'CF-Connecting-IP':'1.1.1.1'}),e,{})).status,401);
 assert.equal((await w.fetch(form('pw',{'CF-Connecting-IP':'1.1.1.1'}),e,{})).status,429);
 assert.equal((await w.fetch(form('pw',{'CF-Connecting-IP':'2.2.2.2'}),e,{})).status,303);
 const cross=new Request('https://hq.example/login',{method:'POST',headers:{Origin:'https://evil.example','content-type':'application/x-www-form-urlencoded'},body:'password=pw'});
 assert.equal((await w.fetch(cross,e,{})).status,403);
 assert.equal((await w.fetch(new Request('https://hq.example/health'),env({}),{})).status,200);
 const unset=await w.fetch(form('pw'),env({}),{});assert.equal(unset.status,503);
 const viaAccess=await w.fetch(new Request('https://hq.example/'),e,{access:{getIdentity:async()=>({email:'owner@example.com'})}});assert.equal(viaAccess.status,200);
});
test('sessions expire and are not shared between hostnames',async()=>{
 const e=env();await ensureAuth(e);const set=await createSession(new Request('https://a.example/'),e);const cookie=set.split(';')[0];
 assert.ok(await sessionFromRequest(new Request('https://b.example/',{headers:{Cookie:cookie}}),e));
 e.db.prepare('UPDATE hq_sessions SET expires=?').run(Date.now()-1);
 assert.equal(await sessionFromRequest(new Request('https://a.example/',{headers:{Cookie:cookie}}),e),null);
 assert.deepEqual(parseCookie(new Request('https://a.example/',{headers:{Cookie:'a=1; b=2'}})),{a:'1',b:'2'});
});

test('a password saved with more PBKDF2 iterations than Workers allow asks to be set again instead of crashing',async()=>{
 const w=await worker();const e=env({HQ_PASSWORD_HASH:await hashPassword('open sesame',310000)});
 const r=await w.fetch(form('open sesame'),e,{});assert.equal(r.status,503);assert.match(await r.text(),/set-password\.mjs again/);
 const ok=env({HQ_PASSWORD_HASH:await hashPassword('open sesame')});assert.equal((await w.fetch(form('open sesame'),ok,{})).status,303,'the default (100,000) signs in');
});
