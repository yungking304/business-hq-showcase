// Shared look for the app pages (Studio, Etsy, Cerulane, Jobs): the same dock as Home, a header with the app's icon,
// a one-line status and the main action, number tiles, tabs, and a work column with a context column beside it.
// Each app ships its own client script at /m/<app>.js; CLIENT_HELPERS gives every one the same small toolkit.

export const ICONS={
 home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
 studio:'<rect x="3" y="5" width="13" height="14" rx="3"/><path d="M16 10l5-3v10l-5-3"/>',
 etsy:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
 cerulane:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 7v6M14 10h6"/>',
 jobs:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M9 7V5h6v2"/>',
 lab:'<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>',
 money:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
 classic:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
 pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
};
export const svg=k=>`<svg viewBox="0 0 24 24">${ICONS[k]}</svg>`;
// [key, label, href, gradient class]; Home and every app page use this list so the dock never disagrees with itself.
export const APPS=[['home','Home','/','g-home'],['studio','Social','/m/social','g-studio'],['etsy','Etsy','/m/etsy','g-etsy'],['cerulane','Cerulane','/m/cerulane','g-cer'],['jobs','Jobs','/m/jobs','g-jobs'],['lab','Crypto Lab','/m/lab','g-lab'],['money','Spend','/classic#budget','g-money']];
// Accent glow behind each app's page, matching its icon.
const GLOW={studio:'rgba(245,181,68,.12)',etsy:'rgba(255,138,76,.11)',cerulane:'rgba(96,165,250,.12)',jobs:'rgba(94,234,212,.10)',home:'rgba(245,181,68,.10)'};

export const SHELL_CSS=`:root{--bg:#07080b;--card:rgba(255,255,255,.045);--card2:rgba(255,255,255,.07);--line:rgba(255,255,255,.08);--text:#f5f6f8;--muted:#8b909c;--dim:#5d626d;--green:#34d399;--amber:#fbbf24;--red:#f87171;--blue:#60a5fa;--candle:#f5b544}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Inter","Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
body{min-height:100vh;background:radial-gradient(900px 500px at 85% -10%,var(--glow),transparent 60%),radial-gradient(800px 600px at -10% 20%,rgba(96,165,250,.07),transparent 60%),var(--bg);background-attachment:fixed}
a{color:inherit;text-decoration:none}button,input,select,textarea{font:inherit;color:inherit}
.app{display:grid;grid-template-columns:84px 1fr;min-height:100vh}
.dock{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;gap:14px;padding:22px 0;border-right:1px solid var(--line);background:rgba(0,0,0,.25);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);z-index:5}
.logo{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#fff,#c9ccd3);color:#07080b;display:grid;place-items:center;font-weight:800;font-size:15px;letter-spacing:-.5px;margin-bottom:10px}
.ic{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;position:relative;flex:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 6px 16px rgba(0,0,0,.35);transition:transform .15s}
.ic:hover{transform:translateY(-2px)}.ic:active{transform:scale(.94)}
.ic svg{width:22px;height:22px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.dock .ic.on::after{content:"";position:absolute;left:-19px;top:13px;width:4px;height:20px;border-radius:2px;background:#fff}
.badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:var(--red);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;padding:0 5px;border:2px solid var(--bg)}
.g-home{background:linear-gradient(135deg,#3a3f4b,#1d2027)}.g-studio{background:linear-gradient(135deg,#f7c35f,#e8892b)}.g-etsy{background:linear-gradient(135deg,#ff8a4c,#e2522a)}.g-cer{background:linear-gradient(135deg,#4fa3ff,#2563eb)}.g-jobs{background:linear-gradient(135deg,#5eead4,#0d9488)}.g-lab{background:linear-gradient(135deg,#c4b5fd,#7c3aed)}.g-money{background:linear-gradient(135deg,#86efac,#16a34a)}.g-set{background:linear-gradient(135deg,#9ca3af,#4b5563)}
.dock .sp{flex:1}
main{padding:30px 40px 60px;max-width:1380px;width:100%;min-width:0}
.crumb{color:var(--muted);font-size:13px;margin-bottom:14px}.crumb a:hover{color:var(--text)}.crumb b{color:#c9ccd3;font-weight:500}
.head{display:flex;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap}
.head>.ic{width:56px;height:56px;border-radius:17px}.head>.ic svg{width:26px;height:26px}
.head h1{margin:0;font-size:32px;letter-spacing:-.8px}.head .status{margin:3px 0 0;color:var(--muted);font-size:14px;display:flex;align-items:center;gap:8px}
.head .acts{margin-left:auto;display:flex;gap:10px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:999px;font-size:13.5px;font-weight:600;background:var(--card2);border:1px solid var(--line);color:var(--text);white-space:nowrap;cursor:pointer}
.btn:hover{background:rgba(255,255,255,.1)}.btn:disabled{opacity:.5;cursor:default}
.btn.go{background:#fff;color:#07080b;border-color:#fff}.btn.sm{padding:6px 12px;font-size:12.5px}.btn.ok{background:rgba(52,211,153,.15);color:var(--green);border-color:transparent}.btn.bad{background:rgba(248,113,113,.12);color:var(--red);border-color:transparent}
.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px rgba(52,211,153,.18);display:inline-block;flex:none}.dot.amber{background:var(--amber);box-shadow:0 0 0 3px rgba(251,191,36,.18)}.dot.red{background:var(--red);box-shadow:0 0 0 3px rgba(248,113,113,.18)}.dot.gray{background:var(--dim);box-shadow:none}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px 18px;min-width:0}
.kpi .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600}.kpi b{display:block;font-size:30px;letter-spacing:-1px;margin-top:6px}.kpi small{color:var(--muted);font-size:12.5px}
.up{color:var(--green)}.down{color:var(--red)}
.tabs{display:inline-flex;gap:2px;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:14px;padding:4px;margin-bottom:18px;max-width:100%;overflow-x:auto}
.tabs button{border:0;background:none;padding:8px 15px;border-radius:10px;font-size:13.5px;color:var(--muted);font-weight:500;cursor:pointer;white-space:nowrap}.tabs button.on{background:#fff;color:#07080b;font-weight:600}
.tabs i{font-style:normal;margin-left:6px;font-size:11.5px;padding:1px 6px;border-radius:999px;background:rgba(255,255,255,.1)}.tabs .on i{background:rgba(0,0,0,.08)}
.cols{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;align-items:start}
.w{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:20px 22px;min-width:0}
.w h2{margin:0 0 14px;font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1.1px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.w h2 .x{text-transform:none;letter-spacing:0;color:var(--dim);font-weight:500;font-size:13px}
.stack{display:grid;gap:18px;min-width:0}
.row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.row:first-child,.w h2+.row{border-top:0;padding-top:2px}
.row .t{min-width:0;flex:1}.row b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row small{color:var(--muted);font-size:12.5px;display:block}
.row .r{margin-left:auto;display:flex;gap:8px;align-items:center;flex:none}
.tag{display:inline-block;font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(251,191,36,.12);color:var(--amber);font-weight:600;white-space:nowrap}.tag.g{background:rgba(52,211,153,.12);color:var(--green)}.tag.b{background:rgba(96,165,250,.14);color:var(--blue)}.tag.r{background:rgba(248,113,113,.14);color:var(--red)}.tag.n{background:rgba(255,255,255,.07);color:#c9ccd3}
.av{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:14px;flex:none;background:#1d1f25}
.bar{height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}.bar i{display:block;height:100%;border-radius:3px;background:var(--blue)}
.empty{color:var(--muted);font-size:14px;padding:6px 0}
.err{background:rgba(248,113,113,.12);color:var(--red);padding:10px 14px;border-radius:12px;margin-bottom:16px;font-size:14px}.hidden{display:none!important}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#fff;color:#07080b;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:30}
.field{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}.input{width:100%;padding:9px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.04)}
.foot{margin-top:22px;color:var(--dim);font-size:12px;text-align:center}.foot a{text-decoration:underline;color:var(--muted)}
.sheet{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:20}
.sheet>div{background:#14161b;border:1px solid var(--line);width:100%;max-width:680px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom))}
@media(min-width:701px){.sheet{align-items:center}.sheet>div{border-radius:22px}}
@media(max-width:1000px){.cols{grid-template-columns:minmax(0,1fr)}}
@media(max-width:700px){
 .app{grid-template-columns:1fr}
 .dock{position:fixed;top:auto;bottom:0;left:0;right:0;height:auto;flex-direction:row;justify-content:space-around;padding:10px 8px calc(10px + env(safe-area-inset-bottom));border-right:0;border-top:1px solid var(--line);gap:0}
 .dock .logo,.dock .sp,.dock .hide-m{display:none}.ic{width:44px;height:44px}.dock .ic.on::after{display:none}
 main{padding:calc(16px + env(safe-area-inset-top)) 16px 120px}
 .head h1{font-size:26px}.head .acts{margin-left:0;width:100%}
 .kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kpi b{font-size:24px}
 .w{padding:16px;border-radius:22px}
}`;

export const pageHeaders={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; media-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
export const scriptHeaders={'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};

export function dock(active){
 return `<nav class="dock" aria-label="Apps"><a class="logo" href="/" aria-label="Home">HQ</a>${APPS.map(([k,label,href,g])=>`<a class="ic ${g}${k===active?' on':''}${k==='money'?' hide-m':''}" href="${href}" title="${label}" aria-label="${label}" data-app="${k}">${svg(k==='cerulane'?'cerulane':k)}</a>`).join('')}<div class="sp"></div><a class="ic g-set hide-m" href="/m/today" title="Checklist &amp; notifications" aria-label="Checklist and notifications">${svg('list')}</a><a class="ic g-set hide-m" href="/classic" title="Classic HQ (all tools)" aria-label="Classic HQ">${svg('classic')}</a></nav>`;
}

// A full app page. `body` goes inside <main>; the app's script loads last and fills it.
export function shellPage({app,title,body,css='',script=app}){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex, nofollow">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="theme-color" content="#07080b">
<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials"><link rel="apple-touch-icon" href="/icon-180.png">
<title>${title} · HQ</title><style>${SHELL_CSS}
body{--glow:${GLOW[app]||GLOW.home}}
${css}</style></head><body><div class="app">${dock(app)}<main><div class="crumb"><a href="/">Home</a> › <b>${title}</b></div>
<p class="err hidden" id="err" role="alert"></p>${body}</main></div><script src="/m/${script}.js"></script></body></html>`;
}

// Standard header markup (server side, so it shows before data loads): icon, title, a status line the script fills
// (#status) and an actions slot (#acts).
export const header=(app,title,g)=>`<div class="head"><div class="ic ${g}">${svg(app)}</div><div><h1>${title}</h1><p class="status" id="status"><span class="dot gray"></span>Loading…</p></div><div class="acts" id="acts"></div></div>`;

// Shared client toolkit, prepended to each app's script: $, esc, api (JSON, 401 → login), toast, fail, n, money, ago,
// tabs(el, items, on, onChange) and kpis(el, [[label,value,sub]]). Plain ES5-style so it runs anywhere.
export const CLIENT_HELPERS=`var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
async function api(path,body){var r=await fetch('/api/'+path,body!==undefined?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'}:{credentials:'same-origin'});
 if(r.status===401){location.href='/login?next='+encodeURIComponent(location.pathname);throw new Error('signed out')}var j=await r.json().catch(function(){return {}});if(!r.ok)throw new Error(j.error||('Request failed ('+r.status+')'));return j}
function fail(e){var m=e&&e.message||String(e);if(m==='signed out')return;var el=$('err');el.textContent=m;el.classList.remove('hidden')}
function toast(m){var t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(function(){t.remove()},2200)}
function n(x){return x==null||x===''?'—':Number(x).toLocaleString()}
function money(x){return '$'+Number(x||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function ago(t){if(!t)return '';var d=Date.parse(String(t).indexOf('T')<0?String(t).replace(' ','T')+'Z':t);var m=Math.round((Date.now()-d)/60000);return m<1?'just now':m<90?m+' min ago':m<2880?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'}
function status(html){$('status').innerHTML=html}
function kpis(el,items){el.innerHTML=items.map(function(k){return '<div class="kpi"><span class="k">'+esc(k[0])+'</span><b>'+k[1]+'</b><small>'+(k[2]||'')+'</small></div>'}).join('')}
function tabs(el,items,on,cb){el.innerHTML=items.map(function(t){return '<button type="button" data-tab="'+esc(t[0])+'" class="'+(t[0]===on?'on':'')+'">'+esc(t[1])+(t[2]!=null&&t[2]!==''?'<i>'+esc(t[2])+'</i>':'')+'</button>'}).join('');
 el.onclick=function(e){var b=e.target.closest('[data-tab]');if(b)cb(b.dataset.tab)}}
`;
