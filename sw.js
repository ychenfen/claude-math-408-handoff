/* Offline copy of the study site. Network first with a short timeout, so updates show when online and
   the last good copy opens on slow or blocked networks. GitHub API/Raw requests are never cached here. */
const CACHE='wengu-v1';
const SHELL=['./','index.html','manifest.webmanifest','assets/style.css','assets/review-tools.css','assets/vendor/katex/katex.min.css',
  'assets/vendor/marked.umd.js','assets/vendor/purify.min.js','assets/vendor/katex/katex.min.js','assets/vendor/katex/contrib/auto-render.min.js',
  'assets/spaced-review.js','assets/review-tools.js','assets/bedtime.js','assets/app.js','assets/data.json','assets/icons/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const network=fetch(req).then(res=>{if(res.ok)cache.put(req,res.clone());return res;});
    const timeout=new Promise(r=>setTimeout(r,4000));
    try{const res=await Promise.race([network,timeout]);if(res)return res;}catch{}
    const hit=await cache.match(req,{ignoreSearch:true})||(req.mode==='navigate'&&await cache.match('index.html'));
    return hit||network;
  })());
});
