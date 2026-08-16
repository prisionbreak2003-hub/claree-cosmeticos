const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const sql = neon(connectionString);

let schemaReady = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          identifier TEXT UNIQUE NOT NULL,
          transaction_id TEXT,
          customer_name TEXT NOT NULL,
          customer_email TEXT,
          customer_whatsapp TEXT,
          kit_index INTEGER NOT NULL,
          kit_name TEXT NOT NULL,
          total_cents INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending_payment',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          paid_at TIMESTAMPTZ
        )
      `;
      // colunas adicionadas depois da criação inicial — ADD COLUMN IF NOT EXISTS é idempotente
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_document TEXT`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_ip TEXT`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS track_props JSONB`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_fee_cents INTEGER`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ`;
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier_tracking_code TEXT`;
    })();
  }
  await schemaReady;
}

module.exports = { sql, ensureSchema };
