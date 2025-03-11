import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', event => {
  event.respondWith(handleEvent(event));
});

async function handleEvent(event) {
  try {
    const options = {
      mapRequestToAsset: req => {
        // Mapeia requisições que não são para arquivos estáticos para /index.html
        let url = new URL(req.url);
        if (!url.pathname.match(/\.\w+$/)) {
          url.pathname = `/index.html`;
        }
        return new Request(url.toString(), req);
      }
    };
    return await getAssetFromKV(event, options);
  } catch (error) {
    return new Response('Erro ao carregar o ativo: ' + error.message, { status: 404 });
  }
}
