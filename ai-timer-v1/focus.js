(async()=>{
  const audio=new FocusAudio();
  const defaults={bgmPreset:'chords',ambientPreset:'rain',bgmVolume:35,ambientVolume:35};
  const stored=(await chrome.storage.local.get('__focus_audio__')).__focus_audio__ || {};
  const prefs={...defaults,...stored};
  const status=document.getElementById('focus-status');
  async function save(){await chrome.storage.local.set({__focus_audio__:prefs});}
  for(const kind of ['bgm','ambient']) {
    const button=document.getElementById(kind+'-play'), select=document.getElementById(kind+'-preset'), volume=document.getElementById(kind+'-volume'), value=document.getElementById(kind+'-value');
    const name=kind==='bgm'?'BGM':'環境音';let active=false,pending=false,operation=0;
    select.value=prefs[kind+'Preset'];if(!select.value)select.selectedIndex=0;prefs[kind+'Preset']=select.value;
    volume.value=Math.max(0,Math.min(100,Number(prefs[kind+'Volume'])||0));value.textContent=volume.value+'%';
    const paint=()=>{button.textContent=pending?'停止':active?'停止':'再生';button.setAttribute('aria-pressed',String(active||pending));button.setAttribute('aria-label',`${name}を${active||pending?'停止':'再生'}`);};
    async function start(){
      const token=++operation;pending=true;paint();
      try {
        if(await audio.play(kind,select.value,volume.value) && token===operation) {active=true;status.textContent='再生中。このホームのタブを開いたまま、ほかのタブで作業できます。';}
      } catch(_){if(token!==operation)return;active=false;audio.stop(kind);status.textContent='音を再生できませんでした。もう一度、再生を押してください。';}
      finally{if(token===operation){pending=false;paint();}}
    }
    function stop(){operation++;audio.stop(kind);active=false;pending=false;paint();}
    button.addEventListener('click',()=>{if(active||pending)stop();else start();});
    select.addEventListener('change',()=>{prefs[kind+'Preset']=select.value;save();if(active||pending)start();});
    volume.addEventListener('input',()=>{prefs[kind+'Volume']=Number(volume.value);value.textContent=volume.value+'%';audio.volume(kind,volume.value);});
    volume.addEventListener('change',save);
    document.getElementById('audio-stop').addEventListener('click',stop);
    paint();
  }
  document.getElementById('audio-stop').addEventListener('click',()=>{status.textContent='すべての音を停止しました。';});
  document.getElementById('focus-toggle').addEventListener('click',e=>{
    const active=document.body.classList.toggle('focus-mode');
    e.currentTarget.setAttribute('aria-pressed',String(active));e.currentTarget.textContent=active?'集中モードを終了':'集中モード';
  });
  window.addEventListener('pagehide',()=>audio.stopAll());
})();
