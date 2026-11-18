window.HUELLAS_API_URL = 'https://huellas-datos.spprtthbaby.workers.dev';
window.MONETAG_SMARTLINK = 'https://uplcm.com/4/12295056';

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

  // 3. Ejecutar SmartLink en paralelo al presionar botones de acción (sin bloquear su función original)
  let ultimaApertura = 0;
  document.addEventListener('click', function(e) {
    const boton = e.target.closest('button, a');
    if (!boton) return;

    // Ignorar botones de compartir para no interferir con la ventana nativa de compartir
    if (boton.outerHTML.toLowerCase().includes('compartir')) return;

    const texto = (boton.innerText || '').toLowerCase();
    const href = (boton.getAttribute('href') || '').toLowerCase();

    // Detecta botones de donar, copiar cuenta, abrir modal o bajar a sección (#)
    const esBotonAccion =
      boton.tagName === 'BUTTON' ||
      href.startsWith('#') ||
      texto.includes('donar') ||
      texto.includes('ayudar') ||
      texto.includes('copiar') ||
      texto.includes('cuenta') ||
      texto.includes('apoyar');

    if (!esBotonAccion) return;

    const ahora = Date.now();
    // Pausa de 20 segundos entre aperturas para evitar bloqueos por spam de pestañas
    if (ahora - ultimaApertura < 20000) return;

    ultimaApertura = ahora;
    window.open(window.MONETAG_SMARTLINK, '_blank', 'noopener,noreferrer');
  }, true);
})();
