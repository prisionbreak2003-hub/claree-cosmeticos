const { sql, ensureSchema } = require('../../lib/db');
const { precoDoKit, sedexCentavos } = require('../../lib/precos');
const { enviarPedidoUtmify, utcStamp } = require('../../lib/utmify');

const KORVEX_BASE_URL = 'https://app.korvex.com.br/api/v1';

function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
function emailValido(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '')); }
function toReais(cents) { return Math.round(Number(cents) || 0) / 100; }
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || '0.0.0.0';
}
// checkout.html manda trackProps sem o prefixo "utm_" (source/campaign/medium/...) — remapeia pro formato da Utmify
function utmParams(trackProps) {
  const t = trackProps || {};
  return {
    src: t.src || null,
    sck: t.sck || null,
    utm_source: t.source || null,
    utm_campaign: t.campaign || null,
    utm_medium: t.medium || null,
    utm_content: t.content || null,
    utm_term: t.term || null,
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const { KORVEX_PUBLIC_KEY, KORVEX_SECRET_KEY } = process.env;
  if (!KORVEX_PUBLIC_KEY || !KORVEX_SECRET_KEY) {
    res.status(500).json({ error: 'server_misconfigured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { res.status(400).json({ error: 'invalid_json' }); return; }
  }
  body = body || {};

  const { customer, address, trackProps } = body;
  const kitIndex = Number(body.kitIndex);

  if (!customer || !customer.name || customer.name.trim().length < 3) {
    res.status(400).json({ error: 'missing_customer_data', message: 'Nome é obrigatório' });
    return;
  }
  if (!emailValido(customer.email)) {
    res.status(400).json({ error: 'missing_customer_data', message: 'E-mail inválido' });
    return;
  }
  if (!customer.whatsapp || !customer.whatsapp.trim()) {
    res.status(400).json({ error: 'missing_customer_data', message: 'WhatsApp é obrigatório' });
    return;
  }
  const cpfDigitos = soDigitos(customer.cpf);
  if (cpfDigitos.length !== 11) {
    res.status(400).json({ error: 'missing_customer_data', message: 'CPF inválido' });
    return;
  }
  if (![0, 1, 2].includes(kitIndex)) {
    res.status(400).json({ error: 'invalid_kit' });
    return;
  }

  // Preço é sempre recalculado aqui — nunca confia em valor vindo do navegador.
  const kit = precoDoKit(kitIndex);
  const frete = body.frete === 'sedex' ? 'sedex' : 'pac';
  const shippingCents = frete === 'sedex' ? sedexCentavos() : 0;
  const totalCents = kit.precoCentavos + shippingCents;

  const identifier =
    (typeof body.identifier === 'string' && body.identifier.trim()) ||
    `claree-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const korvexPayload = {
    identifier,
    amount: toReais(totalCents),
    shippingFee: toReais(shippingCents),
    client: {
      name: customer.name,
      email: customer.email,
      phone: customer.whatsapp,
      document: customer.cpf,
    },
    products: [
      { id: 'kit-' + kitIndex, name: kit.nome, quantity: 1, price: toReais(kit.precoCentavos) },
    ],
    metadata: {
      orderId: identifier,
      frete,
      address: address || null,
      ...(trackProps && typeof trackProps === 'object' ? trackProps : {}),
    },
    callbackUrl: `https://${req.headers.host}/api/webhooks/korvex`,
  };

  let korvexRes;
  let data;
  try {
    korvexRes = await fetch(`${KORVEX_BASE_URL}/gateway/pix/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': KORVEX_PUBLIC_KEY,
        'x-secret-key': KORVEX_SECRET_KEY,
      },
      body: JSON.stringify(korvexPayload),
    });
    data = await korvexRes.json();
  } catch (err) {
    res.status(502).json({ error: 'korvex_unreachable' });
    return;
  }

  if (!korvexRes.ok) {
    res.status(korvexRes.status).json({
      error: data?.errorCode || 'korvex_error',
      message: data?.message || 'Falha ao gerar cobrança Pix',
      details: data?.details || null,
    });
    return;
  }

  const pixCode = (data.pix && data.pix.code) || null;

  if (!pixCode) {
    res.status(422).json({
      error: data?.status || 'no_pix_data',
      message: data?.errorDescription || 'Não foi possível gerar o Pix para esta transação.',
    });
    return;
  }

  const ip = clientIp(req);
  const gatewayFeeCents = Math.round((Number(data.fee) || 0) * 100);

  try {
    await ensureSchema();
    await sql`
      INSERT INTO orders (identifier, transaction_id, customer_name, customer_email, customer_whatsapp, customer_document, customer_ip, kit_index, kit_name, total_cents, gateway_fee_cents, track_props, status)
      VALUES (${identifier}, ${data.transactionId || null}, ${customer.name}, ${customer.email}, ${customer.whatsapp}, ${cpfDigitos}, ${ip}, ${kitIndex}, ${kit.nome}, ${totalCents}, ${gatewayFeeCents}, ${JSON.stringify(trackProps || {})}, 'pending_payment')
      ON CONFLICT (identifier) DO NOTHING
    `;
  } catch (err) {
    console.error('[korvex-pix] falha ao salvar pedido no banco', err);
  }

  // Reporta a venda pra Utmify assim que o Pix é gerado (status "aguardando
  // pagamento"). O webhook da Korvex atualiza pra "paid"/"refunded"/etc depois.
  // Aguarda (mesmo sendo fire-and-forget por dentro) pra não ser cancelada
  // quando a function serverless encerrar logo após a resposta.
  await enviarPedidoUtmify({
    orderId: identifier,
    platform: 'Korvex',
    paymentMethod: 'pix',
    status: 'waiting_payment',
    createdAt: utcStamp(),
    approvedDate: null,
    refundedAt: null,
    customer: { name: customer.name, email: customer.email, phone: soDigitos(customer.whatsapp), document: cpfDigitos, country: 'BR', ip },
    products: [{ id: 'kit-' + kitIndex, name: kit.nome, planId: null, planName: null, quantity: 1, priceInCents: totalCents }],
    trackingParameters: utmParams(trackProps),
    commission: { totalPriceInCents: totalCents, gatewayFeeInCents: gatewayFeeCents, userCommissionInCents: Math.max(0, totalCents - gatewayFeeCents) },
    isTest: false,
  });

  res.status(201).json({
    transactionId: data.transactionId,
    identifier,
    pixCode,
    totalCents,
  });
};
