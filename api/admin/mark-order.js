const { sql, ensureSchema } = require('../../lib/db');
const { isAuthenticated } = require('../../lib/adminAuth');
const { sendEmail } = require('../../lib/resend');

async function markOne(identifier, outcome) {
  let rows;
  if (outcome === 'shipped') {
    rows = await sql`UPDATE orders SET status = 'shipped', shipped_at = now()
                      WHERE identifier = ${identifier} AND status = 'paid' RETURNING *`;
  } else if (outcome === 'delivered') {
    rows = await sql`UPDATE orders SET status = 'delivered', delivered_at = now()
                      WHERE identifier = ${identifier} AND status = 'shipped' RETURNING *`;
  } else {
    rows = await sql`UPDATE orders SET status = 'lost', lost_at = now()
                      WHERE identifier = ${identifier} AND status = 'shipped' RETURNING *`;
  }

  const order = rows[0];
  if (!order) return null;

  if (order.customer_email) {
    if (outcome === 'shipped') {
      await sendEmail({
        to: order.customer_email,
        subject: 'Seu kit Clarée saiu para entrega! 📦',
        html: `<p>Olá, ${order.customer_name}!</p>
               <p>Seu pedido <strong>${order.kit_name}</strong> já saiu para entrega.</p>
               <p>Equipe Clarée</p>`,
      });
    } else if (outcome === 'delivered') {
      await sendEmail({
        to: order.customer_email,
        subject: 'Seu kit Clarée foi entregue! ✅',
        html: `<p>Olá, ${order.customer_name}!</p>
               <p>Seu pedido <strong>${order.kit_name}</strong> foi entregue.</p>
               <p>Esperamos que aproveite! Qualquer dúvida, é só chamar no WhatsApp.</p>
               <p>Equipe Clarée</p>`,
      });
    } else {
      await sendEmail({
        to: order.customer_email,
        subject: 'Atualização sobre a entrega do seu pedido',
        html: `<p>Olá, ${order.customer_name}!</p>
               <p>Identificamos um problema na entrega do seu pedido <strong>${order.kit_name}</strong> e ele consta como extraviado pela transportadora.</p>
               <p>Nossa equipe de suporte já foi notificada e vai entrar em contato pra resolver isso com você.</p>
               <p>Equipe Clarée</p>`,
      });
    }
  }

  return order;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'invalid_json' });
      return;
    }
  }

  const { identifier, identifiers, outcome } = body || {};
  const codes = Array.isArray(identifiers) ? identifiers : identifier ? [identifier] : [];

  if (!codes.length || !['shipped', 'delivered', 'lost'].includes(outcome)) {
    res.status(400).json({ error: 'invalid_params' });
    return;
  }

  await ensureSchema();

  const updated = [];
  const failed = [];
  for (const code of codes) {
    try {
      const order = await markOne(code, outcome);
      if (order) updated.push(order.identifier);
      else failed.push(code);
    } catch (err) {
      console.error('[mark-order] falha ao processar', code, err);
      failed.push(code);
    }
  }

  res.status(200).json({ ok: true, updated, failed });
};
