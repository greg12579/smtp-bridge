# Ghost Mail Bridge 📬

**SMTP-to-Mailgun HTTP API bridge for Railway (or any platform that blocks outbound SMTP)**

Ghost requires SMTP for transactional emails (login verification codes, password resets, member magic links). Railway blocks all outbound SMTP ports (25, 465, 587, 2525). This tiny service solves that by running an SMTP server on Railway's private network and forwarding all emails through Mailgun's HTTP API.

## How It Works

```
Ghost → SMTP → mail-bridge (private network) → Mailgun HTTP API → Email delivered
```

- Listens as an SMTP server on Railway's internal network
- Receives emails from Ghost via standard SMTP (no auth required on private network)
- Forwards them through Mailgun's REST API (HTTP, not blocked)
- No changes to Ghost required — just point `mail__options__host` at the bridge

## Deploy to Railway

### 1. One-Click Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/ghost-mail-bridge)

Or deploy manually:

### 2. Manual Deploy

1. Fork this repo
2. Create a new service in your Railway project
3. Connect it to your fork
4. Set the environment variables (see below)
5. Deploy

### 3. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILGUN_API_KEY` | ✅ | Your Mailgun sending API key |
| `MAILGUN_DOMAIN` | ✅ | Your Mailgun domain (e.g. `yourdomain.com`) |
| `MAILGUN_BASE_URL` | ❌ | Mailgun API base URL. Default: `https://api.mailgun.net/v3`. Use `https://api.eu.mailgun.net/v3` for EU region. |
| `PORT` | ❌ | SMTP listen port. Default: `2525` |

### 4. Configure Ghost

Set these environment variables on your **Ghost** service:

```
mail__transport=SMTP
mail__options__host=mail-bridge.railway.internal
mail__options__port=2525
mail__options__secure=false
mail__from=Your Name <noreply@yourdomain.com>
```

Replace `mail-bridge` with whatever you named the service in Railway. The `.railway.internal` domain is Railway's private networking — no external exposure needed.

## What Gets Fixed

- ✅ Admin login verification codes (2FA)
- ✅ Password reset emails  
- ✅ Member signup magic links
- ✅ Any other transactional email Ghost sends

## Requirements

- [Mailgun](https://www.mailgun.com/) account (free tier works)
- Domain verified in Mailgun
- Ghost running on Railway in the same project

## How It Works (Technical)

The bridge uses:
- **[smtp-server](https://www.npmjs.com/package/smtp-server)** — Lightweight SMTP server
- **[mailparser](https://www.npmjs.com/package/mailparser)** — Parses incoming SMTP messages
- **Mailgun REST API** — Sends via HTTP (not blocked by Railway)

When Ghost sends an email:
1. Ghost connects to `mail-bridge.railway.internal:2525` via SMTP
2. The bridge receives and parses the email (from, to, subject, html/text)
3. The bridge POSTs to Mailgun's `/messages` API endpoint
4. Mailgun delivers the email
5. Ghost gets a success response and continues normally

## License

MIT — use it however you want.
