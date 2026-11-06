import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBoard,feedUrl,normalizeBoard} from '../src/job-boards.js';
import {plain,safeUrl} from '../src/jobs.js';
import {heuristicScore} from '../src/job-score.js';
import {mergeProfile} from '../src/job-profile.js';
const assess=j=>({eligible:heuristicScore(j,mergeProfile(null)).track!=='none'});
const helpers={plain,safeUrl};
test('board URLs detect providers, preserve legacy keys and reject arbitrary hosts and paths',()=>{
 assert.equal(parseBoard({token:'gruns'}).id,'gruns');
 for(const [url,provider,host] of [['https://jobs.lever.co/example','lever','api.lever.co'],['https://jobs.ashbyhq.com/example','ashby','api.ashbyhq.com'],['https://job-boards.greenhouse.io/example','greenhouse','boards-api.greenhouse.io']]){
  const s=parseBoard({token:url,name:'Employer'});assert.equal(s.provider,provider);assert.equal(new URL(feedUrl(s)).hostname,host);
 }
 for(const token of ['https://localhost','https://jobs.lever.co.evil.test/example','https://jobs.lever.co/example/job','https://user:pw@jobs.lever.co/example','https://jobs.lever.co:4430/example','https://jobs.lever.co/example?redirect=evil','../example'])assert.throws(()=>parseBoard({token}));
 assert.throws(()=>parseBoard({token:'example',provider:'other'}));
});
test('Lever and Ashby normalize descriptions, remote location, schedule and application URLs',()=>{
 const source=parseBoard({provider:'lever',token:'example',name:'Employer'});
 const rows=normalizeBoard(source,[{id:'123',text:'Operations Manager',categories:{location:'United States',commitment:'Fulltime'},workplaceType:'remote',hostedUrl:'https://jobs.lever.co/example/123',descriptionPlain:'Training and implementation',lists:[{text:'Requirements',content:'<p>Project leadership.</p>'}],salaryRange:{currency:'USD',min:120000,max:140000,interval:'per-year'}}],helpers);
 assert.equal(rows[0].id,'lever:example:123');assert.equal(assess(rows[0]).eligible,true);assert.match(rows[0].description,/120000/);assert(!rows[0].description.includes('<p>'));
 const ashby=normalizeBoard(parseBoard({provider:'ashby',token:'example',name:'Employer'}),{jobs:[{id:'1',title:'Quality Manager',location:'USA',isRemote:true,employmentType:'FullTime',jobUrl:'https://jobs.ashbyhq.com/example/1',descriptionPlain:'SQF training',isListed:true},{id:'2',isListed:false}]},helpers);
 assert.equal(ashby.length,1);assert.match(ashby[0].location,/Remote/);assert.equal(ashby[0].source,'ashby:example');
 assert.throws(()=>normalizeBoard(source,{},helpers));assert.throws(()=>normalizeBoard(source,[{}],helpers));
});
