const { sql, ensureSchema } = require('../../lib/db');
const { isAuthenticated } = require('../../lib/adminAuth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  await ensureSchema();
  const orders = await sql`
    SELECT identifier, transaction_id, customer_name, customer_email, customer_whatsapp,
           kit_name, total_cents, status, created_at, paid_at, refunded_at, shipped_at, delivered_at, lost_at, carrier_tracking_code
    FROM orders
    ORDER BY created_at DESC
    LIMIT 300
  `;

  res.status(200).json({ orders });
};
