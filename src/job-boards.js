// Public read-only ATS feeds. Tokens select a path on these fixed hosts only.
const providers=new Set(['greenhouse','lever','ashby']);
const tokenPattern=/^[a-zA-Z0-9_-]{1,80}$/;
export function boardKey(source){return source.provider==='greenhouse'||!source.provider?source.token||source.id:source.provider+':'+(source.token||source.id)}
export function parseBoard(input){
 let provider=input.provider||'greenhouse',token=String(input.token||'').trim();
 if(/^https:\/\//i.test(token)){
  const u=new URL(token);if(u.username||u.password||u.port||u.search||u.hash)throw Error('Use a public board URL without credentials, query or fragment.');
  const host=u.hostname.toLowerCase(),parts=u.pathname.split('/').filter(Boolean);
  if(['boards.greenhouse.io','job-boards.greenhouse.io'].includes(host)&&parts.length===1){provider='greenhouse';token=parts[0]}
  else if(host==='jobs.lever.co'&&parts.length===1){provider='lever';token=parts[0]}
  else if(host==='jobs.ashbyhq.com'&&parts.length===1){provider='ashby';token=parts[0]}
  else throw Error('Use a Greenhouse, Lever or Ashby employer board URL.');
 }
 if(!providers.has(provider)||!tokenPattern.test(token))throw Error('Choose a supported board and a valid employer token.');
 return {id:provider==='greenhouse'?token:provider+':'+token,provider,token,name:String(input.name||'').trim().slice(0,100)};
}
export function boardUrl(s){const token=encodeURIComponent(s.token||s.id);return s.provider==='lever'?'https://jobs.lever.co/'+token:s.provider==='ashby'?'https://jobs.ashbyhq.com/'+token:'https://job-boards.greenhouse.io/'+token}
export function feedUrl(s){const token=encodeURIComponent(s.token||s.id);return s.provider==='lever'?'https://api.lever.co/v0/postings/'+token+'?mode=json':s.provider==='ashby'?'https://api.ashbyhq.com/posting-api/job-board/'+token+'?includeCompensation=true':'https://boards-api.greenhouse.io/v1/boards/'+token+'/jobs?content=true'}
export function normalizeBoard(source,data,{plain,safeUrl}){
 const provider=source.provider||'greenhouse',raw=provider==='lever'?data:data?.jobs;
 if(!Array.isArray(raw)||raw.length>2000||raw.some(j=>!j||typeof j!=='object'||j.id===undefined||j.id===null||!String(j.id)))throw Error('Unexpected or oversized employer board.');
 const txt=(v,n=20000)=>String(v??'').slice(0,n),key=boardKey(source);
 return raw.filter(j=>provider!=='ashby'||j.isListed!==false).map(j=>{
  let title,location,url,description;
  if(provider==='lever'){
   title=j.text;location=[j.categories?.location,j.workplaceType].filter(Boolean).join(' · ');url=j.hostedUrl;
   const salary=j.salaryRange;
   description=[j.descriptionPlain||j.description,...(j.lists||[]).map(x=>x.text+' '+x.content),j.additionalPlain||j.additional,j.categories?.commitment?'Employment type: '+j.categories.commitment:'',salary&&Number.isFinite(salary.min)&&Number.isFinite(salary.max)?`Compensation: ${salary.currency||''} ${salary.min}–${salary.max} ${salary.interval||''}`:''].filter(Boolean).join('\n');
  }else if(provider==='ashby'){
   title=j.title;location=[j.location,j.isRemote?'Remote':'',j.workplaceType].filter(Boolean).join(' · ');url=j.jobUrl;
   description=[j.descriptionPlain||j.descriptionHtml,j.employmentType?'Employment type: '+j.employmentType:'',j.compensation?.compensationTierSummary].filter(Boolean).join('\n');
  }else{title=j.title;location=j.location?.name;url=j.absolute_url;description=j.content}
  return {id:key+':'+txt(j.id,100),source:key,company:source.name,title:txt(title,200),location:txt(location,300),url:safeUrl(url),description:plain(description)};
 });
}
