/*
  OIDC Debugger – Callback logic (Phase-1)
  Parses query and fragment; decodes id_token (header+payload, unverified).
*/

// JWT and token helpers
function isProbablyJWT(t){ return typeof t==='string' && t.split('.').length===3; }
function b64urlToJSON(seg){
  try{
    let s=seg.replace(/-/g,'+').replace(/_/g,'/'); const pad=s.length%4; if(pad) s+='='.repeat(4-pad);
    const str=atob(s); const bytes=Uint8Array.from(str, c=>c.charCodeAt(0));
    return {ok:true, json: JSON.parse(new TextDecoder().decode(bytes))};
  }catch(e){ return {ok:false, error:String(e)};}
}
function decodeJWT(jwt){
  if(!isProbablyJWT(jwt)) return {ok:false, reason:'not_jwt'};
  const [h,p]=jwt.split('.');
  const H=b64urlToJSON(h), P=b64urlToJSON(p);
  if(!H.ok||!P.ok) return {ok:false, reason:'decode_failed', head:H, pay:P};
  return {ok:true, header:H.json, payload:P.json};
}
function pretty(x){ try{return JSON.stringify(x,null,2);}catch{ return String(x); } }
function renderDecoded(token, preHeaderId, prePayloadId){
  const preH=document.getElementById(preHeaderId), preP=document.getElementById(prePayloadId);
  if(!token){ preH.textContent=''; preP.textContent=''; return; }
  const dec=decodeJWT(token);
  if(dec.ok){ preH.textContent=pretty(dec.header); preP.textContent=pretty(dec.payload); }
  else if(dec.reason==='not_jwt'){ preH.textContent='(not a JWT)'; preP.textContent='(not a JWT)'; }
  else { preH.textContent='(decode failed)'; preP.textContent=pretty(dec); }
}

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
      
      // Populate tokens from exchange response
      (function populateFromExchange(json){
        const d = json && (json.data || json);
        if(!d) return;
        const at = d.access_token || d.token || null;
        const it = d.id_token || null;
        const rt = d.refresh_token || null;
        const typ = d.token_type || null;
        const exp = d.expires_in || null;
        const scp = d.scope || null;

        if(at) document.getElementById('tok_access').value = at;
        if(it) document.getElementById('tok_id').value = it;
        if(rt) document.getElementById('tok_refresh').value = rt;
        if(typ) document.getElementById('tok_type').value = typ;
        if(exp!=null) document.getElementById('tok_expires_in').value = String(exp);
        if(scp) document.getElementById('tok_scope').value = scp;

        renderDecoded(document.getElementById('tok_id').value, 'dec_id_header','dec_id_payload');
        renderDecoded(document.getElementById('tok_access').value, 'dec_access_header','dec_access_payload');

        try{
          sessionStorage.setItem('oidcdbg:lastTokens', JSON.stringify({
            access_token: at, id_token: it, refresh_token: rt, token_type: typ, scope: scp, expires_in: exp
          }));
        }catch{}
      })(json);
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
  
  // Initialize tokens from URL or sessionStorage
  (function initTokensFromUrl(){
    // assume you already have parsed query/fragment into objects q and f; reuse them if present.
    const params = new URLSearchParams(location.search);
    const frag = (()=>{ const h=location.hash.startsWith('#')?location.hash.slice(1):''; return new URLSearchParams(h); })();

    const idFromUrl = params.get('id_token') || frag.get('id_token');
    const atFromUrl = params.get('access_token') || frag.get('access_token');

    if(idFromUrl) document.getElementById('tok_id').value = idFromUrl;
    if(atFromUrl) document.getElementById('tok_access').value = atFromUrl;

    const scope = params.get('scope') || frag.get('scope');
    const typ = params.get('token_type') || frag.get('token_type');
    const exp = params.get('expires_in') || frag.get('expires_in');
    if(scope) document.getElementById('tok_scope').value = scope;
    if(typ) document.getElementById('tok_type').value = typ;
    if(exp) document.getElementById('tok_expires_in').value = exp;

    // Fallback to sessionStorage if empty
    try{
      const saved = JSON.parse(sessionStorage.getItem('oidcdbg:lastTokens')||'null');
      if(saved){
        const set = (id,val)=>{ if(val && !document.getElementById(id).value) document.getElementById(id).value = val; };
        set('tok_access', saved.access_token);
        set('tok_id', saved.id_token);
        set('tok_refresh', saved.refresh_token);
        set('tok_type', saved.token_type);
        set('tok_scope', saved.scope);
        set('tok_expires_in', saved.expires_in);
      }
    }catch{}

    // Decode whatever we now have
    renderDecoded(document.getElementById('tok_id').value, 'dec_id_header','dec_id_payload');
    renderDecoded(document.getElementById('tok_access').value, 'dec_access_header','dec_access_payload');
  })();
  
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
  
  // Wire up copy buttons for token fields
  function wireCopy(btnId, elId){
    const btn=document.getElementById(btnId); const el=document.getElementById(elId);
    if(btn && el){ btn.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(el.value || el.textContent || ''); }catch{} }); }
  }
  wireCopy('copy_access_btn','tok_access');
  wireCopy('copy_id_btn','tok_id');
  wireCopy('copy_refresh_btn','tok_refresh');

  document.getElementById('copy_dec_id_btn')?.addEventListener('click', async ()=>{
    const h=document.getElementById('dec_id_header').textContent;
    const p=document.getElementById('dec_id_payload').textContent;
    try{ await navigator.clipboard.writeText(JSON.stringify({header:JSON.parse(h), payload:JSON.parse(p)}, null, 2)); }
    catch{ await navigator.clipboard.writeText(h + '\n' + p); }
  });
  document.getElementById('copy_dec_access_btn')?.addEventListener('click', async ()=>{
    const h=document.getElementById('dec_access_header').textContent;
    const p=document.getElementById('dec_access_payload').textContent;
    try{ await navigator.clipboard.writeText(JSON.stringify({header:JSON.parse(h), payload:JSON.parse(p)}, null, 2)); }
    catch{ await navigator.clipboard.writeText(h + '\n' + p); }
  });
});


