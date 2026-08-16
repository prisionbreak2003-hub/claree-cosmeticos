// Endpoint público de rastreio — consultado pela página rastreio.html.
// Não exige login: o "segredo" é o próprio identificador do pedido, que só
// a cliente recebe por e-mail. Não expõe dados sensíveis (CPF, endereço, IP).
const { sql, ensureSchema } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const identifier = (req.query && req.query.pedido) || '';
  if (!identifier) {
    res.status(400).json({ error: 'missing_identifier' });
    return;
  }

  await ensureSchema();
  const rows = await sql`
    SELECT identifier, customer_name, kit_name, status,
           created_at, paid_at, shipped_at, delivered_at, lost_at, carrier_tracking_code
    FROM orders
    WHERE identifier = ${identifier}
    LIMIT 1
  `;

  const order = rows[0];
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  res.status(200).json({ order });
};
