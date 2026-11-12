/* JAMR SHW VALKRON — Service Worker (offline-first)
   Regla de oro: la app SIEMPRE abre desde la caché, al instante, haya señal, no haya señal
   o la señal esté «colgada» (la red conecta pero no responde, típico en campo).
   La red solo sirve para refrescar la caché en segundo plano, con límite de tiempo. */
const CACHE_NAME = 'valkron-shell-v21';
const REQUIRED = ['./index.html', './manifest.webmanifest'];             // sin estos la instalación falla y se conserva la versión anterior
const OPTIONAL = ['./vendor/chart.umd.js',
                  './icon-192.png', './icon-512.png', './icon-192-maskable.png', './icon-512-maskable.png', './apple-touch-icon.png',
                  './fonts/space-grotesk-latin-500-normal.woff2', './fonts/space-grotesk-latin-600-normal.woff2', './fonts/space-grotesk-latin-700-normal.woff2',
                  './fonts/ibm-plex-mono-latin-400-normal.woff2', './fonts/ibm-plex-mono-latin-500-normal.woff2', './fonts/ibm-plex-mono-latin-600-normal.woff2'];
const SHELL_FILES = REQUIRED.concat(OPTIONAL);
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function conTimeout(req, ms, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(req, Object.assign({ signal: ctl.signal }, init || {})).finally(() => clearTimeout(t));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // cache:'reload' evita guardar una copia vieja de la caché HTTP del navegador.
    const guardar = async (f) => {
      const res = await conTimeout(new Request(f, { cache: 'reload' }), 20000);
      if (!res.ok) throw new Error(f + ' → ' + res.status);
      await cache.put(f, res);
    };
    await Promise.all(REQUIRED.map(guardar));                              // falla → no se instala (la versión previa sigue sirviendo)
    await Promise.allSettled(OPTIONAL.map(guardar));                       // un 404 puntual no tumba la instalación
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Solo se borran las cachés viejas si la nueva ya tiene la app. Nunca se deja al usuario sin shell.
    const nueva = await caches.open(CACHE_NAME);
    // Solo se retiran las cachés viejas si la nueva trae la app Y el gráfico (instalación completa); si no, la vieja sigue de respaldo.
    if ((await nueva.match('./index.html')) && (await nueva.match('./vendor/chart.umd.js'))) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME && k.startsWith('valkron-')).map((k) => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

function refrescar(event, key, req) {
  // Actualiza la caché en segundo plano; si no hay red o tarda, se ignora sin consecuencias.
  event.waitUntil((async () => {
    try {
      const res = await conTimeout(req, 10000, { cache: 'reload' });
      const tipo = res ? (res.headers.get('content-type') || '') : ''; const esHtml = String(key.url || key).indexOf('index.html') !== -1; if (res && res.ok && (!esHtml || /text\/html/.test(tipo)) && (!esHtml || true)) { const c = await caches.open(CACHE_NAME); await c.put(key, res.clone()); }
    } catch (e) { /* sin red: se queda la copia guardada */ }
  })());
}

const RESPUESTA_SIN_SHELL = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<body style="background:#141210;color:#e8e4db;font-family:system-ui;padding:24px"><h2>Valkron</h2>' +
  '<p>Aún no hay una copia local de la app y no hay conexión. Ábrela una vez con señal para guardarla.</p>' +
  '<p><a style="color:#c96a54" href="">Reintentar</a></p>',
  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                                        // los POST al Apps Script pasan directos
  const url = new URL(req.url);

  // 1) Abrir la app (cualquier navegación): caché primero. Nunca esperar a la red.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = await caches.match('./index.html', { ignoreSearch: true });
      if (cached) { refrescar(event, './index.html', new Request('./index.html')); return cached; }
      try {
        const r = await conTimeout(req, 4000);
        // Autorreparación: si la caché perdió la app, se vuelve a guardar (solo si es realmente la app).
        if (r.ok && /text\/html/.test(r.headers.get('content-type') || '')) {
          const copia = r.clone();   // el clon se hace ya: después el cuerpo estará en uso
          event.waitUntil((async () => { try { const c = await caches.open(CACHE_NAME); await c.put('./index.html', copia);
            await Promise.allSettled(SHELL_FILES.filter((f) => f !== './index.html').map(async (f) => { if (!(await c.match(f))) { const x = await conTimeout(new Request(f, { cache: 'reload' }), 20000); if (x.ok) await c.put(f, x); } })); } catch (e) {} })());
        }
        return r;
      } catch (e) { return RESPUESTA_SIN_SHELL(); }
    })());
    return;
  }

  // 2) Fuentes de Google: caché primero; si no están, se piden con límite de 3 s y se guardan.
  if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await conTimeout(req, 3000);
        const c = await caches.open(CACHE_NAME); c.put(req, res.clone());
        return res;
      } catch (e) { return new Response('', { status: 504 }); }            // la app usa la tipografía del sistema
    })());
    return;
  }

  // 2b) Dictado local (v17): motor, worker y wasm en /voz/. Cache primero desde la caché «voz-local-v1» (su nombre NO empieza por
  //     «valkron-» para que las limpiezas de versión no la borren). Si aún no está guardada, red normal.
  if (url.origin === self.location.origin && url.pathname.indexOf('/voz/') !== -1) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(req);
    })());
    return;
  }

  // 3) Archivos del shell (librerías locales, iconos, manifiesto): caché primero + refresco silencioso.
  if (url.origin === self.location.origin) {
    const propio = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')));
    if (!propio) return;
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) { refrescar(event, req, req); return cached; }
      try {
        const res = await conTimeout(req, 6000);
        if (res.ok) { const c = await caches.open(CACHE_NAME); c.put(req, res.clone()); }
        return res;
      } catch (e) { return new Response('', { status: 504 }); }
    })());
  }
  // Todo lo demás (Apps Script, etc.) no se intercepta.
});

// Un aviso del sistema (recordatorio) abre o enfoca la app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of lista) { if ('focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow('./index.html');
  })());
});
