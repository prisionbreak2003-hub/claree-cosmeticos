const { sql, ensureSchema } = require('../../lib/db');
const { enviarPedidoUtmify, utcStamp } = require('../../lib/utmify');
const { sendEmail } = require('../../lib/resend');

// Korvex -> status que a gente grava no nosso banco -> status que a Utmify espera
const EVENT_MAP = {
  TRANSACTION_PAID: { dbStatus: 'paid', utmifyStatus: 'paid', dateField: 'paid_at' },
  TRANSACTION_REFUNDED: { dbStatus: 'refunded', utmifyStatus: 'refunded', dateField: 'refunded_at' },
  TRANSACTION_CHARGED_BACK: { dbStatus: 'chargedback', utmifyStatus: 'chargedback', dateField: null },
  TRANSACTION_CANCELED: { dbStatus: 'refused', utmifyStatus: 'refused', dateField: null },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'invalid_json' }); return; }
  }
  body = body || {};

  const { event, token, transaction } = body;

  // A Korvex gera um token DIFERENTE por callbackUrl — e como o site responde
  // em mais de um domínio (claree-cosmeticos.vercel.app e clareee-vercel.vercel.app),
  // aceita qualquer token da lista (separados por vírgula em KORVEX_WEBHOOK_TOKENS).
  const expectedTokens = (process.env.KORVEX_WEBHOOK_TOKENS || process.env.KORVEX_WEBHOOK_TOKEN || '')
    .split(',').map((t) => t.trim()).filter(Boolean);
  const match = expectedTokens.length > 0 && expectedTokens.includes(token);

  console.log('[korvex-webhook] recebido', { event, transactionId: transaction?.id, match });

  if (!match) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  const map = EVENT_MAP[event];
  if (map && transaction?.id) {
    try {
      await ensureSchema();
      // "AND status != alvo" torna a atualização idempotente — a Korvex reenvia o
      // mesmo evento várias vezes (retry), e sem essa trava cada reenvio geraria
      // um novo relatório pra Utmify e um novo e-mail duplicado pro cliente.
      const rows = map.dateField === 'paid_at'
        ? await sql`UPDATE orders SET status = ${map.dbStatus}, paid_at = now() WHERE transaction_id = ${transaction.id} AND status != ${map.dbStatus} RETURNING *`
        : map.dateField === 'refunded_at'
        ? await sql`UPDATE orders SET status = ${map.dbStatus}, refunded_at = now() WHERE transaction_id = ${transaction.id} AND status != ${map.dbStatus} RETURNING *`
        : await sql`UPDATE orders SET status = ${map.dbStatus} WHERE transaction_id = ${transaction.id} AND status != ${map.dbStatus} RETURNING *`;
      const order = rows[0];
      if (order) {
        await enviarPedidoUtmify({
          orderId: order.identifier,
          platform: 'Korvex',
          paymentMethod: 'pix',
          status: map.utmifyStatus,
          createdAt: utcStamp(new Date(order.created_at)),
          approvedDate: map.utmifyStatus === 'paid' ? utcStamp() : null,
          refundedAt: map.utmifyStatus === 'refunded' ? utcStamp() : null,
          customer: {
            name: order.customer_name,
            email: order.customer_email,
            phone: (order.customer_whatsapp || '').replace(/\D/g, ''),
            document: order.customer_document,
            country: 'BR',
            ip: order.customer_ip,
          },
          products: [{ id: 'kit-' + order.kit_index, name: order.kit_name, planId: null, planName: null, quantity: 1, priceInCents: order.total_cents }],
          trackingParameters: order.track_props
            ? {
                src: order.track_props.src || null,
                sck: order.track_props.sck || null,
                utm_source: order.track_props.source || null,
                utm_campaign: order.track_props.campaign || null,
                utm_medium: order.track_props.medium || null,
                utm_content: order.track_props.content || null,
                utm_term: order.track_props.term || null,
              }
            : { src: null, sck: null, utm_source: null, utm_campaign: null, utm_medium: null, utm_content: null, utm_term: null },
          commission: {
            totalPriceInCents: order.total_cents,
            gatewayFeeInCents: order.gateway_fee_cents || 0,
            userCommissionInCents: Math.max(0, order.total_cents - (order.gateway_fee_cents || 0)),
          },
          isTest: false,
        });

        if (event === 'TRANSACTION_PAID' && order.customer_email) {
          const trackUrl = `https://${req.headers.host}/rastreio.html?pedido=${encodeURIComponent(order.identifier)}`;
          await sendEmail({
            to: order.customer_email,
            subject: 'Pagamento confirmado — seu kit Clarée já está sendo separado! 💗',
            html: `<p>Olá, ${order.customer_name}!</p>
                   <p>Recebemos a confirmação do seu pagamento via PIX. Seu pedido <strong>${order.kit_name}</strong> já está sendo separado e embalado com carinho.</p>
                   <p>Você pode acompanhar cada etapa do seu pedido a qualquer momento por aqui: <a href="${trackUrl}">${trackUrl}</a></p>
                   <p>Assim que ele sair para entrega, você recebe um novo e-mail com a atualização (e o código de rastreio, quando disponível).</p>
                   <p>Qualquer dúvida, é só chamar no WhatsApp.</p>
                   <p>Equipe Clarée</p>`,
          });
        }
      }
    } catch (err) {
      console.error('[korvex-webhook] falha ao atualizar pedido/notificar Utmify', err);
    }
  }

  res.status(200).json({ received: true });
};
