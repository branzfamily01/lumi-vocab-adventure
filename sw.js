const CACHE='lumi-vocab-v1';
const ASSETS=['./','index.html','styles.css','app.js','data/words.json','data/words.js','manifest.webmanifest','assets/icon.svg','assets/mascot.svg','assets/mascot-map.svg','assets/rival-blue.svg','assets/rival-pink.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match('index.html')))));
