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
let p="today";
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
}
function load(){chrome.runtime.sendMessage({type:"GET_ALL"},r=>{if(r)render(r.services);});}
document.querySelectorAll(".tab").forEach(b=>{b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));b.classList.add("on");p=b.dataset.p;load();});});
document.getElementById("db").addEventListener("click",()=>chrome.tabs.create({url:chrome.runtime.getURL("newtab.html")}));
load();
