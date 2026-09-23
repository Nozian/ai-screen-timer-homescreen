importScripts("photo-service.js", "break-service.js");
// background.js  v5

const SERVICES = [
  { id:"chatgpt",    name:"ChatGPT",    color:"#10a37f", url:"https://chatgpt.com",                  domains:["chatgpt.com"],                 urlFilter:null,      urlExclude:null      },
  { id:"claude",     name:"Claude",     color:"#d97706", url:"https://claude.ai",                    domains:["claude.ai"],                   urlFilter:null,      urlExclude:null      },
  { id:"gemini",     name:"Gemini",     color:"#4285f4", url:"https://gemini.google.com",            domains:["gemini.google.com"],           urlFilter:null,      urlExclude:null      },
  { id:"perplexity", name:"Perplexity", color:"#a855f7", url:"https://perplexity.ai",                domains:["perplexity.ai"],               urlFilter:null,      urlExclude:null      },
  { id:"grok",       name:"Grok",       color:"#9ca3af", url:"https://grok.com",                     domains:["grok.com","x.com"],            urlFilter:null,      urlExclude:null      },
  { id:"google_ai",  name:"Google AI",  color:"#ea4335", url:"https://www.google.com/search?udm=50", domains:["google.com","www.google.com"], urlFilter:"udm=50",  urlExclude:null      },
  { id:"google",     name:"Google",     color:"#fbbc04", url:"https://www.google.com",               domains:["google.com","www.google.com"], urlFilter:null,      urlExclude:"udm=50"  },
  { id:"twitter",    name:"X (Twitter)",color:"#1d9bf0", url:"https://x.com",                        domains:["x.com","twitter.com"],         urlFilter:null,      urlExclude:"/i/grok" },
  { id:"youtube",    name:"YouTube",    color:"#ff0000", url:"https://www.youtube.com",              domains:["youtube.com","www.youtube.com"],urlFilter:null,      urlExclude:null      },
];

// Chrome 120+ production extensions schedule alarms no faster than every 30 seconds.
const TICK = 30;
let focused = true;

// ── アイドル検出 ────────────────────────────────────────
// 60秒操作がなければ idle 扱い。tick のたびに毎回同期確認する。
const IDLE_THRESHOLD_SEC = 60;
chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);
function isActiveNow() {
  return new Promise(res => {
    chrome.idle.queryState(IDLE_THRESHOLD_SEC, state => res(state === "active"));
  });
}

// ── セッション検出 ──────────────────────────────────────
// 同一サービスで前回の加算から SESSION_GAP 以上間が空いたら新セッション扱い。
const SESSION_GAP_MS = 5 * 60 * 1000;
function sessionKeyFor(id, d) { return `${id}_ses_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}`; }

// ── 日時キー ────────────────────────────────────────────
// 既存のキー書式は完全に維持したまま、任意の日付から生成できるよう一般化
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();                       // 0=日
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x;
}
function dayKeyFor(id, d)   { return `${id}_d_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}`; }
function weekKeyFor(id, d)  { const m=mondayOf(d); return `${id}_w_${m.getFullYear()}_${m.getMonth()+1}_${m.getDate()}`; }
function monthKeyFor(id, d) { return `${id}_m_${d.getFullYear()}_${d.getMonth()+1}`; }
// 時間帯データ：1日1キーに { "14": { chatgpt: 300 }, ... } の形でまとめて保存
function hourKeyFor(d)      { return `__hr_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}`; }

function dayKey(id)  { return dayKeyFor(id, new Date()); }
function weekKey(id) { return weekKeyFor(id, new Date()); }
function monthKey(id){ return monthKeyFor(id, new Date()); }
function allKeys()   { return SERVICES.flatMap(s=>[dayKey(s.id),weekKey(s.id),monthKey(s.id)]); }

const STATS_DAYS = 100;  // 先月・2ヶ月前の全期間まで賄える日数
const HOURLY_KEEP_DAYS = 90;
const HOURLY_SEND_DAYS = 14;  // GET_STATSで返す時間帯別の日数（日ナビの遡り上限）

function getServiceId(url) {
  if (!url) return null;
  for (const s of SERVICES) {
    for (const domain of s.domains) {
      if (!url.includes(domain)) continue;
      if (s.urlExclude && url.includes(s.urlExclude)) continue;
      if (domain==="x.com" && s.id==="grok" && !url.includes("/i/grok")) continue;
      if (s.urlFilter && !url.includes(s.urlFilter)) continue;
      return s.id;
    }
  }
  return null;
}

async function isTrackingDisabled(sid) {
  return new Promise(res => {
    chrome.storage.local.get("__prefs__", r => {
      res(((r.__prefs__||{}).trackingOff||[]).includes(sid));
    });
  });
}

async function addSec(sid, sec) {
  if (await isTrackingDisabled(sid)) return;
  if (AI_IDS.includes(sid) && (await getBreakStatus()).blocked) return;
  const now = new Date();
  const nowMs = now.getTime();
  const dk=dayKey(sid), wk=weekKey(sid), mk=monthKey(sid);
  const hk=hourKeyFor(now), hr=String(now.getHours());
  const sk=sessionKeyFor(sid, now);
  const lastKey=`__last_${sid}`;
  return new Promise(res => {
    chrome.storage.local.get([dk,wk,mk,hk,sk,lastKey], r => {
      // 時間帯別（この実装以降に記録された分のみ蓄積される）
      const hourly = r[hk] || {};
      if (!hourly[hr]) hourly[hr] = {};
      hourly[hr][sid] = (hourly[hr][sid]||0) + sec;

      // セッション（「回数」「1回あたりの長さ」を可視化するための土台）
      const lastTs = r[lastKey] || 0;
      const gap = nowMs - lastTs;
      let ses = r[sk] || { count:0, maxSec:0, curSec:0 };
      if (!lastTs || gap > SESSION_GAP_MS) ses = { count: ses.count+1, maxSec: ses.maxSec, curSec: 0 };
      ses.curSec += sec;
      if (ses.curSec > ses.maxSec) ses.maxSec = ses.curSec;

      const u = {
        [dk]:(r[dk]||0)+sec,
        [wk]:(r[wk]||0)+sec,
        [mk]:(r[mk]||0)+sec,
        [hk]:hourly,
        [sk]:ses,
        [lastKey]:nowMs,
      };
      chrome.storage.local.set(u, () => { push(sid,u[dk],u[wk],u[mk]); updateBadge(); res(); });
    });
  });
}

// ── ツールバーバッジ：今日の合計を常時表示 ──────────────────
function fmtBadge(sec) {
  if (!sec) return "";
  if (sec < 60) return "<1m";
  const h=Math.floor(sec/3600), m=Math.round((sec%3600)/60);
  if (h>0) return m>0 ? `${h}h${m}` : `${h}h`;
  return `${m}m`;
}
function updateBadge() {
  const keys = SERVICES.map(s=>dayKey(s.id));
  chrome.storage.local.get(keys, r => {
    const total = keys.reduce((s,k)=>s+(r[k]||0),0);
    chrome.action.setBadgeText({ text: fmtBadge(total) });
    chrome.action.setBadgeBackgroundColor({ color: "#5E5CE6" });
  });
}
chrome.runtime.onStartup?.addListener(updateBadge);
chrome.runtime.onInstalled?.addListener(updateBadge);
updateBadge();

// 日付が変わった瞬間にバッジを0リセットするための定期チェック
let lastBadgeDay = new Date().getDate();
setInterval(() => {
  const d = new Date().getDate();
  if (d !== lastBadgeDay) { lastBadgeDay = d; updateBadge(); }
}, 60*1000);

// 古い時間帯データ・セッションデータの掃除（90日より前は破棄）
function cleanupHourly() {
  chrome.storage.local.get(null, all => {
    const limit = new Date();
    limit.setDate(limit.getDate() - HOURLY_KEEP_DAYS);
    const del = Object.keys(all).filter(k => {
      const isHr  = k.startsWith("__hr_");
      const isSes = /_ses_\d+_\d+_\d+$/.test(k);
      if (!isHr && !isSes) return false;
      const parts = isHr ? k.slice(5).split("_") : k.split("_ses_")[1].split("_");
      const p = parts.map(Number);
      if (p.length !== 3 || p.some(isNaN)) return true;
      return new Date(p[0], p[1]-1, p[2]) < limit;
    });
    if (del.length) chrome.storage.local.remove(del);
  });
}
chrome.runtime.onStartup?.addListener(cleanupHourly);
chrome.runtime.onInstalled?.addListener(cleanupHourly);

function push(sid, today, week, month) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(t => {
      if (getServiceId(t.url||"")===sid)
        chrome.tabs.sendMessage(t.id,{type:"TIME_UPDATE",sid,today,week,month}).catch(()=>{});
    });
  });
}

chrome.alarms.create("tick",{periodInMinutes:TICK/60});
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name!=="tick"||!focused) return;
  if (!(await isActiveNow())) return;   // 操作が無い間はカウントしない
  const tabs=await new Promise(r=>chrome.tabs.query({active:true,currentWindow:true},r));
  const sid=getServiceId(tabs?.[0]?.url||"");
  if (sid) await addSec(sid,TICK);
});

chrome.windows.onFocusChanged.addListener(wid=>{focused=wid!==chrome.windows.WINDOW_ID_NONE;});

// ── メッセージ ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg,_,res)=>{
  if (msg.type==="GET_ALL") {
    chrome.storage.local.get(allKeys(),r=>{
      const data={};
      SERVICES.forEach(s=>{data[s.id]={name:s.name,color:s.color,url:s.url,today:r[dayKey(s.id)]||0,week:r[weekKey(s.id)]||0,month:r[monthKey(s.id)]||0};});
      res({services:data,order:SERVICES.map(s=>s.id)});
    });
    return true;
  }
  if (msg.type==="GET_MY_TIMES") {
    const sid=msg.sid;
    chrome.storage.local.get([dayKey(sid),weekKey(sid),monthKey(sid)],r=>{
      res({today:r[dayKey(sid)]||0,week:r[weekKey(sid)]||0,month:r[monthKey(sid)]||0});
    });
    return true;
  }
  // 時間帯別 + 日別履歴 + セッション履歴（曜日別グラフ・月別グラフ・前期比・セッション統計の元データ）
  if (msg.type==="GET_STATS") {
    const now = new Date();
    const hk  = hourKeyFor(now);

    const days = [];
    for (let i = STATS_DAYS - 1; i >= 0; i--) {
      days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    }
    const dayKeys = [], sesKeys = [], hrKeys = [];
    days.forEach(d => SERVICES.forEach(s => { dayKeys.push(dayKeyFor(s.id, d)); sesKeys.push(sessionKeyFor(s.id, d)); }));
    for (let i = 0; i < HOURLY_SEND_DAYS; i++) {
      hrKeys.push(hourKeyFor(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
    }

    chrome.storage.local.get([hk, ...dayKeys, ...sesKeys, ...hrKeys], r => {
      const hourlyByDate = {};
      for (let i = 0; i < HOURLY_SEND_DAYS; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const v = r[hourKeyFor(d)];
        if (v) hourlyByDate[`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`] = v;
      }
      const daily = days.map(d => {
        const services = {}, sessions = {}; let total = 0;
        SERVICES.forEach(s => {
          const v = r[dayKeyFor(s.id, d)] || 0;
          if (v) { services[s.id] = v; total += v; }
          const se = r[sessionKeyFor(s.id, d)];
          if (se && se.count) sessions[s.id] = { count: se.count, maxSec: se.maxSec };
        });
        return { y:d.getFullYear(), m:d.getMonth()+1, d:d.getDate(), dow:d.getDay(), services, sessions, total };
      });
      res({
        hourly: r[hk] || {},
        hourlyByDate,
        daily,
        now: { y:now.getFullYear(), m:now.getMonth()+1, d:now.getDate(), dow:now.getDay(), hour:now.getHours() },
      });
    });
    return true;
  }

  // 年間ヒートマップ用：直近53週分（371日）の日別合計のみを軽量取得
  if (msg.type==="GET_YEAR") {
    const now = new Date();
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // 「52週間前の月曜」を起点にして、今日まで生成する（今日を必ず含める）
    const start = mondayOf(new Date(today0.getFullYear(), today0.getMonth(), today0.getDate()-364));
    const dayCount = Math.round((today0 - start) / 86400000) + 1;
    const days = [];
    for (let i=0;i<dayCount;i++) days.push(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
    const dayKeys = [];
    days.forEach(d => SERVICES.forEach(s => dayKeys.push(dayKeyFor(s.id, d))));
    chrome.storage.local.get(dayKeys, r => {
      const cells = days.map(d => {
        let total=0; SERVICES.forEach(s=>{ total += r[dayKeyFor(s.id,d)]||0; });
        return { y:d.getFullYear(), m:d.getMonth()+1, d:d.getDate(), total };
      });
      res({ cells, todayIdx: cells.length-1 });
    });
    return true;
  }

  // データエクスポート用：保存済みの全生データをそのまま返す
  if (msg.type==="GET_EXPORT") {
    chrome.storage.local.get(null, all => {
      const out = { exportedAt: new Date().toISOString(), services: SERVICES.map(s=>({id:s.id,name:s.name})), raw: all };
      res(out);
    });
    return true;
  }

  if (msg.type==="OPEN_DASH") {
    chrome.tabs.create({url:chrome.runtime.getURL("newtab.html")});
    return true;
  }
});

// Only extension pages can fetch photos or control the break timer.
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const ownPage = ["newtab.html", "break.html"].some(path => sender.url === chrome.runtime.getURL(path));
  let task;
  if (msg.type === 'GET_PHOTO' && ownPage) task = getPhoto(msg.force === true);
  if (msg.type === 'PHOTO_USED' && ownPage) task = trackPhoto(msg.id).then(()=>({ok:true}));
  if (msg.type === 'GET_BREAK_STATUS') task = getBreakStatus();
  if (msg.type === 'BREAK_ACTION' && ownPage && ['rest','snooze','disable'].includes(msg.action)) task = performBreakAction(msg.action);
  if (!task) return;
  task.then(respond).catch(()=>respond({error:'処理を完了できませんでした。'}));
  return true;
});
