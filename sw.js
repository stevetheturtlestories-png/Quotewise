const CACHE='choicegrade-v6-phase2c';

const ASSETS=[
  './',
  'index.html',
  'app.html',
  'auth.html',
  'account.html',
  'marketing.css?v=6.0',
  'auth.css?v=6.2a',
  'styles.css?v=6.2b',
  'app.js?v=6.2a',
  'access.js?v=6.2a',
  'auth.js?v=6.2a',
  'account.js?v=6.2a',
  'config.js',
  'manifest.json',
  'choicegrade-logo.png',
  'choicegrade-mark.png',
  'choicegrade-app-icon.png'
];

self.addEventListener('install',e=>{
  self.skipWaiting();

  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS))
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys=>
        Promise.all(
          keys
            .filter(k=>k!==CACHE)
            .map(k=>caches.delete(k))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request).catch(()=>caches.match('./app.html'))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});
