/*
  OIDC Debugger – Shared helpers and index page logic (Phase-1)
  Static only. Utilities: random generators, base64url, PKCE, storage, UI.
*/

// ---------- Utilities ----------
const OIDC_NS = 'oidcdbg:v1';

function prettyJSON(obj) { return JSON.stringify(obj, null, 2); }

function toUint8(str) {
  return new TextEncoder().encode(str);
}

function fromUint8(arr) {
  return new TextDecoder().decode(arr);
}

function b64urlEncode(bytes) {
  const bin = typeof bytes === 'string' ? toUint8(bytes) : bytes;
  let b64 = btoa(String.fromCharCode(...new Uint8Array(bin)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s + pad);
  const bytes = new Uint8Array([...b].map(c => c.charCodeAt(0)));
  return bytes;
}

function randomHex(byteLen) {
  const arr = crypto.getRandomValues(new Uint8Array(byteLen));
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function randomB64Url(byteLen) {
  const arr = crypto.getRandomValues(new Uint8Array(byteLen));
  return b64urlEncode(arr);
}

async function computeCodeChallengeS256(verifier) {
  const data = toUint8(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return b64urlEncode(new Uint8Array(digest));
}

function parseExtras(text) {
  const out = {};
  if (!text) return out;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// ---------- Storage ----------
function storageKey(name) { return `${OIDC_NS}:profile:${name}`; }

function saveProfile(name, data) {
  if (!name) throw new Error('Profile name required');
  localStorage.setItem(storageKey(name), JSON.stringify(data));
  const list = new Set(listProfiles());
  list.add(name);
  localStorage.setItem(`${OIDC_NS}:profiles`, JSON.stringify([...list]));
}

function loadProfile(name) {
  const raw = localStorage.getItem(storageKey(name));
  return raw ? JSON.parse(raw) : null;
}

function listProfiles() {
  try {
    const raw = localStorage.getItem(`${OIDC_NS}:profiles`);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function deleteProfile(name) {
  localStorage.removeItem(storageKey(name));
  const remaining = listProfiles().filter(n => n !== name);
  localStorage.setItem(`${OIDC_NS}:profiles`, JSON.stringify(remaining));
}

// ---------- UI Helpers ----------
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 1600);
}

function showAlert(msg) {
  const el = document.getElementById('alert');
  el.className = '';
  el.classList.add('mt-2','rounded','px-3','py-2','text-sm','border');
  el.classList.add('bg-red-50','text-red-800','border-red-300','dark:bg-red-900/30','dark:text-red-200','dark:border-red-700');
  el.textContent = msg;
}

function clearAlert() {
  const el = document.getElementById('alert');
  el.classList.add('hidden');
  el.textContent = '';
}

// ---------- Form Logic ----------
function byId(id) { return document.getElementById(id); }

function collectForm() {
  let endpoint = byId('authorization_endpoint')?.value?.trim() || '';
  if (endpoint === 'custom') {
    endpoint = byId('authorization_endpoint_custom')?.value?.trim() || '';
  }
  let clientIdInput = byId('client_id');
  let clientIdSelect = byId('client_id_select');
  let client_id = '';
  if (clientIdSelect && clientIdSelect.style.display !== 'none') {
    client_id = clientIdSelect.value ? clientIdSelect.value.trim() : '';
  } else if (clientIdInput) {
    client_id = clientIdInput.value ? clientIdInput.value.trim() : '';
  } else {
    client_id = '';
  }
  return {
    authorization_endpoint: endpoint,
    client_id: client_id,
    redirect_uri: byId('redirect_uri')?.value?.trim() || '',
    scope: byId('scope')?.value?.trim() || '',
    response_type: byId('response_type')?.value?.trim() || '',
    response_mode: byId('response_mode')?.value || '',
    state: byId('state')?.value?.trim() || '',
    nonce: byId('nonce')?.value?.trim() || '',
    pkce: byId('pkce')?.value || '',
    code_verifier: byId('code_verifier')?.value?.trim() || '',
    code_challenge: byId('code_challenge')?.value?.trim() || '',
    extra_params: byId('extra_params')?.value || ''
  };
}

function fillForm(data) {
  for (const [k,v] of Object.entries(data)) {
    const el = byId(k);
    if (el) el.value = v ?? '';
  }
}

function validate(data) {
  if (!data.authorization_endpoint) return 'authorization_endpoint is required';
  if (!data.client_id) return 'client_id is required';
  if (!data.redirect_uri) return 'redirect_uri is required';
  if (!data.scope) return 'scope is required';
  if (!data.response_type) return 'response_type is required';
  if (data.response_type.includes('id_token') && !data.nonce) return 'nonce is required when response_type includes id_token';
  return null;
}

async function ensurePkce(data) {
  if (data.pkce === 'none') {
    byId('code_challenge').value = '';
    return data;
  }
  // verifier
  if (!data.code_verifier) {
    data.code_verifier = randomB64Url(32);
    byId('code_verifier').value = data.code_verifier;
  }
  // challenge
  if (data.pkce === 'S256') {
    const cc = await computeCodeChallengeS256(data.code_verifier);
    data.code_challenge = cc;
    byId('code_challenge').value = cc;
  } else {
    data.code_challenge = data.code_verifier;
    byId('code_challenge').value = data.code_verifier;
  }
  return data;
}

function buildUrlParams(data) {
  const p = new URLSearchParams();
  p.set('client_id', data.client_id);
  p.set('redirect_uri', data.redirect_uri);
  p.set('scope', data.scope);
  p.set('response_type', data.response_type);
  if (data.state) p.set('state', data.state);
  if (data.nonce) p.set('nonce', data.nonce);

  if (data.pkce !== 'none') {
    p.set('code_challenge_method', data.pkce);
    p.set('code_challenge', data.code_challenge);
  }

  const extras = parseExtras(data.extra_params);
  for (const [k,v] of Object.entries(extras)) p.set(k, v);
  if (data.response_mode) p.set('response_mode', data.response_mode);
  return p;
}

async function buildUrl() {
  clearAlert();
  let data = collectForm();
  if (!data.state) { data.state = randomHex(16); byId('state').value = data.state; }
  if (data.response_type.includes('id_token') && !data.nonce) { data.nonce = randomHex(16); byId('nonce').value = data.nonce; }
  data = await ensurePkce(data);
  const error = validate(data);
  if (error) { showAlert(error); return null; }
  const ep = data.authorization_endpoint;
  const params = buildUrlParams(data);
  const url = ep + (ep.includes('?') ? '&' : '?') + params.toString();
  byId('result_url').value = url;
  byId('btn-copy').disabled = false;
  return url;
}

// ---------- Wire events ----------
function refreshProfileList() {
  const list = byId('profile_list');
  list.innerHTML = '';
  const profs = listProfiles();
  for (const n of profs) {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    list.appendChild(opt);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Gently set default redirect URI to /callback
  const redirectInput = byId('redirect_uri');
  const currentValue = redirectInput.value.trim();
  const expectedOldValue = `${location.origin}/callback.html`;
  
  if (!currentValue || currentValue === expectedOldValue) {
    redirectInput.value = `${location.origin}/callback`;
  }

  // Buttons: generate
  document.querySelector('[data-gen="state"]').addEventListener('click', (e) => {
    e.preventDefault(); byId('state').value = randomHex(16);
  });
  document.querySelector('[data-gen="nonce"]').addEventListener('click', (e) => {
    e.preventDefault(); byId('nonce').value = randomHex(16);
  });
  document.querySelector('[data-gen="verifier"]').addEventListener('click', async (e) => {
    e.preventDefault();
    byId('code_verifier').value = randomB64Url(32);
    const mode = byId('pkce').value;
    if (mode !== 'none') {
      byId('code_challenge').value = mode === 'S256' ? await computeCodeChallengeS256(byId('code_verifier').value) : byId('code_verifier').value;
    }
  });

  byId('pkce').addEventListener('change', async () => {
    const mode = byId('pkce').value;
    if (mode === 'none') {
      byId('code_verifier').value = '';
      byId('code_challenge').value = '';
      return;
    }
    if (!byId('code_verifier').value) byId('code_verifier').value = randomB64Url(32);
    byId('code_challenge').value = mode === 'S256' ? await computeCodeChallengeS256(byId('code_verifier').value) : byId('code_verifier').value;
  });

  byId('btn-build').addEventListener('click', async (e) => { e.preventDefault(); await buildUrl(); });
  byId('btn-copy').addEventListener('click', async (e) => {
    e.preventDefault();
    const url = byId('result_url').value.trim();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    showToast('Authorization URL copied');
  });
  byId('btn-start').addEventListener('click', async (e) => {
    e.preventDefault();
    let url = byId('result_url').value.trim();
    if (!url) url = await buildUrl();
    if (url) {
      // Save auth context before redirect
      const authContext = {
        client_id: byId('client_id').value.trim(),
        redirect_uri: byId('redirect_uri').value.trim(),
        scope: byId('scope').value.trim(),
        response_type: byId('response_type').value.trim(),
        state: byId('state').value.trim(),
        nonce: byId('nonce').value.trim(),
        pkce_method: byId('pkce').value,
        code_verifier: byId('code_verifier').value.trim(),
        built_url: url
      };
      sessionStorage.setItem('oidcdbg:lastAuth', JSON.stringify(authContext));
      window.location.href = url;
    }
  });
  byId('btn-reset').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-root').querySelectorAll('input, textarea, select').forEach(el => {
      if (el.id === 'redirect_uri') el.value = 'http://localhost:3000/callback';
      else if (el.id === 'scope') el.value = 'openid profile email';
      else if (el.id === 'response_type') el.value = 'code';
      else if (el.id === 'response_mode') el.value = '';
      else if (el.id === 'pkce') el.value = 'none';
      else el.value = '';
    });
    byId('btn-copy').disabled = true;
    clearAlert();
  });

  // Profiles
  refreshProfileList();
  byId('btn-save').addEventListener('click', (e) => {
    e.preventDefault();
    const name = byId('profile_name').value.trim();
    if (!name) { showAlert('Profile name required'); return; }
    saveProfile(name, collectForm());
    refreshProfileList();
    showToast('Profile saved');
  });
  byId('btn-load').addEventListener('click', (e) => {
    e.preventDefault();
    const name = byId('profile_name').value.trim() || byId('profile_list').value;
    if (!name) { showAlert('Choose a profile to load'); return; }
    const data = loadProfile(name);
    if (!data) { showAlert('Profile not found'); return; }
    fillForm(data);
    clearAlert();
  });
  byId('btn-delete').addEventListener('click', (e) => {
    e.preventDefault();
    const name = byId('profile_name').value.trim() || byId('profile_list').value;
    if (!name) { showAlert('Choose a profile to delete'); return; }
    deleteProfile(name);
    refreshProfileList();
    showToast('Profile deleted');
  });
});

// Expose minimal helpers for callback page reuse if needed
window.oidcdbg = {
  b64urlEncode, b64urlDecode, randomHex, randomB64Url, computeCodeChallengeS256,
  prettyJSON, parseExtras,
  saveProfile, loadProfile, listProfiles, deleteProfile
};


