'use strict';

function compartirCampanaPublica(slug, actualizarContador, informar) {
  const api = window.HUELLAS_API_URL || '';
  if (!api || api.includes('TU-WORKER')) {
    informar('No se pudo registrar el clic: la conexión no está configurada.', true);
  } else {
    fetch(api.replace(/\/+$/, '') + '/api/campaigns/' + encodeURIComponent(slug) + '/share', {
      method: 'POST'
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error HTTP ' + response.status);
      if (!/^\d+$/.test(String(data.shareCount))) throw new Error('El contador recibido no es válido.');
      actualizarContador(Number(data.shareCount));
    }).catch(error => informar('No se pudo registrar el clic: ' + error.message, true));
  }

  if (navigator.share) {
    navigator.share({
      title: document.title,
      text: document.querySelector('meta[name="description"]').content,
      url: window.location.href
    }).catch(error => {
      if (error.name !== 'AbortError') informar('No se pudo compartir: ' + error.message, true);
    });
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(window.location.href)
      .then(() => informar('Enlace copiado para compartir.'))
      .catch(() => informar('No se pudo copiar el enlace. Cópialo desde la barra de direcciones.', true));
  } else {
    informar('Copia el enlace desde la barra de direcciones para compartirlo.', true);
  }
}
