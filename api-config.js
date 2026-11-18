window.HUELLAS_API_URL = 'https://huellas-datos.spprtthbaby.workers.dev';

(function() {
  if (window.location.pathname.includes('panel_campanas')) return;

  function cargarMonetag(zone, src) {
    const s = document.createElement('script');
    s.dataset.zone = zone;
    s.src = src;
    (document.body || document.documentElement).appendChild(s);
  }

  // 1. In-Page Push (Ya configurado y listo)
  cargarMonetag('12295161', 'https://nap5k.com/tag.min.js');

  // 2. Vignette Banner (Cuando crees la zona en Monetag, borra las "//" de la línea de abajo y pon su zona y src)
  // cargarMonetag('ID_ZONA_VIGNETTE', 'URL_SRC_VIGNETTE');
})();
