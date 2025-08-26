const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic import for node-fetch (CommonJS compatibility)
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

// Serve static files from project root
app.use(express.static(__dirname));

// Route for /callback that serves callback.html
app.get('/callback', (req, res) => {
  // Set no-store caching headers for callback responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  res.sendFile(path.join(__dirname, 'callback.html'));
});

// Token exchange endpoint
app.post('/api/exchange-token', async (req, res) => {
  try {
    const {
      token_endpoint,
      client_id,
      code,
      redirect_uri,
      code_verifier
    } = req.body || {};

    if (!token_endpoint || !client_id || !code || !redirect_uri) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }

    // Build x-www-form-urlencoded body per RFC 6749 §4.1.3 + PKCE
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id
    });
    if (code_verifier) params.set('code_verifier', code_verifier);

    const resp = await fetch(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const text = await resp.text();
    // Try to parse JSON; if not JSON, return raw text
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }

    res.status(resp.status).json({
      ok: resp.ok,
      status: resp.status,
      data: body
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'exchange_failed', message: String(e) });
  }
});

// Default route serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OIDC Debugger running on http://localhost:${PORT}`);
  console.log(`- Builder: http://localhost:${PORT}`);
  console.log(`- Callback: http://localhost:${PORT}/callback`);
});
