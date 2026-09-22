/* Shared extension-page renderer. API responses are always treated as untrusted. */
globalThis.PhotoUI = {
  fallback: chrome.runtime.getURL('assets/landscape.svg'),
  async render(element, credit, photo) {
    const ticket = element._photoTicket = (element._photoTicket || 0) + 1;
    const image = new Image();
    const loaded = await new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 10000);
      image.onload = () => { clearTimeout(timer); resolve(true); };
      image.onerror = () => { clearTimeout(timer); resolve(false); };
      image.src = photo?.url || this.fallback;
    });
    if (ticket !== element._photoTicket) return;
    element.style.backgroundImage = `url("${loaded ? image.src : this.fallback}")`;
    credit.replaceChildren();
    credit.style.display = loaded && photo?.author ? 'block' : 'none';
    if (loaded && photo?.author) {
      const link = (label, url) => {
        const a = document.createElement('a');
        a.textContent = label; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        return a;
      };
      credit.append('Photo by ', link(photo.author, photo.profile), ' on ',
        link('Unsplash', 'https://unsplash.com/?utm_source=ai_screen_time&utm_medium=referral'));
      await chrome.runtime.sendMessage({type:'PHOTO_USED', id:photo.id}).catch(() => {});
    }
  }
};
