self.addEventListener("install",e =>{
// self keyword refers to the global scope of the service worker itself
    //Installation of PWA
        console.log("Instalation started !!"); 
        
        //caching of the  data
        e.waitUntil(
            caches.open("static").then(cache =>{
                //files to cached when there is slow or no internet
                return cache.addAll(["./", "./css/style.css","./img/logo-512x512.png",
                "./img/logo-192x192.png","./js/script.js"]);
            })
        );
        console.log("Installation done");
    });
    
    self.addEventListener("fetch",e =>{
        e.respondWith(
             caches.match(e.request)
             .then(response =>{
                   return response  || fetch(e.request); // to check if data is availble in cache than respond from cache db storage otherwise go to fetch (make a network call to get the data) "Cache-First" strategy
              })
        )
    }); 