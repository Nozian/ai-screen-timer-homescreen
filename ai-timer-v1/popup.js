// popup.js
const SVCS=[
  {id:"chatgpt",    name:"ChatGPT",    color:"#10a37f"},
  {id:"claude",     name:"Claude",     color:"#d97706"},
  {id:"gemini",     name:"Gemini",     color:"#4285f4"},
  {id:"perplexity", name:"Perplexity", color:"#a855f7"},
  {id:"grok",       name:"Grok",       color:"#9ca3af"},
  {id:"google_ai",  name:"Google AI",  color:"#ea4335"},
  {id:"google",     name:"Google",     color:"#fbbc04"},
  {id:"twitter",    name:"X (Twitter)",color:"#1d9bf0"},
  {id:"youtube",    name:"YouTube",    color:"#ff0000"},
];
const CATEGORIES=[
  {id:"chat",  name:"対話AI",color:"#5E5CE6",ids:["chatgpt","claude","gemini","grok"]},
  {id:"search",name:"検索AI",color:"#0A84FF",ids:["perplexity","google_ai"]},
  {id:"other", name:"その他",color:"#FF9F0A",ids:["google","twitter","youtube"]},
];
let p="today", stats=null;
function fmt(s){if(!s)return"0m";const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);if(h>0)return`${h}h ${m}m`;if(m>0)return`${m}m`;return`${s}s`;}
function render(data){
  const list=document.getElementById("list");list.innerHTML="";let tot=0;
  SVCS.forEach(s=>{
    const sec=data[s.id]?.[p]||0; tot+=sec;
    const d=document.createElement("div"); d.className="row";
    d.innerHTML=`<span class="dot" style="background:${s.color}"></span><span class="nm">${s.name}</span><span class="tm" style="color:${s.color}">${fmt(sec)}</span>`;
    list.appendChild(d);
  });
  document.getElementById("tot").textContent=fmt(tot);

  // カテゴリ内訳バー
  const bar=document.getElementById("catbar"), leg=document.getElementById("catleg");
  bar.innerHTML=""; leg.innerHTML="";
  CATEGORIES.forEach(c=>{
    let sec=0; c.ids.forEach(id=>{ sec+=data[id]?.[p]||0; });
    if(tot&&sec){
      const seg=document.createElement("div"); seg.className="catseg";
      seg.style.cssText=`background:${c.color};width:${sec/tot*100}%`;
      bar.appendChild(seg);
    }
    const l=document.createElement("span"); l.className="cl";
    l.innerHTML=`<span class="cld" style="background:${c.color}"></span>${c.name} ${fmt(sec)}`;
    leg.appendChild(l);
  });
  renderDelta();
}

// ── 前期比 ──
function dayTotal(rec){ return rec?Object.values(rec.services||{}).reduce((a,b)=>a+b,0):0; }
function renderDelta(){
  const el=document.getElementById("dl");
  if(!stats){ el.innerHTML=""; return; }
  const now=stats.now;
  const map={}; stats.daily.forEach(d=>map[`${d.y}-${d.m}-${d.d}`]=d);
  const at=dt=>map[`${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()}`]||null;
  const sum=(from,n)=>{let t=0;for(let i=0;i<n;i++){t+=dayTotal(at(new Date(from.getFullYear(),from.getMonth(),from.getDate()+i)));}return t;};
  const monday=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()===0?6:x.getDay()-1));return x;};
  const today=new Date(now.y,now.m-1,now.d);

  let cur=0,prev=0,label="";
  if(p==="today"){
    cur=dayTotal(at(today));
    prev=sum(new Date(now.y,now.m-1,now.d-7),7)/7;
    label="直近7日平均比";
  } else if(p==="week"){
    const mon=monday(today), ti=(now.dow===0?6:now.dow-1);
    cur=sum(mon,ti+1);
    prev=sum(new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()-7),ti+1);
    label="先週同期比";
  } else {
    cur=sum(new Date(now.y,now.m-1,1),now.d);
    const prevDim=new Date(now.y,now.m-1,0).getDate();
    prev=sum(new Date(now.y,now.m-2,1),Math.min(now.d,prevDim));
    label="先月同期比";
  }
  if(!prev){ el.innerHTML=`<span>${label}</span><span class="dv flat">—</span>`; return; }
  const pct=Math.round((cur-prev)/prev*100);
  const cls=pct>0?"up":(pct<0?"down":"flat");
  el.innerHTML=`<span>${label}</span><span class="dv ${cls}">${pct>0?"+":""}${pct}%</span>`;
}
function load(){chrome.runtime.sendMessage({type:"GET_ALL"},r=>{if(r)render(r.services);});}
function loadStats(){chrome.runtime.sendMessage({type:"GET_STATS"},r=>{if(r){stats=r;renderDelta();}});}
document.querySelectorAll(".tab").forEach(b=>{b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));b.classList.add("on");p=b.dataset.p;load();});});
document.getElementById("db").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("newtab.html")}));
load();
loadStats();
