self.addEventListener("install",e =>{
// self keyword refers to the global scope of the service worker itself
    //Installation of PWA
        console.log("Instalation done !!"); 
        
        //caching of data
        e.waitUntil(
            caches.open("static").then(cache =>{
                //files to cached when there is slow or no internet
                return cache .addAll(["./", "./style.css","./img/logo-512x512.png",
                "./img/logo-192x192.png","./js/script.js"]);
            })
        );
    });