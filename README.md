# OpenID Connect Debugger

v0.1.0

A local OIDC playground to build /authorize requests, handle /callback, and exchange codes.

## What’s included (v0.1.0)

- Phase-1: Static builder UI (authorize URL, state/nonce generators, PKCE S256/plain, extra params), profiles saved in localStorage, callback page showing query/fragment and unverified ID token decode.
- Phase-2: Minimal Node/Express app to serve pages and map /callback → callback.html; Token Exchange via /api/exchange-token with client auth: none, client_secret_post, client_secret_basic.

## Prerequisites

- Node.js ≥ 18 (recommended)
- An OIDC client registered at your IdP (with redirect URI below)

## Installation

```bash
npm i
```

(If you haven’t already installed express/node-fetch from previous steps, npm i will do it.)

## Run

```bash
npm start
# opens http://localhost:3000
```

Default port: 3000 (override with `PORT=xxxx npm start`)

## Configure your IdP

- Add redirect URI: `http://localhost:3000/callback`
- (If you run the static variant, use `http://localhost:3000/callback.html` instead.)

## Using the app

1. Open `http://localhost:3000`.
2. Fill Authorization Endpoint, Client ID, Redirect URI, Scope (`openid profile email`), Response Type.
3. If using `id_token` or hybrid, ensure Nonce is set (use Generate).
4. If using PKCE, set method to `S256` and click Generate (verifier & challenge appear).
5. Add optional extra params (key=value per line).
6. Click Start (or Build URL then Start).

After login, you land on `/callback`, which shows:

- Query & Fragment params
- Decoded ID Token header/payload (unverified)

To exchange a code: on the callback page, fill Token Endpoint, choose Client Authentication (`none`, `client_secret_post`, `client_secret_basic`), and click Exchange code.

## Token exchange details

- Request: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier` (if PKCE).
- `client_secret_post`: secret in body.
- `client_secret_basic`: `Authorization: Basic base64(client_id:client_secret)` header.
- The server returns the IdP’s JSON (or raw text wrapped) in the Result panel.

## Security notes

- This is a developer tool—don’t expose publicly without hardening.
- Secrets are not stored client-side; avoid committing them.
- For production exposure, add TLS, stricter headers (Helmet/CSP), rate limiting, auth in front, and logging redaction.

## Troubleshooting

- 404 on `/callback`: ensure you are running `npm start` (Express maps `/callback` → `callback.html`), or use `callback.html` in static mode.
- Nonce/PKCE missing: use the Generate buttons.
- Token exchange fails: verify Token Endpoint URL, client auth method, and that the redirect URI matches what’s registered.

## Project structure

```
.
├─ index.html
├─ callback.html
├─ assets/
│  ├─ app.css
│  ├─ app.js
│  ├─ callback.js
│  └─ logo.svg
├─ server.js
└─ package.json
```

## Roadmap

- JWKS fetch & ID token signature verification
- Refresh token flow
- Device code flow
- Discovery (well-known) autofill
- Import/Export profiles

## License

MIT (or keep whatever the repo already uses)
