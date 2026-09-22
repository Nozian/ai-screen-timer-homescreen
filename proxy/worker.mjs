// Deploy separately. UNSPLASH_ACCESS_KEY is a server-side secret, never shipped in the extension.
const QUERIES = {nature:'nature landscape',forest:'forest',ocean:'ocean coast',mountains:'mountains',autumn:'autumn landscape'};
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
    if (!origin || !allowed.includes(origin)) return new Response('Forbidden', {status:403});
    const cors = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
    const json = (value,status=200) => Response.json(value,{status,headers:cors});
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
    if (!env.UNSPLASH_ACCESS_KEY) return json({error:'Unsplash is not configured'},503);
    const url = new URL(request.url);
    let upstream;
    if (url.pathname === '/photo' && request.method === 'GET') {
      const category = url.searchParams.get('category') || 'nature';
      if (!Object.hasOwn(QUERIES,category)) return json({error:'Invalid category'},400);
      upstream = new URL('https://api.unsplash.com/photos/random');
      upstream.searchParams.set('query',QUERIES[category]);
      upstream.searchParams.set('orientation','landscape');
      upstream.searchParams.set('content_filter','high');
    } else if (url.pathname === '/download' && request.method === 'POST') {
      const id = url.searchParams.get('id') || '';
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return json({error:'Invalid photo'},400);
      // Resolve the canonical download_location from Unsplash rather than accept a URL from a client.
      try {
        const info = await fetch(`https://api.unsplash.com/photos/${id}`,{headers:{Authorization:`Client-ID ${env.UNSPLASH_ACCESS_KEY}`,'Accept-Version':'v1'},signal:AbortSignal.timeout(8000)});
        if (!info.ok) return json({error:'Photo lookup failed'},info.status);
        const photo = await info.json();
        upstream = new URL(photo.links.download_location);
        if (upstream.origin !== 'https://api.unsplash.com' || upstream.pathname !== `/photos/${id}/download`) return json({error:'Invalid download location'},502);
      } catch (_) { return json({error:'Photo lookup unavailable'},502); }
    } else return json({error:'Not found'},404);
    try {
      const response = await fetch(upstream,{headers:{Authorization:`Client-ID ${env.UNSPLASH_ACCESS_KEY}`,'Accept-Version':'v1'},signal:AbortSignal.timeout(8000)});
      if (!response.ok) return json({error:'Unsplash request failed'},response.status);
      const photo = await response.json();
      if (url.pathname === '/download') return json({ok:true});
      return json({id:photo.id,urls:{regular:photo.urls.regular},user:{name:photo.user.name,links:{html:photo.user.links.html}}});
    } catch (_) { return json({error:'Unsplash unavailable'},502); }
  }
};
