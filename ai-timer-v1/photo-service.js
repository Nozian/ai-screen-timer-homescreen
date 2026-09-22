// Runs only in the service worker. No API keys or arbitrary fetch URLs from content scripts.
const PHOTO_QUERIES = {nature:'nature landscape', forest:'forest', ocean:'ocean coast', mountains:'mountains', autumn:'autumn landscape'};
let photoRequest = null;
async function getPhoto(force = false) {
  if (photoRequest) return photoRequest;
  photoRequest = loadUnsplashPhoto(force).finally(() => { photoRequest = null; });
  return photoRequest;
}
async function loadUnsplashPhoto(force) {
  const r = await chrome.storage.local.get(['__prefs__','__unsplash_photo__','__photo_retry__']);
  const p = r.__prefs__ || {};
  const category = Object.hasOwn(PHOTO_QUERIES, p.photoCategory) ? p.photoCategory : 'nature';
  const endpoint = p.photoEndpoint || '';
  const cached = r.__unsplash_photo__;
  const old = cached?.endpoint === endpoint && cached?.category === category ? cached : null;
  if (!endpoint) return {photo:null, status:'Unsplash接続先を設定すると写真を表示できます。'};
  const age = Date.now() - (old?.cachedAt || 0);
  // New-tab requests share a five-minute minimum interval to protect demo quotas.
  const ttl = p.photoTiming === 'manual' ? Infinity : p.photoTiming === 'newtab' ? 300000 : 3600000;
  if (old && ((!force && age < ttl) || age < 10000)) return {photo:old, status:'Unsplash'};
  if (r.__photo_retry__ > Date.now()) return {photo:old, status:'接続を一時停止しています。しばらくしてから再試行してください。'};
  try {
    const base = new URL(endpoint);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw Error('endpoint');
    const url = new URL('photo', base.href.replace(/\/?$/, '/'));
    const response = await fetch(`${url}?category=${category}`, {signal:AbortSignal.timeout(10000), credentials:'omit'});
    if (!response.ok) throw Error(String(response.status));
    const raw = await response.json();
    const image = new URL(raw.urls?.regular);
    const profile = new URL(raw.user?.links?.html);
    if (image.origin !== 'https://images.unsplash.com' || profile.origin !== 'https://unsplash.com' ||
        !/^[a-zA-Z0-9_-]+$/.test(raw.id) || typeof raw.user?.name !== 'string') throw Error('photo');
    profile.searchParams.set('utm_source','ai_screen_time');
    profile.searchParams.set('utm_medium','referral');
    const photo = {id:raw.id, url:image.href, author:raw.user.name, profile:profile.href,
      endpoint, category, cachedAt:Date.now(), tracked:false};
    const latest = (await chrome.storage.local.get('__prefs__')).__prefs__ || {};
    if ((latest.photoEndpoint || '') !== endpoint || (latest.photoCategory || 'nature') !== category) return loadUnsplashPhoto(force);
    await chrome.storage.local.set({__unsplash_photo__:photo, __photo_retry__:0});
    return {photo, status:'Unsplash'};
  } catch (_) {
    await chrome.storage.local.set({__photo_retry__:Date.now()+60000});
    return {photo:old, status:'写真を取得できませんでした。保存済みの写真または代替背景を表示しています。'};
  }
}
let trackingPhoto = false;
async function trackPhoto(id) {
  if (trackingPhoto) return;
  trackingPhoto = true;
  try {
    const r = await chrome.storage.local.get('__unsplash_photo__');
    const photo = r.__unsplash_photo__;
    if (!photo || photo.id !== id || photo.tracked) return;
    const url = new URL('download', photo.endpoint.replace(/\/?$/, '/'));
    url.searchParams.set('id', id);
    const response = await fetch(url, {method:'POST', signal:AbortSignal.timeout(10000), credentials:'omit'});
    if (!response.ok) return;
    const latest = await chrome.storage.local.get('__unsplash_photo__');
    if (latest.__unsplash_photo__?.cachedAt === photo.cachedAt) {
      await chrome.storage.local.set({__unsplash_photo__:{...photo, tracked:true}});
    }
  } catch (_) { /* Retry on the next successful display. */ }
  finally { trackingPhoto = false; }
}
