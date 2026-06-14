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

const TICK = 5;
let focused = true;

function dayKey(id)  { const d=new Date(); return `${id}_d_${d.getFullYear()}_${d.getMonth()+1}_${d.getDate()}`; }
function weekKey(id) {
  const d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1);
  const m=new Date(new Date(d).setDate(diff));
  return `${id}_w_${m.getFullYear()}_${m.getMonth()+1}_${m.getDate()}`;
}
function monthKey(id){ const d=new Date(); return `${id}_m_${d.getFullYear()}_${d.getMonth()+1}`; }
function allKeys()   { return SERVICES.flatMap(s=>[dayKey(s.id),weekKey(s.id),monthKey(s.id)]); }

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
  const dk=dayKey(sid),wk=weekKey(sid),mk=monthKey(sid);
  return new Promise(res => {
    chrome.storage.local.get([dk,wk,mk], r => {
      const u={[dk]:(r[dk]||0)+sec,[wk]:(r[wk]||0)+sec,[mk]:(r[mk]||0)+sec};
      chrome.storage.local.set(u, () => { push(sid,u[dk],u[wk],u[mk]); res(); });
    });
  });
}

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
  if (msg.type==="OPEN_DASH") {
    chrome.tabs.create({url:chrome.runtime.getURL("newtab.html")});
    return true;
  }
});
