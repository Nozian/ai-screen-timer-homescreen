const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function context(file, data={}, fetch=()=>{throw Error('unexpected fetch')}) {
  const ctx = vm.createContext({URL,AbortSignal,Date,console,fetch,chrome:{storage:{local:{
    async get(keys) {return keys.reduce((r,k)=>(r[k]=data[k],r),{});},
    async set(value) {Object.assign(data,value);}
  }}}});
  // Support both string and array storage.get arguments.
  ctx.chrome.storage.local.get = async keys => Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]]));
  vm.runInContext(fs.readFileSync(`ai-timer-v1/${file}`,'utf8'),ctx);
  return ctx;
}
const prefs={breakEnabled:true,breakMinutes:30};
const now=1000000,date='2026-9-22';
test('break threshold, disabled default, snooze expiry and date reset',()=>{
  const c=context('break-service.js');
  const decide=(p,s,t,n=now,d=date)=>c.breakDecision(p,s,t,n,d);
  assert.equal(decide({},null,9999).blocked,false);
  assert.equal(decide(prefs,null,1799).blocked,false);
  assert.equal(decide(prefs,null,1800).blocked,true);
  assert.equal(decide(prefs,{date,snoozeUntil:now+1},1800).blocked,false);
  assert.equal(decide(prefs,{date,snoozeUntil:now},1800).blocked,true);
  assert.equal(decide(prefs,{date,disabled:true},9999).blocked,false);
  assert.equal(decide(prefs,{date,disabled:true},1800,now,'2026-9-23').blocked,true);
});
test('rest remains blocked for five minutes then resumes with a new usage threshold',()=>{
  const c=context('break-service.js');
  const s={date,restUntil:now+300000,nextAt:3600};
  assert.equal(c.breakDecision(prefs,s,1800,now,date).blocked,true);
  assert.equal(c.breakDecision(prefs,s,1800,now+300000,date).blocked,false);
  assert.equal(c.breakDecision(prefs,s,3600,now+300000,date).blocked,true);
});
function fixture() {return {id:'test_photo',urls:{regular:'https://images.unsplash.com/photo-test?ixid=preserve'},user:{name:'<img onerror=alert(1)>',links:{html:'https://unsplash.com/@tester'}}};}
test('fresh installation uses the bundled endpoint without configuration',async()=>{
  let requested;
  const c=context('photo-service.js',{},async url=>{requested=String(url);return {ok:true,json:async()=>fixture()};});
  assert.equal((await c.getPhoto()).photo.id,'test_photo');
  assert.equal(requested,'https://ai-screen-time-unsplash.nozomuy1220.workers.dev/photo?category=nature');
});
test('photo fetch coalesces, preserves hotlink metadata and credits, caches and tracks once',async()=>{
  const data={__prefs__:{photoEndpoint:'https://example.com/',photoTiming:'newtab'}};
  const calls=[];
  const c=context('photo-service.js',data,async(url,options)=>{calls.push([String(url),options]);return {ok:true,json:async()=>fixture()};});
  const [a,b]=await Promise.all([c.getPhoto(),c.getPhoto()]);
  assert.equal(calls.length,1);assert.equal(a.photo.id,b.photo.id);
  assert.match(calls[0][0],/^https:\/\/ai-screen-time-unsplash\.nozomuy1220\.workers\.dev\//);
  assert.match(a.photo.url,/ixid=preserve/);assert.match(a.photo.profile,/utm_source=ai_screen_time/);
  await c.getPhoto();assert.equal(calls.length,1);
  await c.trackPhoto(a.photo.id);await c.trackPhoto(a.photo.id);
  assert.equal(calls.length,2);assert.equal(calls[1][1].method,'POST');
});
test('offline keeps last photo and backs off',async()=>{
  const old={endpoint:'https://ai-screen-time-unsplash.nozomuy1220.workers.dev/',category:'nature',id:'old',cachedAt:1};
  const data={__prefs__:{photoEndpoint:old.endpoint},__unsplash_photo__:old};let calls=0;
  const c=context('photo-service.js',data,async()=>{calls++;throw Error('offline');});
  assert.equal((await c.getPhoto()).photo.id,'old');await c.getPhoto();assert.equal(calls,1);
});
test('rejects hostile image and attribution URLs',async()=>{
  for (const which of ['image','profile']) {
    const raw=fixture();
    if(which==='image') raw.urls.regular='https://evil.example/x';else raw.user.links.html='javascript:alert(1)';
    const c=context('photo-service.js',{__prefs__:{photoEndpoint:'https://example.com/'}},async()=>({ok:true,json:async()=>raw}));
    assert.equal((await c.getPhoto()).photo,null);
  }
});
test('proxy restricts origin and category, hides secret, follows download_location',async()=>{
  const worker=(await import('../proxy/worker.mjs')).default;
  const env={ALLOWED_ORIGINS:'chrome-extension://test',UNSPLASH_ACCESS_KEY:'secret-test'};
  const request=(path,method='GET',origin='chrome-extension://test')=>new Request('https://example.com'+path,{method,headers:{Origin:origin}});
  assert.equal((await worker.fetch(request('/photo','GET','https://evil.example'),env)).status,403);
  assert.equal((await worker.fetch(request('/photo?category=invalid'),env)).status,400);
  assert.equal((await worker.fetch(request('/photo','OPTIONS'),env)).status,204);
  const original=global.fetch;const calls=[];
  global.fetch=async(url,options)=>{calls.push(String(url));assert.equal(options.headers.Authorization,'Client-ID secret-test');return Response.json({...fixture(),links:{download_location:'https://api.unsplash.com/photos/test_photo/download?ixid=abc'}});};
  try {
    const res=await worker.fetch(request('/photo?category=forest'),env);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'),'chrome-extension://test');
    assert.equal((await res.json()).id,'test_photo');
    assert.equal((await worker.fetch(request('/download?id=test_photo','POST'),env)).status,200);
    assert.equal(calls.at(-1),'https://api.unsplash.com/photos/test_photo/download?ixid=abc');
  } finally {global.fetch=original;}
});

test('phrase modes: random avoids repeats, fixed stays fixed, favorites constrain the pool',()=>{
 const c=context('phrases.js');const m=c.PhraseModel;
 assert.notEqual(m.choose({},m.defaults[0],()=>0),m.defaults[0]);
 assert.equal(m.choose({mode:'fixed',fixed:m.defaults[2]}),m.defaults[2]);
 assert.equal(m.choose({mode:'favorites',favorites:[m.defaults[3]]}),m.defaults[3]);
 assert.ok(m.defaults.includes(m.choose({mode:'favorites',favorites:[]})));
 const clean=m.normalize({mode:'bad',custom:[' hello ','hello',null],favorites:['bad','hello'],fixed:'hello'});
 assert.equal(clean.mode,'random');assert.equal(clean.custom.length,1);assert.equal(clean.favorites[0],'hello');
 assert.equal(m.choose({...clean,mode:'fixed'}),'hello');
});

test('independent audio channels, stop during generation, volume bounds and no autoplay',async()=>{
 const events=[];const makeGain=()=>({gain:{value:0,linearRampToValueAtTime:v=>events.push(['gain',v]),setTargetAtTime:v=>events.push(['volume',v]),cancelScheduledValues:()=>{}},connect(){return this;}});
 class Audio {constructor(){events.push('context');this.currentTime=0;this.destination={};}async resume(){}createGain(){return makeGain();}createBufferSource(){return {connect(){return this;},start(){events.push('start')},stop(){events.push('stop')},disconnect(){}};}}
 const c=context('focus-audio.js');const a=new c.FocusAudio(Audio);
 assert.equal(events.length,0);
 a.buffer=async()=>({});
 await a.play('bgm','chords',35);await a.play('ambient','rain',70);
 assert.ok(a.channels.bgm);assert.ok(a.channels.ambient);a.stop('bgm');assert.equal(a.channels.bgm,undefined);assert.ok(a.channels.ambient);
 a.volume('ambient',150);assert.deepEqual(events.at(-1),['volume',1]);
 let resolve; a.buffer=()=>new Promise(r=>{resolve=r});
 const pending=a.play('bgm','bells',20);await new Promise(setImmediate);a.stop('bgm');resolve({});assert.equal(await pending,false);assert.equal(a.channels.bgm,undefined);
 a.stopAll();assert.equal(Object.keys(a.channels).length,0);
});
