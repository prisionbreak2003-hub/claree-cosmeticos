// Envio de pedidos pra Utmify (rastreamento de vendas/atribuição de anúncio).
// Doc: https://docs.utmify.com.br/envio-de-vendas
// Nunca deixa a Utmify derrubar o fluxo principal (PIX/webhook) — só loga o erro.
const UTMIFY_URL = 'https://api.utmify.com.br/api-credentials/orders';

function utcStamp(d) {
  d = d || new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function enviarPedidoUtmify(payload) {
  const token = process.env.UTMIFY_API_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(UTMIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[utmify] resposta não-ok', res.status, txt);
    }
  } catch (err) {
    console.error('[utmify] falha ao enviar pedido', err.message);
  }
}

module.exports = { enviarPedidoUtmify, utcStamp };
