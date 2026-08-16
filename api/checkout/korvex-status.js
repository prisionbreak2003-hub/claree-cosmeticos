const KORVEX_BASE_URL = 'https://app.korvex.com.br/api/v1';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const { KORVEX_PUBLIC_KEY, KORVEX_SECRET_KEY } = process.env;
  if (!KORVEX_PUBLIC_KEY || !KORVEX_SECRET_KEY) {
    res.status(500).json({ error: 'server_misconfigured' });
    return;
  }

  const { id } = req.query || {};
  if (!id) {
    res.status(400).json({ error: 'missing_id' });
    return;
  }

  let korvexRes;
  let data;
  try {
    korvexRes = await fetch(`${KORVEX_BASE_URL}/gateway/transactions?id=${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: {
        'x-public-key': KORVEX_PUBLIC_KEY,
        'x-secret-key': KORVEX_SECRET_KEY,
      },
    });
    data = await korvexRes.json();
  } catch (err) {
    res.status(502).json({ error: 'korvex_unreachable' });
    return;
  }

  if (!korvexRes.ok) {
    res.status(korvexRes.status).json({ error: data?.errorCode || 'korvex_error' });
    return;
  }

  res.status(200).json({
    status: data.status,
    payedAt: data.payedAt || null,
  });
};
