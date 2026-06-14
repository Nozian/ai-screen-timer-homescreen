// content.js v5 - デフォルト最小化ピル、クリックで展開
(function () {
  if (document.getElementById("ait-w")) return;

  function detect() {
    const host=location.hostname, path=location.pathname, qs=location.search;
    if (host.includes("google.com") && qs.includes("udm=50")) return {id:"google_ai",name:"Google AI",color:"#ea4335"};
    if ((host==="x.com"||host.includes("twitter.com")) && path.includes("/i/grok")) return {id:"grok",name:"Grok",color:"#9ca3af"};
    if (host==="x.com"||host.includes("twitter.com")) return {id:"twitter",name:"X",color:"#1d9bf0"};
    if (host.includes("grok.com"))        return {id:"grok",      name:"Grok",      color:"#9ca3af"};
    if (host.includes("chatgpt.com"))     return {id:"chatgpt",   name:"ChatGPT",   color:"#10a37f"};
    if (host.includes("claude.ai"))       return {id:"claude",    name:"Claude",    color:"#d97706"};
    if (host.includes("gemini.google.com")) return {id:"gemini",  name:"Gemini",    color:"#4285f4"};
    if (host.includes("perplexity.ai"))   return {id:"perplexity",name:"Perplexity",color:"#a855f7"};
    if (host.includes("youtube.com"))     return {id:"youtube",   name:"YouTube",   color:"#ff0000"};
    if (host.includes("google.com"))      return {id:"google",    name:"Google",    color:"#fbbc04"};
    return null;
  }

  const svc = detect();
  if (!svc) return;

  function fmt(s) {
    if (!s||s<60) return s?`${s}s`:"0s";
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    if (h>0) return `${h}h${m}m`;
    return `${m}m`;
  }

  // ウィジェット構築
  const w = document.createElement("div");
  w.id = "ait-w";
  w.style.setProperty("--c", svc.color);

  w.innerHTML = `
    <!-- ピル（最小化状態） -->
    <div id="ait-pill">
      <span id="ait-pill-dot"></span>
      <span id="ait-pill-name">${svc.name}</span>
      <span id="ait-pill-time">--</span>
    </div>
    <!-- 展開パネル -->
    <div id="ait-panel">
      <div id="ait-phdr">
        <span id="ait-pdot"></span>
        <span id="ait-pname">${svc.name}</span>
        <button id="ait-pdb" title="ダッシュボード">↗</button>
        <button id="ait-pcls" title="最小化">−</button>
      </div>
      <div id="ait-pbody">
        <div class="ar"><span class="al">今日</span><div class="at"><div class="ab" id="ab0"></div></div><span class="av" id="av0">--</span></div>
        <div class="ar"><span class="al">今週</span><div class="at"><div class="ab" id="ab1"></div></div><span class="av" id="av1">--</span></div>
        <div class="ar"><span class="al">今月</span><div class="at"><div class="ab" id="ab2"></div></div><span class="av" id="av2">--</span></div>
      </div>
    </div>
  `;
  document.body.appendChild(w);

  // ピルクリックで展開
  document.getElementById("ait-pill").addEventListener("click", () => {
    w.classList.add("expanded");
  });
  // 閉じるボタン
  document.getElementById("ait-pcls").addEventListener("click", () => {
    w.classList.remove("expanded");
  });
  // ダッシュボード
  document.getElementById("ait-pdb").addEventListener("click", () => {
    chrome.runtime.sendMessage({type:"OPEN_DASH"});
  });

  // ドラッグ（展開パネルのヘッダー）
  let drag=false,ox=0,oy=0;
  document.getElementById("ait-phdr").addEventListener("mousedown",e=>{
    if(["ait-pcls","ait-pdb"].includes(e.target.id)) return;
    drag=true;
    const r=w.getBoundingClientRect(); ox=e.clientX-r.left; oy=e.clientY-r.top;
    w.style.transition="none"; e.preventDefault();
  });
  document.addEventListener("mousemove",e=>{
    if(!drag) return;
    w.style.right="auto"; w.style.bottom="auto";
    w.style.left=(e.clientX-ox)+"px"; w.style.top=(e.clientY-oy)+"px";
  });
  document.addEventListener("mouseup",()=>{drag=false;});

  // データ更新
  let maxM=60;
  function upd(today,week,month) {
    maxM=Math.max(maxM,month,1);
    // ピル：今日の時間だけ表示
    document.getElementById("ait-pill-time").textContent=fmt(today);
    // パネル
    document.getElementById("av0").textContent=fmt(today);
    document.getElementById("av1").textContent=fmt(week);
    document.getElementById("av2").textContent=fmt(month);
    requestAnimationFrame(()=>{
      document.getElementById("ab0").style.width=Math.min(100,Math.round(today/maxM*100))+"%";
      document.getElementById("ab1").style.width=Math.min(100,Math.round(week/maxM*100))+"%";
      document.getElementById("ab2").style.width="100%";
    });
  }

  chrome.runtime.sendMessage({type:"GET_MY_TIMES",sid:svc.id},r=>{if(r)upd(r.today,r.week,r.month);});
  chrome.runtime.onMessage.addListener(msg=>{
    if(msg.type==="TIME_UPDATE"&&msg.sid===svc.id) upd(msg.today,msg.week,msg.month);
  });
})();
