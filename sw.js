// =====================================================================
// BATE-CONTROLE ELITE — SERVICE WORKER
// Guarda a "casca" do app (HTML, CSS, JS, ícones e bibliotecas) para ele
// abrir rápido e funcionar mesmo sem internet. Os dados (Supabase) e o
// WhatsApp/Telegram nunca são guardados: sempre vão direto para a rede.
//
// Ao publicar uma versão nova, aumente o número em VERSAO.
// =====================================================================
const VERSAO = 'bc-v2';

const CASCA = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/base.css',
  './assets/css/layout.css',
  './assets/css/components.css',
  './assets/css/admin.css',
  './assets/img/logo.png',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/favicon-32.png',
  './js/config.js',
  './js/app.js',
  './js/admin.js',
  './js/pagamentos.js'
];

// bibliotecas externas que podem ficar guardadas
const CDNS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache do navegador e baixa a versão publicada
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const local = url.origin === self.location.origin;
  if (!local && !CDNS.includes(url.hostname)) return; // Supabase, Telegram etc.: só rede

  // arquivos do próprio app: rede primeiro (sempre a versão publicada);
  // sem internet, usa o que está guardado
  if (local) {
    const navegacao = req.mode === 'navigate';
    const chave = navegacao ? './index.html' : req;
    // (uma requisição de navegação não pode ser copiada com opções, por isso usa a URL)
    e.respondWith(
      fetch(navegacao ? req.url : req, { cache: 'no-cache', credentials: 'same-origin' })
        .then((resp) => {
          if (resp && resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(chave, copia)); }
          return resp;
        })
        .catch(() => caches.match(chave, { ignoreSearch: true }))
    );
    return;
  }

  // bibliotecas externas: responde com a guardada e atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((guardado) => {
      const daRede = fetch(req)
        .then((resp) => {
          if (resp && (resp.ok || resp.type === 'opaque')) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => guardado);
      return guardado || daRede;
    })
  );
});
