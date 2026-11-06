import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {encryptPayload,vapidHeader,b64u,notifyAll,notifyNeeds,handlePush} from '../src/push.js';
import {mobileAsset} from '../src/today.js';
function env(extra={}){const db=new DatabaseSync(':memory:');const DB={prepare(sql){let vals=[];const s={bind(...v){vals=v;return s},async run(){const r=db.prepare(sql).run(...vals);return {meta:{changes:r.changes}}},async first(){return db.prepare(sql).get(...vals)||null},async all(){return {results:db.prepare(sql).all(...vals)}}};return s}};return {DB,db,...extra}}
async function withFetch(fn,run){const o=globalThis.fetch;globalThis.fetch=fn;try{return await run()}finally{globalThis.fetch=o}}
async function vapidEnv(){const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',k.privateKey);
 return {keys:k,VAPID_PRIVATE_JWK:JSON.stringify({d:jwk.d,x:jwk.x,y:jwk.y}),VAPID_PUBLIC_KEY:b64u.to(await crypto.subtle.exportKey('raw',k.publicKey))}}
async function browserSub(){const k=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);const auth=crypto.getRandomValues(new Uint8Array(16));
 return {keys:k,sub:{p256dh:b64u.to(await crypto.subtle.exportKey('raw',k.publicKey)),auth:b64u.to(auth)}}}
// Receiver side of RFC 8291, independent of the sender code paths.
async function decrypt(body,ua,sub){
 const salt=body.slice(0,16),idlen=body[20],asPub=body.slice(21,21+idlen),ct=body.slice(21+idlen);
 const h=async(ikm,s,info,n)=>new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:s,info:new TextEncoder().encode(info)},await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']),n*8));
 const as=await crypto.subtle.importKey('raw',asPub,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:as},ua.privateKey,256));
 const uaPub=b64u.from(sub.p256dh);const info=new Uint8Array([...new TextEncoder().encode('WebPush: info\0'),...uaPub,...asPub]);
 const ikm=new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:b64u.from(sub.auth),info},await crypto.subtle.importKey('raw',ecdh,'HKDF',false,['deriveBits']),256));
 const key=await crypto.subtle.importKey('raw',await h(ikm,salt,'Content-Encoding: aes128gcm\0',16),'AES-GCM',false,['decrypt']);
 const pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:await h(ikm,salt,'Content-Encoding: nonce\0',12)},key,ct));
 assert.equal(pt[pt.length-1],2);return new TextDecoder().decode(pt.slice(0,-1));
}

test('payload encryption matches the RFC 8291 test vector byte for byte',async()=>{
 const asJwk={kty:'EC',crv:'P-256',d:'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'};const asPub=b64u.from('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
 asJwk.x=b64u.to(asPub.slice(1,33));asJwk.y=b64u.to(asPub.slice(33));
 const as={privateKey:await crypto.subtle.importKey('jwk',asJwk,{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']),publicKey:await crypto.subtle.importKey('raw',asPub,{name:'ECDH',namedCurve:'P-256'},true,[])};
 const body=await encryptPayload('When I grow up, I want to be a watermelon',{p256dh:'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',auth:'BTBZMqHH6r4Tts7J_aSIgg'},{as,salt:b64u.from('DGv6ra1nlYgDCS1FRnbzlw')});
 assert.equal(b64u.to(body),'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('a fresh payload decrypts on the receiving side',async()=>{
 const {keys,sub}=await browserSub();
 assert.equal(await decrypt(await encryptPayload('{"title":"Needs you"}',sub),keys,sub),'{"title":"Needs you"}');
});

test('VAPID header: ES256 JWT for the push service origin, verifiable with the public key',async()=>{
 const v=await vapidEnv();const h=await vapidHeader('https://web.push.apple.com/QGx2abc',{...v,VAPID_SUBJECT:'https://hq.example'},Date.UTC(2026,10,1));
 const [,jwt,k]=h.match(/^vapid t=([^,]+), k=(.+)$/);assert.equal(k,v.VAPID_PUBLIC_KEY);
 const [hd,pl,sig]=jwt.split('.');const claims=JSON.parse(new TextDecoder().decode(b64u.from(pl)));
 assert.equal(claims.aud,'https://web.push.apple.com');assert.equal(claims.sub,'https://hq.example');assert.equal(claims.exp,Date.UTC(2026,10,1)/1000+43200);
 assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},v.keys.publicKey,b64u.from(sig),new TextEncoder().encode(hd+'.'+pl)),true);
});

test('subscribe only accepts real push services and well-formed keys',async()=>{
 const e=env();const {sub}=await browserSub();
 const post=b=>handlePush(new Request('https://hq.example/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}),e);
 assert.equal((await post({endpoint:'https://evil.example/hook',keys:sub})).status,400);
 assert.equal((await post({endpoint:'http://web.push.apple.com/x',keys:sub})).status,400);
 assert.equal((await post({endpoint:'https://web.push.apple.com/QGx2abc',keys:{p256dh:'x',auth:sub.auth}})).status,400);
 assert.equal((await post({endpoint:'https://web.push.apple.com/QGx2abc',keys:sub})).status,200);
 assert.equal((await post({endpoint:'https://web.push.apple.com/QGx2abc',keys:sub})).status,200); // re-subscribing is an upsert
 assert.equal(e.db.prepare('SELECT COUNT(*) n FROM push_subs').get().n,1);
});

test('send: encrypted body and VAPID auth go to the endpoint; expired subscriptions are removed',async()=>{
 const v=await vapidEnv();const e=env(v);const a=await browserSub(),b=await browserSub();
 for(const [ep,s] of [['https://web.push.apple.com/live',a.sub],['https://web.push.apple.com/gone',b.sub]])await handlePush(new Request('https://hq.example/api/push/subscribe',{method:'POST',body:JSON.stringify({endpoint:ep,keys:s})}),e);
 const seen=[];
 const r=await withFetch(async(url,init)=>{seen.push({url,init});return new Response(null,{status:url.endsWith('gone')?410:201})},()=>notifyAll(e,{title:'HQ',body:'hi'}));
 assert.deepEqual(r,{sent:1,failed:1});
 const live=seen.find(x=>x.url.endsWith('live'));assert.equal(live.init.headers['content-encoding'],'aes128gcm');assert.match(live.init.headers.authorization,/^vapid t=/);
 assert.equal(JSON.parse(await decrypt(live.init.body,a.keys,a.sub)).body,'hi');
 assert.deepEqual(e.db.prepare('SELECT endpoint FROM push_subs').all().map(x=>x.endpoint),['https://web.push.apple.com/live']);
});

test('needs pings only when a count goes up, and hold back during quiet hours without losing it',async()=>{
 const v=await vapidEnv();const e=env(v);const {sub}=await browserSub();
 await handlePush(new Request('https://hq.example/api/push/subscribe',{method:'POST',body:JSON.stringify({endpoint:'https://web.push.apple.com/me',keys:sub})}),e);
 e.db.exec("CREATE TABLE agency_leads (id TEXT, status TEXT)");const packets=n=>{e.db.exec('DELETE FROM agency_leads');for(let i=0;i<n;i++)e.db.prepare("INSERT INTO agency_leads VALUES (?,'packet')").run('l'+i)};
 const noon=new Date('2026-11-02T18:00:00Z'),night=new Date('2026-11-03T05:00:00Z'),morning=new Date('2026-11-03T14:00:00Z'); // 12pm, 11pm, 8am Central
 let sends=0;const run=at=>withFetch(async()=>{sends++;return new Response(null,{status:201})},()=>notifyNeeds(e,at));
 packets(2);assert.equal((await run(noon)).sent,1);
 assert.equal((await run(noon)).sent,0); // nothing new
 packets(1);assert.equal((await run(noon)).sent,0); // going down never pings
 packets(4);assert.deepEqual(await run(night),{skipped:'quiet hours'});
 assert.equal((await run(morning)).sent,1);assert.equal(sends,2);
});

test('service worker and the notifications card are served',async()=>{
 const sw=mobileAsset('/sw.js');assert.match(sw.headers.get('content-type'),/javascript/);assert.match(await sw.text(),/showNotification/);
 const page=await mobileAsset('/m/today').text();assert.match(page,/id="push-on"/);assert.match(mobileAsset('/m/today').headers.get('content-security-policy'),/worker-src 'self'/);
});
