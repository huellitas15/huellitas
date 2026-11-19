const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
  const origin = request.headers.get('Origin');
  if (origin && allowed.length && !allowed.includes(origin)) throw new Error('Origen no autorizado.');
  return {
    ...(origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function authorized(request, env) {
  const expected = env.ADMIN_TOKEN || '';
  const supplied = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index++) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0;
}

function validateCampaign(campaign) {
  if (!campaign || typeof campaign !== 'object' ||
    typeof campaign.id !== 'string' || !campaign.id ||
    typeof campaign.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campaign.slug) ||
    !['vigente', 'completada'].includes(campaign.status) ||
    typeof campaign.title !== 'string' || !campaign.title.trim()) {
    throw new Error('La campaña debe tener identificador, nombre de enlace, título y estado válidos.');
  }
  campaign.showHome = 'si';
}

const DONATION_FIELDS = [
  'bankName', 'accountType', 'accountNumber', 'accountHolder', 'accountId', 'accountIdType',
  'deunaQr', 'deunaUrl', 'paypalUrl', 'tiktokUrl'
];
const DONATION_COUNTRY_FIELDS = {
  EC: DONATION_FIELDS,
  MX: ['bankName', 'clabe', 'accountHolder', 'paypalUrl'],
  US: ['bankName', 'accountType', 'accountNumber', 'routingAch', 'routingWire', 'accountHolder', 'paypalUrl']
};
const DONATION_URL_FIELDS = ['deunaQr', 'deunaUrl', 'paypalUrl', 'tiktokUrl'];

function emptyCountrySettings(country) {
  return Object.fromEntries(DONATION_COUNTRY_FIELDS[country].map(field => [
    field, field === 'accountIdType' ? 'cedula' : ''
  ]));
}

function isCountrySettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  return ['EC', 'MX', 'US'].some(country =>
    Object.prototype.hasOwnProperty.call(settings, country));
}

function validateCountryDonationSettings(country, settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Los datos de donación no son válidos.');
  }
  const clean = emptyCountrySettings(country);
  for (const field of DONATION_COUNTRY_FIELDS[country]) {
    if (field === 'accountIdType' && settings[field] === undefined) settings[field] = 'cedula';
    const value = settings[field] === undefined ? '' : settings[field];
    if (typeof value !== 'string' || value.length > 2048) {
      throw new Error('El campo ' + field + ' no es válido.');
    }
    clean[field] = value.trim();
    if (DONATION_URL_FIELDS.includes(field) && clean[field]) {
      let url;
      try { url = new URL(clean[field]); } catch { throw new Error('El enlace ' + field + ' no es válido.'); }
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('El enlace ' + field + ' debe usar HTTPS y no contener credenciales.');
      }
    }
  }
  if (country === 'EC' && !['cedula', 'ruc'].includes(clean.accountIdType)) {
    throw new Error('Selecciona cédula o RUC.');
  }
  if (country === 'MX' && clean.clabe && !/^\d{18}$/.test(clean.clabe)) {
    throw new Error('La CLABE interbancaria debe tener 18 dígitos.');
  }
  return clean;
}

function validateDonationSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Los datos de donación no son válidos.');
  }
  if (!isCountrySettings(settings)) {
    return {
      EC: validateCountryDonationSettings('EC', settings),
      MX: emptyCountrySettings('MX'),
      US: emptyCountrySettings('US')
    };
  }
  const clean = {};
  for (const country of Object.keys(DONATION_COUNTRY_FIELDS)) {
    clean[country] = validateCountryDonationSettings(country, settings[country] || {});
  }
  return clean;
}

function storedDonationSettings(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Los datos de donación guardados no son válidos.');
  }
  return validateDonationSettings(payload);
}

function selectedDonationCountry(request, url) {
  const requested = url.searchParams.get('country');
  if (['EC', 'MX', 'US'].includes(requested)) return requested;
  const detected = request.cf && request.cf.country;
  return ['EC', 'MX', 'US'].includes(detected) ? detected : '';
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const headers = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!env.DB) return response({ error: 'Falta enlazar la base de datos D1 en wrangler.toml.' }, 503, headers);

  if (path === '/api/donation-settings' && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT payload FROM donation_settings WHERE id = 1').first();
    const settings = result ? storedDonationSettings(JSON.parse(result.payload)) : {
      EC: emptyCountrySettings('EC'), MX: emptyCountrySettings('MX'), US: emptyCountrySettings('US')
    };
    const country = selectedDonationCountry(request, url);
    if (country) return response(settings[country], 200, headers);
    const paypalUrl = settings.US.paypalUrl || settings.MX.paypalUrl || settings.EC.paypalUrl;
    return response(paypalUrl ? { paypalUrl } : {}, 200, headers);
  }

  if (path === '/api/campaigns' && request.method === 'GET') {
    const result = await env.DB.prepare(
      'SELECT payload FROM campaigns ORDER BY CASE status WHEN ? THEN 0 ELSE 1 END, created_at'
    ).bind('vigente').all();
    return response({ campaigns: result.results.map(row => JSON.parse(row.payload)) }, 200, headers);
  }

  const campaignPath = path.match(/^\/api\/campaigns\/([a-z0-9-]+)$/);
  const sharePath = path.match(/^\/api\/campaigns\/([a-z0-9-]+)\/share$/);
  const adminCampaignPath = path.match(/^\/api\/admin\/campaigns\/([^/]+)$/);
  if (sharePath && request.method === 'POST') {
    const result = await env.DB.prepare(
      "UPDATE campaigns SET payload=json_set(payload, '$.shareCount', " +
      "CAST(MAX(0, CAST(COALESCE(json_extract(payload, '$.shareCount'), 0) AS INTEGER)) + 1 AS TEXT)), " +
      "updated_at=? WHERE slug=? AND status='vigente' RETURNING payload"
    ).bind(new Date().toISOString(), sharePath[1]).first();
    return result ? response({ shareCount: JSON.parse(result.payload).shareCount }, 200, headers) :
      response({ error: 'La campaña no existe o ya está completada.' }, 404, headers);
  }
  if (campaignPath && request.method === 'GET') {
    const result = await env.DB.prepare(
      'SELECT payload FROM campaigns WHERE slug = ?'
    ).bind(campaignPath[1]).first();
    return result ? response(JSON.parse(result.payload), 200, headers) :
      response({ error: 'No se encontró esta campaña.' }, 404, headers);
  }

  if (!authorized(request, env)) return response({ error: 'No autorizado. Revisa la clave de administración.' }, 401, headers);

  if (path === '/api/admin/donation-settings' && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT payload FROM donation_settings WHERE id = 1').first();
    return response(result
      ? storedDonationSettings(JSON.parse(result.payload))
      : { EC: emptyCountrySettings('EC'), MX: emptyCountrySettings('MX'), US: emptyCountrySettings('US') },
    200, headers);
  }

  if (path === '/api/admin/donation-settings' && request.method === 'PUT') {
    let settings;
    try {
      const input = await request.json();
      const legacySettings = !isCountrySettings(input);
      settings = validateDonationSettings(input);
      if (legacySettings) {
        const existing = await env.DB.prepare('SELECT payload FROM donation_settings WHERE id = 1').first();
        if (existing) {
          const previous = storedDonationSettings(JSON.parse(existing.payload));
          settings.MX = previous.MX;
          settings.US = previous.US;
        }
      }
    } catch (error) {
      return response({ error: error.message }, 400, headers);
    }
    await env.DB.prepare(
      'INSERT INTO donation_settings (id, payload, updated_at) VALUES (1, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at'
    ).bind(JSON.stringify(settings), new Date().toISOString()).run();
    return response(settings, 200, headers);
  }

  if (path === '/api/admin/campaigns' && request.method === 'GET') {
    const result = await env.DB.prepare('SELECT payload FROM campaigns ORDER BY created_at').all();
    return response({ campaigns: result.results.map(row => JSON.parse(row.payload)) }, 200, headers);
  }

  if (path === '/api/admin/campaigns' && request.method === 'POST') {
    const campaign = await request.json();
    validateCampaign(campaign);
    await env.DB.prepare(
      'INSERT INTO campaigns (id, slug, status, show_home, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, status=excluded.status, show_home=excluded.show_home, payload=excluded.payload, updated_at=excluded.updated_at'
    ).bind(campaign.id, campaign.slug, campaign.status, 'si', JSON.stringify(campaign),
      new Date().toISOString(), new Date().toISOString()).run();
    return response({ campaign }, 201, headers);
  }

  if (adminCampaignPath && request.method === 'PUT') {
    const campaign = await request.json();
    validateCampaign(campaign);
    if (campaign.id !== adminCampaignPath[1]) return response({ error: 'El identificador no coincide con la ruta.' }, 400, headers);
    const delta = campaign.shareCountDelta;
    delete campaign.shareCountDelta;
    if (delta !== undefined && (!Number.isSafeInteger(delta) || Math.abs(delta) > 1000000000)) {
      return response({ error: 'El cambio del contador no es válido.' }, 400, headers);
    }
    const result = delta === undefined
      ? await env.DB.prepare(
        'UPDATE campaigns SET slug=?, status=?, show_home=?, payload=?, updated_at=? WHERE id=? RETURNING payload'
      ).bind(campaign.slug, campaign.status, 'si', JSON.stringify(campaign), new Date().toISOString(), campaign.id).first()
      : await env.DB.prepare(
        "UPDATE campaigns SET slug=?, status=?, show_home=?, payload=json_set(?, '$.shareCount', " +
        "CAST(MAX(0, CAST(COALESCE(json_extract(payload, '$.shareCount'), 0) AS INTEGER) + CAST(? AS INTEGER)) AS TEXT)), " +
        'updated_at=? WHERE id=? RETURNING payload'
      ).bind(campaign.slug, campaign.status, 'si', JSON.stringify(campaign), delta, new Date().toISOString(), campaign.id).first();
    if (!result) return response({ error: 'No se encontró la campaña para actualizar.' }, 404, headers);
    return response({ campaign: JSON.parse(result.payload) }, 200, headers);
  }

  if (adminCampaignPath && request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM campaigns WHERE id=?').bind(adminCampaignPath[1]).run();
    if (!result.meta.changes) return response({ error: 'No se encontró la campaña para eliminar.' }, 404, headers);
    return response({ deleted: adminCampaignPath[1] }, 200, headers);
  }

  return response({ error: 'Ruta no encontrada.' }, 404, headers);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      let headers = {};
      try {
        headers = corsHeaders(request, env);
      } catch (originError) {
        return response({ error: originError.message }, 403);
      }
      return response({ error: error.message || 'Error del servicio de campañas.' }, 500, headers);
    }
  }
};
