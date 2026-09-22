// An extension iframe avoids host-page style and image CSP conflicts.
(() => {
  let frame = null, busy = false, previousFocus = null;
  const eligible = () => {
    const h = location.hostname;
    return ['chatgpt.com','claude.ai','gemini.google.com','perplexity.ai','grok.com'].some(d=>h===d||h.endsWith('.'+d)) ||
      (h==='x.com' && location.pathname.startsWith('/i/grok')) ||
      ((h==='www.google.com'||h==='google.com') && new URLSearchParams(location.search).get('udm')==='50');
  };
  async function update() {
    if (busy) return;
    busy = true;
    try {
      const state = eligible() ? await chrome.runtime.sendMessage({type:'GET_BREAK_STATUS'}) : null;
      if (state?.blocked && !frame) {
        previousFocus = document.activeElement;
        frame = document.createElement('iframe');
        frame.title = 'AI Screen Time — 休憩';
        frame.src = chrome.runtime.getURL('break.html');
        frame.style.cssText = 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important;z-index:2147483647!important;display:block!important;';
        document.documentElement.append(frame);
        frame.focus();
      } else if (!state?.blocked && frame) {
        frame.remove(); frame = null;
        previousFocus?.focus?.();
      }
    } catch (_) { /* Extension reload: leave the underlying page usable. */
      frame?.remove(); frame = null;
    } finally { busy = false; }
  }
  chrome.storage.onChanged.addListener(update);
  document.addEventListener('visibilitychange', update);
  setInterval(update, 5000);
  update();
})();
