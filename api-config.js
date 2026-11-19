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

  // 3. SmartLink en los controles seleccionados
  const claveApertura = 'huellitas-smartlink-ultima-apertura';
  const intervalo = 20000;
  let ultimaApertura = 0;

  function abrirSmartlink() {
    const ahora = Date.now();
    try {
      ultimaApertura = Math.max(ultimaApertura, Number(sessionStorage.getItem(claveApertura)) || 0);
    } catch (error) {
      console.warn('No se pudo consultar el intervalo de SmartLink:', error);
    }
    if (ahora - ultimaApertura < intervalo) return;
    ultimaApertura = ahora;
    try {
      sessionStorage.setItem(claveApertura, String(ahora));
    } catch (error) {
      console.warn('No se pudo guardar el intervalo de SmartLink:', error);
    }
    try {
      window.open(window.MONETAG_SMARTLINK, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('No se pudo abrir SmartLink:', error);
    }
  }

  document.addEventListener('click', function(evento) {
    const destino = evento.target;
    if (!(destino instanceof Element)) return;
    const boton = destino.closest('button, a');
    if (!boton) return;

    const texto = boton.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
    const esDonar = /\/donar\/(?:index\.html)?$/.test(window.location.pathname);
    const esCompartir = boton.matches('#share-donation') ||
      (boton.matches('.btn-share-large, .share-button') && texto === 'compartir campaña');
    const esNavegacion = boton.matches('nav a') &&
      ['campañas', 'donar', 'cómo ayudar', 'volver arriba'].includes(texto);
    const esAccion = esNavegacion ||
      boton.matches('.closing-box a[href="./donar/"], a.back-home') ||
      (esDonar && boton.matches('.angel-amount, .accordion-header')) ||
      boton.matches('.btn-nav-donate, .btn-donate-large, .mobile-float-btn');
    const esVolverCasoCompletado = boton.matches('a.back') &&
      document.querySelector('.side .status')?.textContent.includes('Caso completado');

    if (!esCompartir && !esAccion && !esVolverCasoCompletado) return;
    if (esCompartir) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
    }
    abrirSmartlink();
  }, true);
})();