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
  theme:"dark", bgStyle:"photo", userName:"",
  showSearch:true, showNav:true, showTracker:true, showClock:true,
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

// 写真背景：URL直指定方式（fetch不要・Momentumと同方式）
// MV3拡張ページのCSPはCSS背景画像の外部URLを制限しないため、
// picsum.photosのURLをそのまま background-image に指定できる。
// Image()でプリロードして読み込み完了後に表示 → グレー画面なし。
const CACHE_TTL_HOURLY = 60 * 60 * 1000;
let photoCache = null;            // { url, credit, cachedAt }
let photoFetchedThisSession = false;
let photoLoading = false;

function loadPhotoCache(cb) {
  chrome.storage.local.get("__photo__", r => {
    photoCache = r.__photo__ || null;
    // 旧形式（dataUrl）のキャッシュは破棄
    if (photoCache && !photoCache.url) photoCache = null;
    cb();
  });
}
function savePhotoCache() { chrome.storage.local.set({ __photo__: photoCache }); }

function genPhotoUrl() {
  const seed = Math.floor(Math.random() * 100000);
  return { seed, url: `https://picsum.photos/seed/${seed}/1920/1080` };
}

// クレジット取得（ベストエフォート：失敗しても写真表示は続行）
async function fetchCredit(seed) {
  try {
    const resp = await fetch(`https://picsum.photos/seed/${seed}/info`);
    if (!resp.ok) return null;
    const info = await resp.json();
    return { author: info.author || "Unknown", sourceUrl: info.url || "https://unsplash.com" };
  } catch(_) { return null; }
}

function shouldPrefetchNext() {
  if (P.photoTiming === "manual") return false;
  if (P.photoTiming === "newtab") return !photoFetchedThisSession;
  if (P.photoTiming === "hourly") return !photoCache || (Date.now() - photoCache.cachedAt) > CACHE_TTL_HOURLY;
  return false;
}

const FALLBACK_GRAD = "linear-gradient(135deg,#0d1b2a,#1b263b,#0a1628)";

function displayPhoto(cache) {
  bgPhoto.style.background = "";
  bgPhoto.style.backgroundImage = `url("${cache.url}")`;
  showCredit(cache.credit);
}

// 新しい写真をプリロードしてキャッシュ保存。
// displayWhenReady=true なら読み込み完了後に表示も行う。
function prefetchPhoto(displayWhenReady) {
  if (photoLoading) return;
  photoLoading = true;
  const { seed, url } = genPhotoUrl();
  const img = new Image();
  img.onload = async () => {
    const credit = await fetchCredit(seed);
    photoCache = { url, credit, cachedAt: Date.now() };
    savePhotoCache();
    photoFetchedThisSession = true;
    photoLoading = false;
    if (displayWhenReady) displayPhoto(photoCache);
  };
  img.onerror = () => {
    photoLoading = false;
    console.warn("[AI Screen Time] photo preload failed:", url);
    if (displayWhenReady && !photoCache?.url) bgPhoto.style.background = FALLBACK_GRAD;
  };
  img.src = url;
}

function applyBg() {
  const isPhoto = P.bgStyle === "photo";
  bgPhoto.style.display  = isPhoto ? "block" : "none";
  bgCanvas.style.display = isPhoto ? "none"  : "block";

  const ov = (P.overlayOpacity||45) / 100;
  document.getElementById("bg-overlay").style.background = `rgba(0,0,0,${ov})`;

  if (!isPhoto) { document.getElementById("photo-credit").style.display="none"; return; }

  if (photoCache?.url) {
    // ① キャッシュ即表示（ブラウザのHTTPキャッシュで瞬時に出る）
    displayPhoto(photoCache);
    // ② 必要なら裏で次の写真をプリロード（表示は差し替えない）
    if (shouldPrefetchNext()) prefetchPhoto(false);
  } else {
    // 初回のみ：読み込み完了次第表示
    bgPhoto.style.backgroundImage = "none";
    bgPhoto.style.background = FALLBACK_GRAD;
    prefetchPhoto(true);
  }
}

function refreshPhoto(){
  // 強制的に新しい写真を取得して即表示
  const btn = document.getElementById("refresh-photo");
  btn.textContent = "📷 取得中...";
  photoLoading = false; // 強制リセット
  const { seed, url } = genPhotoUrl();
  const img = new Image();
  img.onload = async () => {
    const credit = await fetchCredit(seed);
    photoCache = { url, credit, cachedAt: Date.now() };
    savePhotoCache();
    displayPhoto(photoCache);
    btn.textContent = "📷 今すぐ変える";
  };
  img.onerror = () => { btn.textContent = "📷 今すぐ変える（失敗・再試行可）"; };
  img.src = url;
}

function showCredit(credit){
  const el=document.getElementById("photo-credit");
  if(!credit?.author){el.style.display="none";return;}
  el.style.display="block";
  el.innerHTML=`Photo by <a href="${credit.sourceUrl}" target="_blank" rel="noopener">${credit.author}</a> / <a href="https://unsplash.com" target="_blank" rel="noopener">Unsplash</a> (via Picsum)`;
}

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
  engineMenu.style.top=(r.bottom+8)+"px"; engineMenu.style.left=r.left+"px";
  engineMenu.classList.add("open"); engineMenuOpen=true;
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
let period="today", rawData=null;
function fmtShort(sec){
  if(!sec) return "0m";
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);
  if(h>0) return `${h}h${m}m`; if(m>0) return `${m}m`; return `${sec}s`;
}
function loadTracker(){
  chrome.runtime.sendMessage({type:"GET_ALL"},res=>{if(!res)return;rawData=res.services;renderTracker();});
}
function renderTracker(){
  if(!rawData) return;
  const hidden=P.hiddenIds||[];
  const entries=P.chipOrder.filter(id=>!hidden.includes(id)).map(id=>{
    const s=SERVICES.find(x=>x.id===id); if(!s) return null;
    return {id,name:s.name,color:s.color,sec:rawData[id]?.[period]||0};
  }).filter(Boolean).sort((a,b)=>b.sec-a.sec);
  const total=entries.reduce((s,e)=>s+e.sec,0);
  const maxSec=entries[0]?.sec||1;

  drawDonut(entries,total);
  document.getElementById("donut-total").textContent=fmtShort(total);
  const barsEl=document.getElementById("bars"); barsEl.innerHTML="";
  if(!total){barsEl.innerHTML=`<div class="empty-msg">各サービスを使うと<br>ここに記録されます</div>`;return;}
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
function drawDonut(entries,total){
  const cv=document.getElementById("donut");

  // 描画サイズを強制設定
  cv.width = 110;
  cv.height = 110;

  const ctx=cv.getContext("2d");
  ctx.setTransform(1,0,0,1,0,0);

  const W2=110,cx=W2/2,cy=W2/2,R=48,ri=33;
  ctx.clearRect(0,0,W2,W2);
  if(!total){ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.arc(cx,cy,ri,0,Math.PI*2,true);ctx.fillStyle="rgba(255,255,255,0.05)";ctx.fill();return;}
  let angle=-Math.PI/2;
  entries.forEach(e=>{
    if(!e.sec) return;
    const slice=(e.sec/total)*Math.PI*2-.03;
    ctx.beginPath();ctx.moveTo(cx+R*Math.cos(angle+.015),cy+R*Math.sin(angle+.015));
    ctx.arc(cx,cy,R,angle+.015,angle+slice+.015);ctx.arc(cx,cy,ri,angle+slice+.015,angle+.015,true);
    ctx.closePath();ctx.fillStyle=e.color;ctx.fill();angle+=slice+.03;
  });
}
document.querySelectorAll(".ttab").forEach(btn=>{
  btn.addEventListener("click",()=>{document.querySelectorAll(".ttab").forEach(b=>b.classList.remove("active"));btn.classList.add("active");period=btn.dataset.p;renderTracker();});
});

// ━━━ 設定パネル ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function renderSvcSettings(){
  const wrap=document.getElementById("svc-settings"); wrap.innerHTML="";
  SERVICES.forEach(s=>{
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
  applyBg(); applyTextStyles();

  // 機能オンオフ
  document.getElementById("search-wrap").style.display = P.showSearch  ?"":"none";
  document.getElementById("ai-nav").style.display      = P.showNav     ?"":"none";
  document.getElementById("tracker").style.display     = P.showTracker ?"":"none";
  document.getElementById("clock").style.display       = P.showClock   ?"":"none";
  document.getElementById("greeting").style.display    = P.showClock   ?"":"none";
  document.getElementById("dateline").style.display    = P.showClock   ?"":"none";

  // 写真オプション表示
  document.getElementById("photo-options").style.display = P.bgStyle==="photo"?"flex":"none";

  // 設定UIに反映
  document.querySelectorAll(".tbtn").forEach(b=>b.classList.toggle("on",b.dataset.theme===P.theme));
  document.querySelectorAll(".bsbtn").forEach(b=>b.classList.toggle("on",b.dataset.bg===P.bgStyle));
  document.querySelectorAll(".ptbtn").forEach(b=>b.classList.toggle("on",b.dataset.pt===P.photoTiming));
  document.getElementById("name-input").value      = P.userName||"";
  document.getElementById("t-search").checked      = P.showSearch;
  document.getElementById("t-nav").checked         = P.showNav;
  document.getElementById("t-tracker").checked     = P.showTracker;
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

  renderNav(); renderSvcSettings(); renderSortList(); initEngine(); updateClock();
}

// 設定イベント
document.querySelectorAll(".tbtn").forEach(b=>{b.addEventListener("click",()=>{P.theme=b.dataset.theme;savePrefs();applyPrefs();});});
document.querySelectorAll(".bsbtn").forEach(b=>{b.addEventListener("click",()=>{P.bgStyle=b.dataset.bg;savePrefs();applyPrefs();});});
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

[["t-search","showSearch"],["t-nav","showNav"],["t-tracker","showTracker"],["t-clock","showClock"]].forEach(([id,key])=>{
  document.getElementById(id).addEventListener("change",e=>{P[key]=e.target.checked;savePrefs();applyPrefs();});
});

document.getElementById("settings-btn").addEventListener("click",()=>{
  document.getElementById("sp").classList.add("open");
  document.getElementById("sp-overlay").classList.add("open");
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

    setTimeout(() => {
      const bg = document.getElementById("bg-photo");
      if (P.bgStyle === "photo" && photoCache?.url &&
          (!bg.style.backgroundImage || bg.style.backgroundImage === "")) {
        displayPhoto(photoCache);
      }
    }, 300);

    loadTracker();
    setInterval(loadTracker,5000);
  });
});
