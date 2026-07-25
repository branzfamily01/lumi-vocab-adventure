const CACHE='lumi-vocab-v2-1-0';
const FILES=['./','./index.html','./styles.css','./app.js','./word-packs.js','./manifest.webmanifest','./icon.svg','./mascot.svg','./mascot-map.svg','./rival-blue.svg','./rival-pink.svg','./words-grade3.json','./words-pre2.json','./words-grade2.json','./words-pre1.json','./words-grade1.json','./words-all.json','./README.md','./DATA-SOURCES.md'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
        return response;
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }))
  );
});
