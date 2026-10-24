var CACHE = "steel-grade-gacha-redesign-t23-v4";
var PREFIX = "steel-grade-gacha-";
var ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png",
  "./icon-512.png", "./apple-touch-icon.png", "./src/uiimg/workshop.webp"];
var COMICS = ["webtoon/ep01.webp","webtoon/ep02-1.webp","webtoon/ep02-2.webp","webtoon/ep02-3.webp","webtoon/ep02-4.webp","webtoon/ep02-5.webp","webtoon/ep02-6.webp","webtoon/ep02-7.webp","webtoon/ep02-8.webp","webtoon/s00-1.webp","webtoon/s00-dogeum.webp","webtoon/s00-eg.webp","webtoon/s00-po.webp","webtoon/s00-ssial.webp","webtoon/s00-tarae.webp","webtoon/th-ep01.webp","webtoon/th-ep02.webp","webtoon/th-s00.webp"];
var COMIC_URLS = COMICS.map(function(p){return new URL(p,self.registration.scope).href;});
function appCache(key){return key.indexOf(PREFIX) === 0;}
function comicRequest(req){
  var url = new URL(req.url);
  return url.origin === self.location.origin && COMIC_URLS.indexOf(url.href) >= 0;
}
function cacheable(response){return response && response.ok && response.type !== "opaque";}
function comicResponse(response){return cacheable(response) && (response.headers.get("content-type") || "").indexOf("image/") === 0;}

self.addEventListener("install",function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(cache){return cache.addAll(ASSETS);}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return caches.open(CACHE).then(function(target){
      return Promise.all(keys.filter(function(key){return key !== CACHE && appCache(key);}).map(function(key){
        return caches.open(key).then(function(old){
          return old.keys().then(function(requests){
            return Promise.all(requests.filter(comicRequest).map(function(request){
              return old.match(request).then(function(response){
                if(comicResponse(response))
                  return target.put(request,response);
              });
            }));
          });
        }).then(function(){return caches.delete(key);}).catch(function(){
          /* A failed migration retains this old app cache for offline fallback. */
        });
      }));
    });
  }).then(function(){return self.clients.claim();}));
});
function isNav(req){
  return req.mode === "navigate" ||
    (req.method === "GET" && (req.headers.get("accept") || "").indexOf("text/html") >= 0);
}
function oldComic(request){
  if(!comicRequest(request)) return Promise.resolve();
  return caches.keys().then(function(keys){
    return keys.filter(function(key){return key !== CACHE && appCache(key);}).reduce(function(result,key){
      return result.then(function(hit){return hit || caches.open(key).then(function(cache){return cache.match(request);}).then(function(response){return comicResponse(response) ? response : undefined;});});
    },Promise.resolve());
  });
}
self.addEventListener("fetch",function(e){
  var request = e.request;
  if(request.method !== "GET") return;
  if(isNav(request)){
    e.respondWith(fetch(request).then(function(response){
      if(cacheable(response)){
        var copy = response.clone();
        e.waitUntil(caches.open(CACHE).then(function(cache){
          return cache.put("./index.html",copy);
        }).catch(function(){}));
      }
      return response;
    }).catch(function(){
      return caches.open(CACHE).then(function(cache){
        return cache.match("./index.html").then(function(hit){return hit || cache.match("./");});
      }).then(function(hit){return hit || Response.error();});
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(function(cache){
    return cache.match(request).then(function(hit){return (comicRequest(request) && !comicResponse(hit) ? undefined : hit) || oldComic(request);}).then(function(hit){
      if(hit) return hit;
      return fetch(request).then(function(response){
        if(comicRequest(request) && !comicResponse(response)) return Response.error();
        if(cacheable(response) && new URL(request.url).origin === self.location.origin)
          e.waitUntil(cache.put(request,response.clone()).catch(function(){}));
        return response;
      }).catch(function(){return Response.error();});
    });
  }));
});
self.addEventListener("notificationclick",function(e){
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(list){
    for(var i=0;i<list.length;i++) if("focus" in list[i]) return list[i].focus();
    if(self.clients.openWindow) return self.clients.openWindow("./");
  }));
});
