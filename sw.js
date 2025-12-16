
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan intercept file statis, hot update, atau chrome extension
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|json|map|tsx|ts)$/) ||
    url.pathname.startsWith('/node_modules/') ||
    url.hostname !== self.location.hostname
  ) {
    return;
  }

  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  // Dapatkan semua window client yang aktif
  const clients = await self.clients.matchAll({ type: 'window' });
  const client = clients[0]; // Gunakan tab aktif pertama

  if (!client) {
    return fetch(event.request);
  }

  const requestBody = await event.request.text();
  
  // Extract headers to plain object
  const requestHeaders = {};
  for (const [key, value] of event.request.headers.entries()) {
    requestHeaders[key] = value;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();

    // Dengarkan balasan dari React App
    channel.port1.onmessage = (msg) => {
      const { response } = msg.data;
      
      // Simulasi network delay di sini (opsional, atau bisa dihandle React sebelum reply)
      // Namun untuk akurasi Network Tab, delay lebih baik di 'tunggu' sebelum resolve.
      setTimeout(() => {
        const headers = new Headers(response.headers);
        resolve(new Response(response.body, {
          status: response.status,
          headers: headers
        }));
      }, response.delay || 0);
    };

    // Kirim request ke React App untuk diproses ("Server-side logic" di Client)
    client.postMessage({
      type: 'INTERCEPT_REQUEST',
      payload: {
        url: event.request.url,
        method: event.request.method,
        headers: requestHeaders, // NEW: Pass headers to app
        body: requestBody
      }
    }, [channel.port2]);
  });
}
