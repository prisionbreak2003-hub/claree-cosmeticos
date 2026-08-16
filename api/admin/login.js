const { createSessionToken, SESSION_TTL_MS } = require('../../lib/adminAuth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
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

  const { user, password } = body || {};
  const validUser = process.env.ADMIN_USER;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPassword || user !== validUser || password !== validPassword) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const token = createSessionToken();
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`
  );
  res.status(200).json({ ok: true });
};
