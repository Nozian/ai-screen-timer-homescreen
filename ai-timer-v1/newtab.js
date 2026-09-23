// newtab.js  v5

// ━━━ サービス定義 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SERVICES = [
  { id:"chatgpt",    name:"ChatGPT",    color:"#10a37f", url:"https://chatgpt.com"                  },
  { id:"claude",     name:"Claude",     color:"#d97706", url:"https://claude.ai"                    },
  { id:"gemini",     name:"Gemini",     color:"#4285f4", url:"https://gemini.google.com"            },
  { id:"perplexity", name:"Perplexity", color:"#a855f7", url:"https://perplexity.ai"                },
  { id:"grok",       name:"Grok",       color:"#9ca3af", url:"https://grok.com"                     },
  { id:"google_ai",  name:"Google AI",  color:"#ea4335", url:"https://www.google.com/search?udm=50" },
  { id:"google",     name:"Google",     color:"#fbbc04", url:"https://www.google.com"               },
  { id:"twitter",    name:"X (Twitter)",color:"#1d9bf0", url:"https://x.com"                        },
  { id:"youtube",    name:"YouTube",    color:"#ff0000", url:"https://www.youtube.com"              },
];
const DEFAULT_ORDER = SERVICES.map(s=>s.id);
const DAYS = ["日","月","火","水","木","金","土"];

// ━━━ デフォルト設定 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEFAULTS = {
  breakEnabled:false, breakMinutes:30, photoCategory:"nature",
  theme:"dark", bgStyle:"photo", userName:"",
  showSearch:true, showNav:true, showTracker:true, showClock:true, showHeatmap:true,
  layoutMode:"scroll",    // "scroll"（壁紙優先・下にスクロール） | "compact"（1画面にまとめて表示）
  searchEngine:"google",
  chipOrder:[...DEFAULT_ORDER],
  hiddenIds:[], trackingOff:[],
  photoTiming:"newtab",   // "newtab" | "hourly" | "manual"
  textBrightness:100,     // 30〜100
  subOpacity:44,          // 10〜80
  clockWeight:200,        // 100〜700
  overlayOpacity:45,      // 0〜80
};
let P = {...DEFAULTS};

function loadPrefs(cb) {
  chrome.storage.local.get("__prefs__", r => {
    if (r.__prefs__) P = {...DEFAULTS, ...r.__prefs__};
    DEFAULT_ORDER.forEach(id=>{ if(!P.chipOrder.includes(id)) P.chipOrder.push(id); });
    cb();
  });
}
function savePrefs() { chrome.storage.local.set({__prefs__:P}); }

// ━━━ 背景 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const bgCanvas = document.getElementById("bg-canvas");
const bgCtx    = bgCanvas.getContext("2d");
const bgPhoto  = document.getElementById("bg-photo");
let W, H, bgT=0;

const PALETTES = {
  dark:     {base:[6,6,14],    orbs:[[60,20,120],[10,80,140],[130,40,60],[20,100,90],[80,30,100]]},
  light:    {base:[225,228,242],orbs:[[160,120,220],[80,140,210],[200,100,140],[80,180,160],[160,80,180]]},
  midnight: {base:[0,0,8],     orbs:[[30,10,80],[5,40,100],[80,20,40],[10,60,60],[50,15,70]]},
};
const ORBS = [
  {x:.2,y:.3,r:.55,speed:.00018,phase:0},  {x:.8,y:.7,r:.5,speed:.00013,phase:2.1},
  {x:.5,y:.9,r:.45,speed:.00021,phase:4.3},{x:.1,y:.8,r:.4,speed:.00016,phase:1.0},
  {x:.9,y:.2,r:.42,speed:.00019,phase:3.5},
];

function resizeBg(){W=bgCanvas.width=window.innerWidth;H=bgCanvas.height=window.innerHeight;}
window.addEventListener("resize",resizeBg); resizeBg();

function drawBg(){
  bgT++;
  const pal=PALETTES[P.theme]||PALETTES.dark;
  const [r,g,b]=pal.base;
  bgCtx.fillStyle=`rgb(${r},${g},${b})`; bgCtx.fillRect(0,0,W,H);
  if(P.bgStyle==="orbs"||P.bgStyle==="mesh"){
    ORBS.forEach((o,i)=>{
      const c=pal.orbs[i%pal.orbs.length];
      const px=(o.x+Math.sin(bgT*o.speed+o.phase)*.18)*W;
      const py=(o.y+Math.cos(bgT*o.speed*.7+o.phase)*.14)*H;
      const rad=o.r*Math.max(W,H);
      const a=P.bgStyle==="mesh"?.10:.17;
      const g2=bgCtx.createRadialGradient(px,py,0,px,py,rad);
      g2.addColorStop(0,`rgba(${c},${a})`); g2.addColorStop(.5,`rgba(${c},${a*.35})`); g2.addColorStop(1,`rgba(${c},0)`);
      bgCtx.beginPath(); bgCtx.arc(px,py,rad,0,Math.PI*2); bgCtx.fillStyle=g2; bgCtx.fill();
    });
    if(P.bgStyle==="mesh"){
      bgCtx.strokeStyle="rgba(255,255,255,0.025)"; bgCtx.lineWidth=1;
      for(let x=0;x<W;x+=60){bgCtx.beginPath();bgCtx.moveTo(x,0);bgCtx.lineTo(x,H);bgCtx.stroke();}
      for(let y=0;y<H;y+=60){bgCtx.beginPath();bgCtx.moveTo(0,y);bgCtx.lineTo(W,y);bgCtx.stroke();}
    }
  }
  requestAnimationFrame(drawBg);
}
drawBg();

// Unsplash photo loading is centralized in the service worker.
let photoCache = null;
let photoLoading = false;
function loadPhotoCache(cb) { cb(); }
function displayPhoto(photo) {
  return PhotoUI.render(bgPhoto, document.getElementById("photo-credit"), photo);
}
async function prefetchPhoto(force = false) {
  if (photoLoading) return;
  photoLoading = true;
  const btn = document.getElementById("refresh-photo");
  btn.disabled = true; btn.textContent = "📷 取得中...";
  try {
    const result = await chrome.runtime.sendMessage({type:"GET_PHOTO", force});
    photoCache = result?.photo || null;
    document.getElementById("photo-status").textContent = result?.status || "写真を取得できませんでした。";
    if (P.bgStyle === "photo") await displayPhoto(photoCache);
  } catch (_) {
    if (P.bgStyle === "photo") await displayPhoto(null);
  } finally {
    photoLoading = false; btn.disabled = false; btn.textContent = "📷 今すぐ変える";
    if (P.bgStyle !== "photo") document.getElementById("photo-credit").style.display = "none";
  }
}
function applyBg() {
  const isPhoto = P.bgStyle === "photo";
  bgPhoto.style.display = isPhoto ? "block" : "none";
  bgCanvas.style.display = isPhoto ? "none" : "block";
  document.getElementById("bg-overlay").style.background = `rgba(0,0,0,${(P.overlayOpacity ?? 45)/100})`;
  if (!isPhoto) { document.getElementById("photo-credit").style.display = "none"; return; }
  bgPhoto.style.backgroundImage ||= `url("${PhotoUI.fallback}")`;
  prefetchPhoto();
}
function refreshPhoto() { return prefetchPhoto(true); }
setInterval(() => { if (P.bgStyle === "photo" && P.photoTiming === "hourly") prefetchPhoto(); }, 60000);

// ━━━ 時刻・挨拶 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function greet(h,name){
  const n=name?`、${name}`:"";
  if(h<5)  return `夜更かしやな${n} 🌙`;
  if(h<11) return `おはよう${n} ☀️`;
  if(h<14) return `お昼やね${n} 🍱`;
  if(h<17) return `午後もがんばろ${n} 💪`;
  if(h<20) return `夕方やな${n} 🌇`;
  return `おつかれ${n} 🌃`;
}
function updateClock(){
  const now=new Date(),h=now.getHours(),m=now.getMinutes();
  document.getElementById("clock").textContent=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  document.getElementById("greeting").textContent=greet(h,P.userName);
  const y=now.getFullYear(),mo=now.getMonth()+1,d=now.getDate(),day=DAYS[now.getDay()];
  document.getElementById("dateline").textContent=`${y}年${mo}月${d}日（${day}）`;
}
setInterval(updateClock,1000);

// ━━━ テキストスタイル適用 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function applyTextStyles(){
  const root = document.documentElement;
  const br  = (P.textBrightness || 100) / 100;
  const subA = (P.subOpacity || 44) / 100;
  const cw  = P.clockWeight || 200;
  const isLight = P.theme === "light";

  if (isLight) {
    // ライトテーマ：明るさスライダーは文字を暗くする方向（0が白→1が黒）
    const v = Math.round(13 + (1 - br) * 30); // br=1→13(暗), br=0→43(明)
    root.style.setProperty("--text", `rgb(${v},${v+2},${v+30})`);
    root.style.setProperty("--sub",  `rgba(0,0,0,${(subA).toFixed(2)})`);
    root.style.setProperty("--sub2", `rgba(0,0,0,${(subA*0.6).toFixed(2)})`);
  } else {
    const rv = Math.round(240 * br);
    root.style.setProperty("--text", `rgba(${rv},${rv},${rv},1)`);
    root.style.setProperty("--sub",  `rgba(255,255,255,${(subA).toFixed(2)})`);
    root.style.setProperty("--sub2", `rgba(255,255,255,${(subA*0.5).toFixed(2)})`);
  }
  document.getElementById("clock").style.fontWeight = cw;
}

// ━━━ AI クイックリンク ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderNav(){
  const nav=document.getElementById("ai-nav"); nav.innerHTML="";
  P.chipOrder.forEach(id=>{
    const s=SERVICES.find(x=>x.id===id); if(!s) return;
    const a=document.createElement("a");
    a.className="ai-chip"; a.href=s.url; a.target="_blank"; a.dataset.id=id; a.draggable=true;
    a.innerHTML=`<span class="cdot" style="--c:${s.color}"></span>${s.name}`;
    a.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/plain",id);a.classList.add("dragging");});
    a.addEventListener("dragend",()=>a.classList.remove("dragging"));
    a.addEventListener("dragover",e=>{e.preventDefault();a.classList.add("drag-over");});
    a.addEventListener("dragleave",()=>a.classList.remove("drag-over"));
    a.addEventListener("drop",e=>{
      e.preventDefault(); a.classList.remove("drag-over");
      const fi=e.dataTransfer.getData("text/plain"); if(fi===id) return;
      const arr=[...P.chipOrder],from=arr.indexOf(fi),to=arr.indexOf(id);
      arr.splice(from,1); arr.splice(to,0,fi);
      P.chipOrder=arr; savePrefs(); renderNav(); renderSortList();
    });
    nav.appendChild(a);
  });
}

// ━━━ 検索バー ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let engineMenuOpen=false, engineUrl="https://www.google.com/search?q=";
const engineBtn  = document.getElementById("engine-btn");
const engineMenu = document.getElementById("engine-menu");

function setEngine(item){
  document.querySelectorAll(".eng-item").forEach(e=>e.classList.remove("on"));
  item.classList.add("on");
  engineUrl=item.dataset.url;
  document.getElementById("engine-icon").textContent=item.dataset.icon;
  document.getElementById("engine-icon").style.color=item.dataset.color;
  P.searchEngine=item.dataset.e; savePrefs();
}
function initEngine(){
  const el=document.querySelector(`.eng-item[data-e="${P.searchEngine}"]`);
  if(el) setEngine(el);
}
function openEngineMenu(){
  const r=engineBtn.getBoundingClientRect();
  engineMenu.classList.add("open"); engineMenuOpen=true;   // 先に表示して実寸を測る
  const vw=window.innerWidth, vh=window.innerHeight;
  engineMenu.style.maxHeight=Math.min(320, vh-16)+"px";
  const menuH=engineMenu.offsetHeight, menuW=engineMenu.offsetWidth;
  const spaceBelow=vh-r.bottom-8, spaceAbove=r.top-8;

  // 下に十分な余白が無ければ上向きに開く
  if(spaceBelow<menuH && spaceAbove>spaceBelow){
    engineMenu.style.top="auto";
    engineMenu.style.bottom=(vh-r.top+8)+"px";
  } else {
    engineMenu.style.bottom="auto";
    engineMenu.style.top=(r.bottom+8)+"px";
  }
  // 画面外にはみ出さないよう左位置もクランプ
  const left=Math.min(Math.max(8,r.left), vw-menuW-8);
  engineMenu.style.left=left+"px";
}
function closeEngineMenu(){ engineMenu.classList.remove("open"); engineMenuOpen=false; }

engineBtn.addEventListener("click",e=>{
  e.stopPropagation(); engineMenuOpen?closeEngineMenu():openEngineMenu();
});
document.querySelectorAll(".eng-item").forEach(item=>{
  item.addEventListener("click",e=>{e.stopPropagation();setEngine(item);closeEngineMenu();});
});
document.addEventListener("click",e=>{
  if(engineMenuOpen&&!engineMenu.contains(e.target)&&e.target!==engineBtn) closeEngineMenu();
});

function doSearch(){
  const q=document.getElementById("search-input").value.trim(); if(!q) return;
  const isUrl=/^https?:\/\//.test(q)||/^[\w.-]+\.\w{2,}(\/|$)/.test(q);
  window.location.href=isUrl?(q.startsWith("http")?q:`https://${q}`):engineUrl+encodeURIComponent(q);
}
document.getElementById("search-go").addEventListener("click",doSearch);
document.getElementById("search-input").addEventListener("keydown",e=>{if(e.key==="Enter")doSearch();});

// ━━━ トラッカー ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let period="today", rawData=null, stats=null, offset=0;
const OFFSET_MIN = { today:-13, week:-8, month:-2 };
function addDays(d,n){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n); }
function sameD(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
function dkey(d){ return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }

// 現在の period + offset が指す日付範囲
function currentRange(){
  const now=stats?stats.now:{y:new Date().getFullYear(),m:new Date().getMonth()+1,d:new Date().getDate()};
  const today=new Date(now.y,now.m-1,now.d);
  if(period==="today"){
    const d=addDays(today,offset);
    return {from:d,to:d,fullFrom:d,fullTo:d};
  }
  if(period==="week"){
    const mon=addDays(mondayOfLocal(today),offset*7);
    return {from:mon,to:offset===0?today:addDays(mon,6),fullFrom:mon,fullTo:addDays(mon,6)};
  }
  const first=new Date(now.y,now.m-1+offset,1);
  const last=new Date(first.getFullYear(),first.getMonth()+1,0);
  return {from:first,to:offset===0?today:last,fullFrom:first,fullTo:last};
}
function periodLabel(){
  const r=currentRange();
  if(period==="today"){
    if(offset===0) return "今日";
    if(offset===-1) return "昨日";
    return `${r.from.getMonth()+1}/${r.from.getDate()}（${DOW_JA[r.from.getDay()===0?6:r.from.getDay()-1]}）`;
  }
  if(period==="week"){
    if(offset===0) return "今週";
    if(offset===-1) return "先週";
    return `${-offset}週間前`;
  }
  if(offset===0) return "今月";
  if(offset===-1) return "先月";
  return `${r.from.getMonth()+1}月`;
}
function updatePnav(){
  document.getElementById("pn-label").textContent=periodLabel();
  document.getElementById("pn-prev").disabled = offset<=OFFSET_MIN[period];
  document.getElementById("pn-next").disabled = offset>=0;
}

// カテゴリ定義（全グラフ共通の色）
const CATEGORIES = [
  { id:"chat",   name:"対話AI", color:"#5E5CE6", ids:["chatgpt","claude","gemini","grok"] },
  { id:"search", name:"検索AI", color:"#0A84FF", ids:["perplexity","google_ai"]           },
  { id:"other",  name:"その他", color:"#FF9F0A", ids:["google","twitter","youtube"]       },
];
const CAT_OF = {};
CATEGORIES.forEach(c => c.ids.forEach(id => CAT_OF[id] = c));

const BAR_H = 78, LABEL_H = 14;   // フォールバック値
let lastAvgRatio = null, chartHover = false;
function positionAvgLine(ratio){
  const colsEl=document.getElementById("cols");
  const bar=colsEl.querySelector(".col-bar"), lbl=colsEl.querySelector(".col-lbl");
  const bh=bar?bar.clientHeight:BAR_H, lh=lbl?lbl.clientHeight:LABEL_H;
  document.getElementById("avg-line").style.bottom=(lh+Math.min(1,ratio)*bh)+"px";
}
window.addEventListener("resize",()=>{ if(lastAvgRatio!=null) positionAvgLine(lastAvgRatio); });
const DOW_JA = ["月","火","水","木","金","土","日"];

function fmtShort(sec){
  if(!sec) return "0m";
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);
  if(h>0) return `${h}h${m}m`; if(m>0) return `${m}m`; return `${sec}s`;
}
function svcOf(id){ return SERVICES.find(x=>x.id===id); }
function mondayOfLocal(d){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()-(x.getDay()===0?6:x.getDay()-1));
  return x;
}

function loadTracker(){
  chrome.runtime.sendMessage({type:"GET_ALL"},res=>{if(!res)return;rawData=res.services;renderTracker();});
}
function loadStats(){
  chrome.runtime.sendMessage({type:"GET_STATS"},res=>{if(!res)return;stats=res;renderChart();});
}
function loadYear(){
  chrome.runtime.sendMessage({type:"GET_YEAR"},res=>{if(res)renderHeatmap(res);});
}

// ── セッション統計（選択中の期間に連動） ──
function renderSessionStats(){
  const el=document.getElementById("session-stats");
  if(!stats){ el.innerHTML=""; return; }
  const hidden=new Set(P.hiddenIds||[]);
  const r=currentRange();

  let count=0, sumSec=0, maxSec=0;
  stats.daily.forEach(rec=>{
    const dt=new Date(rec.y,rec.m-1,rec.d);
    if(dt<r.from||dt>r.to) return;
    Object.keys(rec.sessions||{}).forEach(sid=>{
      if(hidden.has(sid)) return;
      const se=rec.sessions[sid];
      count+=se.count; maxSec=Math.max(maxSec,se.maxSec);
    });
    Object.keys(rec.services||{}).forEach(sid=>{ if(!hidden.has(sid)) sumSec+=rec.services[sid]; });
  });

  if(!count){ el.innerHTML=""; return; }
  const avg=Math.round(sumSec/count);
  el.innerHTML=`
    <span class="ss-item">回数 <span class="ss-v">${count}回</span></span>
    <span class="ss-item">平均 <span class="ss-v">${fmtShort(avg)}</span></span>
    <span class="ss-item">最長 <span class="ss-v">${fmtShort(maxSec)}</span></span>
  `;
}

// ── 年間ヒートマップ ──
const HM_MONTH_JA=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
function renderHeatmap(data){
  const grid=document.getElementById("heatmap-grid");
  const monthsEl=document.getElementById("heatmap-months");
  const metaEl=document.getElementById("heatmap-meta");
  const cells=data.cells;
  if(!cells||!cells.length){ grid.innerHTML=""; return; }

  const max=Math.max(...cells.map(c=>c.total),1);
  const activeDays=cells.filter(c=>c.total>0).length;
  const totalSec=cells.reduce((s,c)=>s+c.total,0);
  metaEl.textContent=`過去1年 ${fmtShort(totalSec)} ・ ${activeDays}日 使用`;

  const lvOf=sec=>{
    if(!sec) return 0;
    const r=sec/max;
    if(r>0.75) return 4; if(r>0.5) return 3; if(r>0.22) return 2; return 1;
  };

  grid.innerHTML="";
  const weeks=Math.ceil(cells.length/7);
  grid.style.gridTemplateColumns=`repeat(${weeks}, 9px)`;   // .hm-cellの実寸(9px)と完全一致させる
  cells.forEach((c,i)=>{
    const dt=new Date(c.y,c.m-1,c.d);
    const isFuture = i>data.todayIdx;
    const div=document.createElement("div");
    div.className="hm-cell"+(isFuture?" future":"")+(i===data.todayIdx?" today":"");
    if(!isFuture){
      const lv=lvOf(c.total);
      div.dataset.lv=lv;
      div.style.background = lv===0 ? "var(--bar-bg)" : `var(--hm${lv})`;
      div.title=`${c.m}/${c.d}：${fmtShort(c.total)}`;
    }
    grid.appendChild(div);
  });

  // 月ラベル：グリッドと同じ列定義を使い、grid-column-startで実際の列に直接固定する
  monthsEl.innerHTML="";
  monthsEl.style.gridTemplateColumns=`repeat(${weeks}, 9px)`;
  monthsEl.style.columnGap="3px";
  let lastMonth=-1;
  cells.forEach((c,i)=>{
    const week=Math.floor(i/7);
    if(c.m!==lastMonth && c.d<=7){
      lastMonth=c.m;
      const s=document.createElement("span");
      s.className="hm-month";
      s.textContent=HM_MONTH_JA[c.m-1];
      s.style.gridColumnStart=week+1;
      monthsEl.appendChild(s);
    }
  });
}

// ── データエクスポート ──
function downloadBlob(content, filename, mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function todayStr(){ const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
function exportJSON(){
  chrome.runtime.sendMessage({type:"GET_EXPORT"},res=>{
    if(!res) return;
    downloadBlob(JSON.stringify(res,null,2), `ai-screen-time_${todayStr()}.json`, "application/json");
  });
}
function exportCSV(){
  chrome.runtime.sendMessage({type:"GET_YEAR"},yr=>{
    chrome.runtime.sendMessage({type:"GET_EXPORT"},ex=>{
      if(!ex) return;
      const raw=ex.raw;
      const dateSet=new Set();
      Object.keys(raw).forEach(k=>{
        const m=k.match(/^([a-z_]+)_d_(\d+)_(\d+)_(\d+)$/);
        if(m) dateSet.add(`${m[2]}-${String(m[3]).padStart(2,"0")}-${String(m[4]).padStart(2,"0")}`);
      });
      const dates=[...dateSet].sort();
      const ids=SERVICES.map(s=>s.id);
      const rows=[["date",...ids,"total"].join(",")];
      dates.forEach(ds=>{
        const [y,m,d]=ds.split("-").map(Number);
        let total=0;
        const vals=ids.map(id=>{
          const v=raw[`${id}_d_${y}_${m}_${d}`]||0; total+=v; return v;
        });
        rows.push([ds,...vals,total].join(","));
      });
      downloadBlob(rows.join("\n"), `ai-screen-time_daily_${todayStr()}.csv`, "text/csv");
    });
  });
}
document.getElementById("export-json").addEventListener("click",exportJSON);
document.getElementById("export-csv").addEventListener("click",exportCSV);

function renderTracker(){
  const hidden=P.hiddenIds||[];
  let secOf;
  if(offset===0){
    if(!rawData) return;
    secOf=id=>rawData[id]?.[period]||0;
  } else {
    if(!stats) return;
    const r=currentRange();
    const sums={};
    stats.daily.forEach(rec=>{
      const dt=new Date(rec.y,rec.m-1,rec.d);
      if(dt<r.from||dt>r.to) return;
      Object.keys(rec.services||{}).forEach(sid=>{ sums[sid]=(sums[sid]||0)+rec.services[sid]; });
    });
    secOf=id=>sums[id]||0;
  }

  const entries=P.chipOrder.filter(id=>!hidden.includes(id)).map(id=>{
    const s=svcOf(id); if(!s) return null;
    return {id,name:s.name,color:s.color,sec:secOf(id)};
  }).filter(Boolean).sort((a,b)=>b.sec-a.sec);
  const total=entries.reduce((s,e)=>s+e.sec,0);
  const maxSec=entries[0]?.sec||1;

  // カテゴリ別（ドーナツ外周・凡例で使用）
  const catTotals={};
  entries.forEach(e=>{ const c=CAT_OF[e.id]; if(!c) return; catTotals[c.id]=(catTotals[c.id]||0)+e.sec; });
  const catEntries=CATEGORIES.map(c=>({name:c.name,color:c.color,sec:catTotals[c.id]||0}));

  drawDonut(entries,catEntries,total);
  document.getElementById("donut-total").textContent=fmtShort(total);

  const barsEl=document.getElementById("bars"); barsEl.innerHTML="";
  if(!total){
    barsEl.innerHTML=`<div class="empty-msg">${offset===0?"各サービスを使うと<br>ここに記録されます":"この期間の記録はありません"}</div>`;
  } else {
    entries.forEach(e=>{
      if(!e.sec) return;
      const row=document.createElement("div"); row.className="bar-row";
      row.innerHTML=`<span class="bar-dot" style="background:${e.color}"></span><span class="bar-name">${e.name}</span><div class="bar-track"><div class="bar-fill" style="background:${e.color}" data-w="${Math.round(e.sec/maxSec*100)}"></div></div><span class="bar-val">${fmtShort(e.sec)}</span>`;
      barsEl.appendChild(row);
    });
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.querySelectorAll(".bar-fill").forEach(el=>{el.style.width=el.dataset.w+"%";});
    }));
  }

  renderLegend(catEntries,total);
  updatePnav();
  renderChart();
}

function renderLegend(catEntries,total){
  const el=document.getElementById("cat-legend"); el.innerHTML="";
  catEntries.forEach(c=>{
    const pct=total?Math.round(c.sec/total*100):0;
    const d=document.createElement("span"); d.className="leg";
    d.innerHTML=`<span class="leg-d" style="background:${c.color}"></span>${c.name} <span class="leg-v">${fmtShort(c.sec)}</span>${total?` <span style="opacity:.6">${pct}%</span>`:""}`;
    el.appendChild(d);
  });
}

// ── 前期比バッジ ──
function deltaHtml(cur,prev){
  if(!prev) return `<span class="delta flat">—</span>`;
  const pct=Math.round((cur-prev)/prev*100);
  if(pct===0)  return `<span class="delta flat">±0%</span>`;
  const cls=pct>0?"up":"down";
  return `<span class="delta ${cls}">${pct>0?"+":""}${pct}%</span>`;
}

// ── グラフ本体 ──
function renderChart(){
  const colsEl=document.getElementById("cols");
  const titleEl=document.getElementById("chart-title");
  const metaEl=document.getElementById("chart-meta");
  const avgEl=document.getElementById("avg-line");
  if(!stats){ colsEl.innerHTML=""; return; }
  if(chartHover) return;   // ホバー中は再描画を保留
  renderSessionStats();

  const hidden=new Set(P.hiddenIds||[]);
  const vis=id=>!hidden.has(id);
  const now=stats.now;
  const todayDate=new Date(now.y,now.m-1,now.d);
  const range=currentRange();

  // 日付 → 日別レコードのマップ
  const dmap={}; stats.daily.forEach(d=>dmap[`${d.y}-${d.m}-${d.d}`]=d);
  const dayAt=dt=>dmap[dkey(dt)]||null;
  const pickSvc=rec=>{
    const out={}; let t=0;
    if(rec) Object.keys(rec.services||{}).forEach(sid=>{ if(vis(sid)&&rec.services[sid]){out[sid]=rec.services[sid]; t+=rec.services[sid];} });
    return {services:out,total:t};
  };
  const sumRange=(from,to)=>{
    let t=0;
    for(let dt=new Date(from);dt<=to;dt=addDays(dt,1)) t+=pickSvc(dayAt(dt)).total;
    return t;
  };

  let cols=[], title="", meta="", avgSec=0, showAvg=false, note="";

  if(period==="today"){
    title="時間帯別";
    const target=range.from;
    const isToday=offset===0;
    const raw = isToday ? (stats.hourly||{}) : (stats.hourlyByDate?.[dkey(target)]||{});
    let hourlySum=0;
    for(let h=0;h<24;h++){
      const hr=raw[String(h)]||{};
      const services={}; let total=0;
      Object.keys(hr).forEach(sid=>{ if(vis(sid)&&hr[sid]){services[sid]=hr[sid]; total+=hr[sid];} });
      hourlySum+=total;
      cols.push({
        label:String(h), showLabel:h%3===0, services, total,
        state: isToday ? (h===now.hour?"now":(h>now.hour?"future":"")) : "",
        tip:`${String(h).padStart(2,"0")}:00 – ${String(h).padStart(2,"0")}:59`,
      });
    }
    const dayTotal=pickSvc(dayAt(target)).total;
    const avg7=sumRange(addDays(target,-7),addDays(target,-1))/7;
    meta=`直近7日平均 ${fmtShort(Math.round(avg7))} ${deltaHtml(dayTotal,avg7)}`;
    if(!hourlySum&&dayTotal) note=isToday?"時間帯別の記録はこのバージョンから開始されます":"この日の時間帯別データはありません";

  } else if(period==="week"){
    title="曜日別";
    const mon=range.fullFrom;
    const ti=offset===0?(now.dow===0?6:now.dow-1):6;
    for(let i=0;i<7;i++){
      const dt=addDays(mon,i);
      const p=pickSvc(dayAt(dt));
      cols.push({
        label:DOW_JA[i], showLabel:true, services:p.services, total:p.total,
        state: offset===0 ? (i===ti?"now":(i>ti?"future":"")) : "",
        tip:`${dt.getMonth()+1}/${dt.getDate()}（${DOW_JA[i]}）`,
      });
    }
    const thisSum=sumRange(mon,addDays(mon,ti));
    const prevMon=addDays(mon,-7);
    const prevSum=sumRange(prevMon,addDays(prevMon,ti));
    avgSec=thisSum/(ti+1); showAvg=thisSum>0;
    meta=`前週比 ${deltaHtml(thisSum,prevSum)}`;

  } else {
    title="日別";
    const first=range.fullFrom, last=range.fullTo;
    const dim=last.getDate();
    const td=offset===0?now.d:dim;
    for(let i=1;i<=dim;i++){
      const dt=new Date(first.getFullYear(),first.getMonth(),i);
      const p=pickSvc(dayAt(dt));
      cols.push({
        label:String(i), showLabel:(i===1||i%5===0)&&i!==dim, services:p.services, total:p.total,
        state: offset===0 ? (i===now.d?"now":(i>now.d?"future":"")) : "",
        tip:`${first.getMonth()+1}/${i}（${DOW_JA[dt.getDay()===0?6:dt.getDay()-1]}）`,
      });
    }
    const thisSum=sumRange(first,new Date(first.getFullYear(),first.getMonth(),td));
    const prevFirst=new Date(first.getFullYear(),first.getMonth()-1,1);
    const prevLast=new Date(first.getFullYear(),first.getMonth(),0);
    const prevTd=Math.min(td,prevLast.getDate());
    const prevSum=sumRange(prevFirst,new Date(prevFirst.getFullYear(),prevFirst.getMonth(),prevTd));
    avgSec=thisSum/td; showAvg=thisSum>0;
    meta=`前月比 ${deltaHtml(thisSum,prevSum)}`;
  }

  titleEl.textContent=title;
  metaEl.innerHTML=meta;

  const maxSec=Math.max(...cols.map(c=>c.total),1);
  const grand=cols.reduce((s,c)=>s+c.total,0);

  colsEl.innerHTML="";
  if(!grand){
    colsEl.innerHTML=`<div class="chart-empty">${note||"この期間の記録はまだありません"}</div>`;
    avgEl.classList.remove("on");
    return;
  }

  cols.forEach((c,idx)=>{
    const col=document.createElement("div");
    col.className="col"+(c.state?" "+c.state:"")+(c.total?"":" empty");
    const catSecs=CATEGORIES.map(cat=>{
      let s=0; cat.ids.forEach(id=>{ s+=c.services[id]||0; });
      return {cat,sec:s};
    });
    const segs=catSecs.filter(x=>x.sec>0)
      .map(x=>`<div class="seg" style="background:${x.cat.color}" data-h="${(x.sec/maxSec*100)}"></div>`).join("");
    col.innerHTML=`<div class="col-bar">${segs}</div><div class="col-lbl">${c.showLabel?c.label:""}</div>`;
    col.addEventListener("mouseenter",()=>showTip(col,c));
    col.addEventListener("mouseleave",hideTip);
    colsEl.appendChild(col);
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    colsEl.querySelectorAll(".seg").forEach(el=>{ el.style.height=el.dataset.h+"%"; });
  }));

  if(showAvg&&avgSec>0){
    avgEl.classList.add("on");
    positionAvgLine(avgSec/maxSec);
    document.getElementById("avg-label").textContent=`平均 ${fmtShort(Math.round(avgSec))}`;
  } else {
    avgEl.classList.remove("on");
  }
  lastAvgRatio = (showAvg&&avgSec>0) ? avgSec/maxSec : null;
}

// ── ツールチップ ──
function showTip(col,data){
  chartHover=true;
  const tip=document.getElementById("chart-tip");
  const rows=Object.keys(data.services)
    .map(id=>({id,sec:data.services[id]}))
    .sort((a,b)=>b.sec-a.sec).slice(0,4)
    .map(r=>{
      const s=svcOf(r.id); if(!s) return "";
      return `<div class="tip-r"><span class="tip-d" style="background:${s.color}"></span><span class="tip-n">${s.name}</span><span class="tip-v">${fmtShort(r.sec)}</span></div>`;
    }).join("");
  tip.innerHTML=`<div class="tip-t">${data.tip}</div>`
    + (data.total?rows+`<div class="tip-r tip-total"><span class="tip-n">合計</span><span class="tip-v">${fmtShort(data.total)}</span></div>`
                 :`<div class="tip-r"><span class="tip-n">記録なし</span></div>`);
  const plot=document.getElementById("chart-plot");
  const x=col.offsetLeft+col.offsetWidth/2;
  const half=Math.max(tip.offsetWidth,110)/2;
  tip.style.left=Math.round(Math.max(half,Math.min(plot.clientWidth-half,x)))+"px";
  tip.style.transform="translateX(-50%)";
  tip.classList.add("on");
}
function hideTip(){ chartHover=false; document.getElementById("chart-tip").classList.remove("on"); }

// ── ドーナツ（内周=サービス / 外周=カテゴリ） ──
function drawRing(ctx,cx,cy,R,ri,items,total,gap){
  if(!total){
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.arc(cx,cy,ri,0,Math.PI*2,true);
    ctx.fillStyle="rgba(255,255,255,0.05)"; ctx.fill(); return;
  }
  let a=-Math.PI/2;
  items.forEach(e=>{
    if(!e.sec) return;
    const slice=Math.max((e.sec/total)*Math.PI*2-gap,0.015);
    ctx.beginPath();
    ctx.arc(cx,cy,R ,a+gap/2, a+slice+gap/2);
    ctx.arc(cx,cy,ri,a+slice+gap/2, a+gap/2, true);
    ctx.closePath(); ctx.fillStyle=e.color; ctx.fill();
    a+=slice+gap;
  });
}
let lastDonut=null;
function drawDonut(entries,catEntries,total){
  const cv=document.getElementById("donut");
  const wrap=document.getElementById("donut-wrap");
  // 親要素の実寸に合わせる（メディアクエリで縮む場合にも追従）
  const S=Math.max(48,Math.round(wrap.clientWidth||110));
  const dpr=Math.min(window.devicePixelRatio||1,3);
  cv.width=Math.round(S*dpr); cv.height=Math.round(S*dpr);
  cv.style.width=S+"px"; cv.style.height=S+"px";
  const ctx=cv.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,S,S);
  const cx=S/2, cy=S/2, k=S/110;               // 110px設計を基準にスケール
  drawRing(ctx,cx,cy,53*k,49.5*k,catEntries,total,0.05);  // 外周：カテゴリ（細リング）
  drawRing(ctx,cx,cy,45*k,34*k,entries,   total,0.03);    // 内周：サービス
  lastDonut={entries,catEntries,total};
}
window.addEventListener("resize",()=>{
  if(lastDonut) drawDonut(lastDonut.entries,lastDonut.catEntries,lastDonut.total);
});

document.querySelectorAll(".ttab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".ttab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active"); period=btn.dataset.p; offset=0;
    hideTip(); renderTracker();
  });
});
document.getElementById("pn-prev").addEventListener("click",()=>{
  if(offset>OFFSET_MIN[period]){ offset--; hideTip(); renderTracker(); }
});
document.getElementById("pn-next").addEventListener("click",()=>{
  if(offset<0){ offset++; hideTip(); renderTracker(); }
});

// ━━━ 設定パネル ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderSvcSettings(){
  const wrap=document.getElementById("svc-settings"); wrap.innerHTML="";
  P.chipOrder.forEach(id=>{
    const s=SERVICES.find(x=>x.id===id); if(!s) return;
    const isH=(P.hiddenIds||[]).includes(s.id), isTOff=(P.trackingOff||[]).includes(s.id);
    const row=document.createElement("div"); row.className="svc-row";
    row.innerHTML=`<span class="svc-dot-sm" style="background:${s.color}"></span><span class="svc-name">${s.name}</span><div class="svc-tog-wrap"><label class="svc-tog-label"><span>表示</span><input type="checkbox" data-type="display" data-id="${s.id}" ${isH?"":"checked"}/><span class="stslider"></span></label><label class="svc-tog-label"><span>計測</span><input type="checkbox" data-type="track" data-id="${s.id}" ${isTOff?"":"checked"}/><span class="stslider"></span></label></div>`;
    row.querySelectorAll("input").forEach(inp=>{
      inp.addEventListener("change",e=>{
        const id=e.target.dataset.id,type=e.target.dataset.type;
        if(type==="display"){P.hiddenIds=e.target.checked?(P.hiddenIds||[]).filter(x=>x!==id):[...(P.hiddenIds||[]),id];}
        else{P.trackingOff=e.target.checked?(P.trackingOff||[]).filter(x=>x!==id):[...(P.trackingOff||[]),id];}
        savePrefs(); renderTracker();
      });
    });
    wrap.appendChild(row);
  });
}

function renderSortList(){
  const list=document.getElementById("sort-list"); list.innerHTML="";
  P.chipOrder.forEach(id=>{
    const s=SERVICES.find(x=>x.id===id); if(!s) return;
    const item=document.createElement("div"); item.className="sort-item"; item.draggable=true; item.dataset.id=id;
    item.innerHTML=`<span class="sort-handle">⠿</span><span class="sort-dot" style="background:${s.color}"></span><span class="sort-name">${s.name}</span>`;
    item.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",id));
    item.addEventListener("dragover",e=>{e.preventDefault();item.classList.add("drag-over");});
    item.addEventListener("dragleave",()=>item.classList.remove("drag-over"));
    item.addEventListener("drop",e=>{
      e.preventDefault();item.classList.remove("drag-over");
      const fi=e.dataTransfer.getData("text/plain");if(fi===id)return;
      const arr=[...P.chipOrder],from=arr.indexOf(fi),to=arr.indexOf(id);
      arr.splice(from,1);arr.splice(to,0,fi);P.chipOrder=arr;savePrefs();renderSortList();renderNav();
    });
    list.appendChild(item);
  });
}

function applyPrefs(){
  document.documentElement.setAttribute("data-theme",P.theme);
  document.documentElement.setAttribute("data-layout",P.layoutMode||"scroll");
  applyBg(); applyTextStyles();

  // 機能オンオフ
  document.getElementById("search-wrap").style.display = P.showSearch  ?"":"none";
  document.getElementById("ai-nav").style.display      = P.showNav     ?"":"none";
  document.getElementById("tracker").style.display     = P.showTracker ?"":"none";
  document.getElementById("heatmap-section").style.display = P.showHeatmap ?"":"none";
  document.getElementById("clock").style.display       = P.showClock   ?"":"none";
  document.getElementById("greeting").style.display    = P.showClock   ?"":"none";
  document.getElementById("dateline").style.display    = P.showClock   ?"":"none";

  // 写真オプション表示
  document.getElementById("photo-options").style.display = P.bgStyle==="photo"?"flex":"none";

  document.getElementById("photo-category").value = P.photoCategory;
  document.getElementById("break-enabled").checked = P.breakEnabled;
  document.getElementById("break-minutes").value = P.breakMinutes;

  // 設定UIに反映
  document.querySelectorAll(".tbtn").forEach(b=>b.classList.toggle("on",b.dataset.theme===P.theme));
  document.querySelectorAll(".lmbtn").forEach(b=>b.classList.toggle("on",b.dataset.lm===(P.layoutMode||"scroll")));
  document.getElementById("lm-hint").textContent = (P.layoutMode||"scroll")==="scroll"
    ? "壁紙を全画面で楽しみ、下にスクロールで記録を見る"
    : "時計と記録を1画面にまとめて表示する";
  document.querySelectorAll(".bsbtn").forEach(b=>b.classList.toggle("on",b.dataset.bg===P.bgStyle));
  document.querySelectorAll(".ptbtn").forEach(b=>b.classList.toggle("on",b.dataset.pt===P.photoTiming));
  document.getElementById("name-input").value      = P.userName||"";
  document.getElementById("t-search").checked      = P.showSearch;
  document.getElementById("t-nav").checked         = P.showNav;
  document.getElementById("t-tracker").checked     = P.showTracker;
  document.getElementById("t-heatmap").checked     = P.showHeatmap;
  document.getElementById("t-clock").checked       = P.showClock;

  // スライダー
  const sl=(id,val,suffix)=>{
    document.getElementById(id).value=val;
    document.getElementById(id+"-val").textContent=val+suffix;
  };
  sl("sl-brightness",   P.textBrightness||100, "%");
  sl("sl-sub-opacity",  P.subOpacity||44,       "%");
  sl("sl-clock-weight", P.clockWeight||200,     "");
  sl("sl-overlay",      P.overlayOpacity||45,   "%");

  renderNav(); renderSvcSettings(); renderSortList(); initEngine(); updateClock(); updateScrollCue();
}

// 設定イベント
document.querySelectorAll(".tbtn").forEach(b=>{b.addEventListener("click",()=>{P.theme=b.dataset.theme;savePrefs();applyPrefs();});});
document.querySelectorAll(".bsbtn").forEach(b=>{b.addEventListener("click",()=>{P.bgStyle=b.dataset.bg;savePrefs();applyPrefs();});});
document.querySelectorAll(".lmbtn").forEach(b=>{b.addEventListener("click",()=>{P.layoutMode=b.dataset.lm;savePrefs();applyPrefs();});});
document.querySelectorAll(".ptbtn").forEach(b=>{b.addEventListener("click",()=>{P.photoTiming=b.dataset.pt;savePrefs();applyPrefs();});});
document.getElementById("refresh-photo").addEventListener("click",refreshPhoto);
document.getElementById("name-input").addEventListener("input",e=>{P.userName=e.target.value;savePrefs();updateClock();});

// スライダーイベント
[
  ["sl-brightness",  "textBrightness", "%"],
  ["sl-sub-opacity", "subOpacity",     "%"],
  ["sl-clock-weight","clockWeight",    ""],
  ["sl-overlay",     "overlayOpacity", "%"],
].forEach(([id,key,sfx])=>{
  document.getElementById(id).addEventListener("input",e=>{
    P[key]=Number(e.target.value);
    document.getElementById(id+"-val").textContent=e.target.value+sfx;
    savePrefs(); applyTextStyles();
    if(key==="overlayOpacity"){
      const ov=(P.overlayOpacity||45)/100;
      document.getElementById("bg-overlay").style.background=`rgba(0,0,0,${ov})`;
    }
  });
});

[["t-search","showSearch"],["t-nav","showNav"],["t-tracker","showTracker"],["t-heatmap","showHeatmap"],["t-clock","showClock"]].forEach(([id,key])=>{
  document.getElementById(id).addEventListener("change",e=>{P[key]=e.target.checked;savePrefs();applyPrefs();});
});

document.getElementById("settings-btn").addEventListener("click",()=>{
  document.getElementById("sp").classList.add("open");
  document.getElementById("sp-overlay").classList.add("open");
});

// スクロールキュー：下に見るものが無ければ隠す／スクロールしたら消す
function updateScrollCue(){
  const page=document.getElementById("page");
  const hasMore = (P.showTracker || P.showHeatmap) && (P.layoutMode||"scroll")==="scroll";
  document.getElementById("scroll-cue").style.display = hasMore ? "" : "none";
  page.classList.toggle("scrolled", page.scrollTop > 24);
}
document.getElementById("page").addEventListener("scroll",()=>{
  updateScrollCue();
  if(engineMenuOpen) closeEngineMenu();
});
document.getElementById("scroll-cue").addEventListener("click",()=>{
  document.getElementById("tracker").scrollIntoView({behavior:"smooth",block:"start"});
});
function closeSettings(){
  document.getElementById("sp").classList.remove("open");
  document.getElementById("sp-overlay").classList.remove("open");
}
document.getElementById("sp-close").addEventListener("click",closeSettings);
document.getElementById("sp-overlay").addEventListener("click",closeSettings);

// ━━━ 初期化 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
loadPrefs(()=>{
  loadPhotoCache(()=>{

    if (photoCache?.url) {
      displayPhoto(photoCache);
    }

    applyPrefs();

    loadTracker();
    loadStats();
    loadYear();
    setInterval(loadTracker,5000);
    setInterval(loadStats,20000);
  });
});

document.getElementById('photo-category').addEventListener('change', async e => {
  P.photoCategory = e.target.value;
  await chrome.storage.local.set({__prefs__:P, __photo_retry__:0});
  refreshPhoto();
});
document.getElementById('break-enabled').addEventListener('change', e => {
  P.breakEnabled = e.target.checked; savePrefs();
});
document.getElementById('break-minutes').addEventListener('change', e => {
  P.breakMinutes = Math.max(1,Math.min(480,Math.round(Number(e.target.value)||30)));
  e.target.value = P.breakMinutes; savePrefs();
});
