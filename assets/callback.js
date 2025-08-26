/*
  OIDC Debugger – Callback logic (Phase-1)
  Parses query and fragment; decodes id_token (header+payload, unverified).
*/

function b64urlToString(b64url) {
  try {
    const bytes = (window.oidcdbg ? window.oidcdbg.b64urlDecode : (s=>{
      const t = s.replace(/-/g,'+').replace(/_/g,'/');
      const pad = t.length % 4 === 0 ? '' : '='.repeat(4 - (t.length % 4));
      const bin = atob(t + pad);
      return new Uint8Array([...bin].map(c=>c.charCodeAt(0)));
    }))(b64url);
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

function tryParseJSON(text) { try { return JSON.parse(text); } catch { return null; } }

function parseParams(str) {
  const out = {};
  const usp = new URLSearchParams(str || '');
  usp.forEach((v,k)=>{ out[k] = v; });
  return out;
}

function pretty(obj) { return JSON.stringify(obj, null, 2); }

function render() {
  const queryObj = parseParams(location.search.slice(1));
  const fragObj = parseParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash);

  document.getElementById('query_json').textContent = pretty(queryObj);
  document.getElementById('fragment_json').textContent = pretty(fragObj);

  const token = queryObj.id_token || fragObj.id_token;
  const dest = document.getElementById('idtoken_json');
  const copyBtn = document.getElementById('copy_idtoken');
  if (!token) {
    dest.textContent = 'No id_token found.';
    copyBtn.disabled = true;
    return;
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    dest.textContent = 'Invalid JWT format';
    copyBtn.disabled = true;
    return;
  }
  const header = tryParseJSON(b64urlToString(parts[0])) || { error: 'Failed to decode header' };
  const payload = tryParseJSON(b64urlToString(parts[1])) || { error: 'Failed to decode payload' };
  dest.textContent = pretty({ header, payload });
  copyBtn.disabled = false;
}

function setupTokenExchange() {
  // Parse callback URL to extract code
  const queryObj = parseParams(location.search.slice(1));
  const fragObj = parseParams(location.hash.startsWith('#') ? location.hash.slice(1) : location.hash);
  const code = queryObj.code || fragObj.code || '';

  // Read saved auth context
  let lastAuth = {};
  try {
    const saved = sessionStorage.getItem('oidcdbg:lastAuth');
    if (saved) {
      lastAuth = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse saved auth context:', e);
  }

  // Prefill token exchange fields
  document.getElementById('tx_client_id').value = lastAuth.client_id || '';
  document.getElementById('tx_redirect_uri').value = lastAuth.redirect_uri || location.origin + '/callback';
  document.getElementById('tx_code').value = code;
  document.getElementById('tx_code_verifier').value = lastAuth.code_verifier || '';

  // Wire up exchange button
  const btn = document.getElementById('tx_exchange_btn');
  const out = document.getElementById('tx_result');

  btn.addEventListener('click', async () => {
    const token_endpoint = document.getElementById('tx_token_endpoint').value.trim();
    const client_id = document.getElementById('tx_client_id').value.trim();
    const redirect_uri = document.getElementById('tx_redirect_uri').value.trim();
    const code = document.getElementById('tx_code').value.trim();
    const code_verifier = document.getElementById('tx_code_verifier').value.trim();

    if (!token_endpoint || !client_id || !redirect_uri || !code) {
      out.textContent = 'Missing required fields for token exchange.';
      return;
    }

    btn.disabled = true;
    out.textContent = 'Exchanging code…';

    try {
      const resp = await fetch('/api/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_endpoint, client_id, redirect_uri, code, code_verifier })
      });
      const json = await resp.json();
      out.textContent = JSON.stringify(json, null, 2);
    } catch (e) {
      out.textContent = `Request failed: ${String(e)}`;
    } finally {
      btn.disabled = false;
    }
  });
}

function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>el.classList.add('hidden'), 1600);
}

window.addEventListener('DOMContentLoaded', () => {
  render();
  setupTokenExchange();
  
  document.getElementById('copy_query').addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(document.getElementById('query_json').textContent);
    showToast('Query JSON copied');
  });
  document.getElementById('copy_fragment').addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(document.getElementById('fragment_json').textContent);
    showToast('Fragment JSON copied');
  });
  document.getElementById('copy_idtoken').addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(document.getElementById('idtoken_json').textContent);
    showToast('Decoded ID Token copied');
  });
});


