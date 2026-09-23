/* Original short messages; shared by the home and break pages. */
globalThis.PhraseModel = (() => {
  const defaults = [
    'ちょっと、遠くを見よう。', '今は、ひとつのことから。', '急がなくても、少しずつ。',
    'ひと息ついたら、また始めよう。', '肩の力を抜いて、深呼吸。', '小さな一歩も、ちゃんと前進。',
    '窓の向こうにも、今日がある。', 'ここまでできた自分に、ひと休み。', '静かな時間を、自分に。', '今日のペースで、進もう。'
  ];
  function normalize(value = {}) {
    if(!value || typeof value!=="object") value={};
    const custom = Array.isArray(value.custom) ? [...new Set(value.custom.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,160)).filter(Boolean))].slice(0,100) : [];
    const all = [...new Set([...defaults,...custom])];
    const favorites = Array.isArray(value.favorites) ? [...new Set(value.favorites.filter(x=>all.includes(x)))] : [];
    return {mode:['random','fixed','favorites'].includes(value.mode)?value.mode:'random',custom,favorites,fixed:all.includes(value.fixed)?value.fixed:defaults[0]};
  }
  function choose(value, previous='', random=Math.random) {
    const s=normalize(value);
    if(s.mode==='fixed') return s.fixed;
    let pool=s.mode==='favorites' && s.favorites.length ? s.favorites : [...new Set([...defaults,...s.custom])];
    if(pool.length>1) pool=pool.filter(x=>x!==previous);
    return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  }
  return {defaults,normalize,choose};
})();
globalThis.PhraseUI = {
  async mount(container, target) {
    container.classList.add('phrase-widget');
    let settings = PhraseModel.normalize((await chrome.storage.local.get('__phrases__')).__phrases__);
    let current = PhraseModel.choose(settings);
    const text = target || document.createElement('p');
    if(!target) { text.className='phrase-text'; container.append(text); }
    const controls = document.createElement('div'); controls.className='phrase-controls';
    const favorite=document.createElement('button'), next=document.createElement('button'), pin=document.createElement('button');
    favorite.type=next.type=pin.type='button'; next.textContent='次の言葉'; pin.textContent='この言葉に固定';
    controls.append(favorite,next,pin); container.append(controls);
    const details=document.createElement('details');
    details.innerHTML='<summary>言葉の設定</summary><div class="phrase-settings"><label>表示方法<select class="phrase-mode"><option value="random">ランダム</option><option value="fixed">固定</option><option value="favorites">お気に入りからランダム</option></select></label><label>固定する言葉<select class="phrase-fixed"></select></label><label>自分の言葉を追加<input class="phrase-custom" maxlength="160" placeholder="好きなひと言（160文字以内）"></label><button type="button" class="phrase-add">追加して表示</button><p class="phrase-hint" role="status"></p></div>';
    container.append(details);
    const mode=details.querySelector('.phrase-mode'), fixed=details.querySelector('.phrase-fixed'), custom=details.querySelector('.phrase-custom'), hint=details.querySelector('.phrase-hint');
    function render() {
      text.textContent=current;
      const liked=settings.favorites.includes(current);
      favorite.textContent=liked?'★ お気に入り済み':'☆ お気に入り'; favorite.setAttribute('aria-pressed',String(liked));
      next.disabled=settings.mode==='fixed'; pin.disabled=settings.mode==='fixed'&&settings.fixed===current;
      mode.value=settings.mode;
      fixed.replaceChildren();
      for(const phrase of [...new Set([...PhraseModel.defaults,...settings.custom])]) {
        const option=document.createElement('option');option.value=phrase;option.textContent=(settings.favorites.includes(phrase)?'★ ':'')+phrase;fixed.append(option);
      }
      fixed.value=settings.fixed;
      hint.textContent=settings.mode==='favorites'&&!settings.favorites.length?'お気に入りがまだないため、すべての言葉から表示します。':`お気に入り ${settings.favorites.length} 件 · ランダムは画面を開いたときに切り替わります。`;
    }
    async function save(patch) {
      const latest=(await chrome.storage.local.get('__phrases__')).__phrases__;
      settings=PhraseModel.normalize({...PhraseModel.normalize(latest),...patch});
      await chrome.storage.local.set({__phrases__:settings});render();
    }
    favorite.addEventListener('click',async()=>{
      const fresh=PhraseModel.normalize((await chrome.storage.local.get('__phrases__')).__phrases__);
      await save({favorites:fresh.favorites.includes(current)?fresh.favorites.filter(x=>x!==current):[...fresh.favorites,current]});
    });
    next.addEventListener('click',()=>{current=PhraseModel.choose(settings,current);render();});
    pin.addEventListener('click',()=>save({mode:'fixed',fixed:current}));
    mode.addEventListener('change',async()=>{await save({mode:mode.value});current=PhraseModel.choose(settings,current);render();});
    fixed.addEventListener('change',async()=>{current=fixed.value;await save({fixed:current,mode:'fixed'});});
    details.querySelector('.phrase-add').addEventListener('click',async()=>{
      const value=custom.value.trim();if(!value) return;
      const fresh=PhraseModel.normalize((await chrome.storage.local.get('__phrases__')).__phrases__);
      if(fresh.custom.length>=100&&!fresh.custom.includes(value)) {hint.textContent='追加できる言葉は100件までです。';return;}
      current=value;await save({custom:[...fresh.custom,value],mode:'fixed',fixed:value});custom.value='';
    });
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='local'||!changes.__phrases__) return;
      settings=PhraseModel.normalize(changes.__phrases__.newValue);
      if(settings.mode==='fixed') current=settings.fixed;
      else if(settings.mode==='favorites'&&settings.favorites.length&&!settings.favorites.includes(current)) current=PhraseModel.choose(settings,current);
      render();
    });
    render();
  }
};
