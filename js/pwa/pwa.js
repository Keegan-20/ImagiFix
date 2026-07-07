/**
 * Progressive Web App glue: register the service worker and manage the custom
 * install prompt (captured from `beforeinstallprompt`, surfaced on our terms).
 */
export function initPWA(dom) {
  // im Registering the worker after load so it never competes with first paint.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .catch((err) => console.error('[pwa] SW registration failed:', err));
    });
  }

  let deferredPrompt = null;
  const hide = () => dom.installPopup.classList.remove('is-visible');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Give the user a moment with the app before inviting them to install.
    setTimeout(() => dom.installPopup.classList.add('is-visible'), 3000);
  });

  dom.installButton.addEventListener('click', async () => {
    hide();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });

  dom.dismissButton.addEventListener('click', hide);
  window.addEventListener('appinstalled', hide);
}
