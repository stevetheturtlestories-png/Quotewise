
const CACHE='choicegrade-v6-phase2d';

const ASSETS=[
  './',
  'index.html',
  'app.html',
  'auth.html',
  'account.html',
  'marketing.css?v=6.0',
  'auth.css?v=6.2a',
  'styles.css?v=6.3',
  'app.js?v=6.2a',
  'access.js?v=6.2a',
  'auth.js?v=6.2a',
  'account.js?v=6.2a',
  'config.js',
  'manifest.json?v=6.3',
  'choicegrade-logo.png',
  'choicegrade-mark.png',
  'choicegrade-app-icon.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS))
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys=>
        Promise.all(
          keys
            .filter(key=>key!==CACHE)
            .map(key=>caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .catch(()=>caches.match('app.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request, {cache:'no-store'})
      .then(response=>{
        const copy=response.clone();

        caches.open(CACHE).then(cache=>{
          cache.put(event.request,copy);
        });

        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
