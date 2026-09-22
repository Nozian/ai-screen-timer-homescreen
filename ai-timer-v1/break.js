let state = null;
async function update() {
  state = await chrome.runtime.sendMessage({type:'GET_BREAK_STATUS'});
  if (!state || state.error) return;
  document.getElementById('usage').textContent = `今日はAIを ${Math.floor(state.total/60)} 分使いました`;
  const remaining = Math.max(0, Math.ceil((state.restUntil-Date.now())/1000));
  document.getElementById('rest').disabled = remaining > 0;
  document.getElementById('message').textContent = remaining
    ? `休憩中 — あと ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}。肩を伸ばしたり、窓の外を見てみよう。`
    : state.blocked ? '画面から目を離して、ひと息つきませんか。' : 'おかえりなさい。休憩画面を閉じています。';
}
for (const action of ['rest','snooze','disable']) {
  document.getElementById(action).addEventListener('click', async () => {
    try {
      const result = await chrome.runtime.sendMessage({type:'BREAK_ACTION',action});
      if (result?.error) throw Error(result.error);
      await update();
    } catch (_) { document.getElementById('error').textContent = '操作を完了できませんでした。もう一度お試しください。'; }
  });
}
chrome.runtime.sendMessage({type:'GET_PHOTO'}).then(result => PhotoUI.render(document.getElementById('scenery'),document.getElementById('credit'),result?.photo)).catch(()=>{});
update().catch(()=>{});
setInterval(()=>update().catch(()=>{}),1000);
document.getElementById('rest').focus();

PhraseUI.mount(document.getElementById('break-phrase'),document.getElementById('title')).catch(()=>{});
