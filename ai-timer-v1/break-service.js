const AI_IDS = ['chatgpt','claude','gemini','perplexity','grok','google_ai'];
const breakDate = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };
function breakDecision(prefs, state, total, now, date) {
  const enabled = prefs.breakEnabled === true;
  const minutes = Math.max(1, Math.min(480, Number(prefs.breakMinutes) || 30));
  const s = state?.date === date ? state : {};
  const threshold = Math.max(minutes * 60, s.nextAt || 0);
  const blocked = enabled && !s.disabled && (s.restUntil > now || (total >= threshold && !(s.snoozeUntil > now)));
  return {blocked, total, minutes, restUntil:s.restUntil || 0, date};
}
async function getBreakStatus() {
  const keys = AI_IDS.map(dayKey);
  const r = await chrome.storage.local.get(['__prefs__','__break__',...keys]);
  return breakDecision(r.__prefs__ || {}, r.__break__, keys.reduce((n,k)=>n+(r[k]||0),0), Date.now(), breakDate());
}
let breakActionQueue = Promise.resolve();
function performBreakAction(action) {
  breakActionQueue = breakActionQueue.catch(()=>{}).then(async () => {
    const status = await getBreakStatus();
    const r = await chrome.storage.local.get('__break__');
    const state = r.__break__?.date === status.date ? r.__break__ : {date:status.date};
    if (action === 'snooze') { state.snoozeUntil = Date.now()+5*60000; state.restUntil = 0; }
    else if (action === 'disable') { state.disabled = true; state.restUntil = 0; }
    else if (action === 'rest' && !(state.restUntil > Date.now())) {
      state.restUntil = Date.now()+5*60000;
      state.nextAt = status.total + status.minutes*60;
      state.snoozeUntil = 0;
    }
    await chrome.storage.local.set({__break__:state});
    return getBreakStatus();
  });
  return breakActionQueue;
}
