# SMTP Bridge 📬

**SMTP relay that forwards emails via HTTP API — for platforms that block outbound SMTP.**

Runs a lightweight SMTP server and relays all emails through your provider's HTTP API. Works on Railway, Render, Fly.io, or anywhere outbound SMTP ports are blocked but HTTP is fine.

Supports **Mailgun**, **SendGrid**, **Postmark**, and **Resend**.

## The Problem

Many hosting platforms block outbound SMTP (ports 25, 465, 587, even 2525) to prevent spam. Apps that need to send email via SMTP (like Ghost, WordPress, GitLab, etc.) break because they can't connect to any mail server.

## The Solution

```
Your App → SMTP → smtp-bridge (private network) → Provider HTTP API → Email delivered
```

The bridge accepts SMTP connections on your internal network and forwards emails through your provider's REST API over HTTPS — which is never blocked.

## Quick Start

### Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https%3A%2F%2Fgithub.com%2Fgreg12579%2Fsmtp-bridge)

### Docker

```bash
docker run -p 2525:2525 \
  -e PROVIDER=mailgun \
  -e MAILGUN_API_KEY=your-key \
  -e MAILGUN_DOMAIN=yourdomain.com \
  ghcr.io/greg12579/smtp-bridge
```

### Node.js

```bash
git clone https://github.com/greg12579/ghost-mail-bridge.git
cd ghost-mail-bridge
npm install
PROVIDER=mailgun MAILGUN_API_KEY=your-key MAILGUN_DOMAIN=yourdomain.com node index.js
```

## Configuration

### General

| Variable | Default | Description |
|----------|---------|-------------|
| `PROVIDER` | `mailgun` | Email provider: `mailgun`, `sendgrid`, `postmark`, or `resend` |
| `PORT` | `2525` | SMTP listen port |

### Mailgun

| Variable | Required | Description |
|----------|----------|-------------|
| `MAILGUN_API_KEY` | ✅ | Mailgun sending API key |
| `MAILGUN_DOMAIN` | ✅ | Verified Mailgun domain |
| `MAILGUN_BASE_URL` | ❌ | Default: `https://api.mailgun.net/v3`. Use `https://api.eu.mailgun.net/v3` for EU. |

### SendGrid

| Variable | Required | Description |
|----------|----------|-------------|
| `SENDGRID_API_KEY` | ✅ | SendGrid API key |

### Postmark

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMARK_API_KEY` | ✅ | Postmark server token |

### Resend

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | ✅ | Resend API key |

## Switching Providers

Just change the `PROVIDER` env var and set the matching API key. No code changes needed.

**Mailgun → SendGrid:**
```bash
# Remove Mailgun vars, add SendGrid
PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
```

**Mailgun → Postmark:**
```bash
PROVIDER=postmark
POSTMARK_API_KEY=xxxxx
```

**Mailgun → Resend:**
```bash
PROVIDER=resend
RESEND_API_KEY=re_xxxxx
```

On Railway, update the env vars on the smtp-bridge service and it'll auto-redeploy. Your app's SMTP config stays the same — it doesn't know or care which provider is behind the bridge.

## Example: Ghost on Railway

Set these on your **Ghost** service:

```
mail__transport=SMTP
mail__options__host=smtp-bridge.railway.internal
mail__options__port=2525
mail__options__secure=false
mail__from=Your Name <noreply@yourdomain.com>
```

Set these on the **smtp-bridge** service:

```
PROVIDER=mailgun
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=yourdomain.com
```

Both services must be in the same Railway project. The `.railway.internal` domain is Railway's private networking.

## Example: Any App

Point your app's SMTP config at the bridge:

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp-bridge.railway.internal` (Railway) or `localhost` (Docker) |
| SMTP Port | `2525` |
| SMTP SSL/TLS | `false` |
| SMTP Auth | Not required |

## How It Works

1. Your app connects to the bridge via standard SMTP
2. Bridge parses the email (from, to, subject, html, text)
3. Bridge sends via your provider's HTTP API
4. Your app gets a success SMTP response

~100 lines of code. Two dependencies (`smtp-server`, `mailparser`). No auth required on the internal network.

## License

MIT
