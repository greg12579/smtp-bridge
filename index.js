const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');

const PORT = parseInt(process.env.PORT || '2525', 10);
const PROVIDER = (process.env.PROVIDER || 'mailgun').toLowerCase();

// Provider configs
const providers = {
  mailgun: {
    required: ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN'],
    async send(from, to, subject, html, text) {
      const key = process.env.MAILGUN_API_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      const base = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3';
      const auth = Buffer.from(`api:${key}`).toString('base64');

      const params = new URLSearchParams();
      params.append('from', from);
      to.forEach(addr => params.append('to', addr));
      params.append('subject', subject);
      if (html) params.append('html', html);
      if (text) params.append('text', text);

      const resp = await fetch(`${base}/${domain}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      if (!resp.ok) throw new Error(`Mailgun ${resp.status}: ${await resp.text()}`);
    }
  },

  sendgrid: {
    required: ['SENDGRID_API_KEY'],
    async send(from, to, subject, html, text) {
      const key = process.env.SENDGRID_API_KEY;

      const content = [];
      if (html) content.push({ type: 'text/html', value: html });
      if (text) content.push({ type: 'text/plain', value: text });
      if (!content.length) content.push({ type: 'text/plain', value: '' });

      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: to.map(email => ({ email })) }],
          from: parseAddress(from),
          subject,
          content
        })
      });
      if (!resp.ok) throw new Error(`SendGrid ${resp.status}: ${await resp.text()}`);
    }
  },

  postmark: {
    required: ['POSTMARK_API_KEY'],
    async send(from, to, subject, html, text) {
      const key = process.env.POSTMARK_API_KEY;

      const body = {
        From: from,
        To: to.join(', '),
        Subject: subject
      };
      if (html) body.HtmlBody = html;
      if (text) body.TextBody = text;

      const resp = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': key,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`Postmark ${resp.status}: ${await resp.text()}`);
    }
  },

  resend: {
    required: ['RESEND_API_KEY'],
    async send(from, to, subject, html, text) {
      const key = process.env.RESEND_API_KEY;

      const body = { from, to, subject };
      if (html) body.html = html;
      if (text) body.text = text;

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
    }
  }
};

function parseAddress(raw) {
  const match = raw.match(/^(.+)\s*<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { email: raw.trim() };
}

// Validate config
const provider = providers[PROVIDER];
if (!provider) {
  console.error(`Unknown provider: ${PROVIDER}. Supported: ${Object.keys(providers).join(', ')}`);
  process.exit(1);
}
for (const key of provider.required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key} (for ${PROVIDER} provider)`);
    process.exit(1);
  }
}

// SMTP server
const server = new SMTPServer({
  secure: false,
  authOptional: true,
  disabledCommands: ['STARTTLS'],
  onData(stream, session, callback) {
    simpleParser(stream, {}, async (err, parsed) => {
      if (err) {
        console.error('Parse error:', err.message);
        return callback(err);
      }

      try {
        const fromAddr = parsed.from?.value?.[0]?.address;
        const fromName = parsed.from?.value?.[0]?.name;
        const from = fromAddr
          ? (fromName ? `${fromName} <${fromAddr}>` : fromAddr)
          : (session.envelope?.mailFrom?.address || 'noreply@localhost');

        const to = parsed.to?.value?.map(a => a.address)
          || session.envelope?.rcptTo?.map(r => r.address)
          || [];
        const subject = parsed.subject || '(no subject)';
        const html = parsed.html || undefined;
        const text = parsed.text || undefined;

        console.log(`📨 ${from} → ${to.join(', ')} | ${subject}`);
        await provider.send(from, to, subject, html, text);
        console.log(`✅ Sent via ${PROVIDER}`);
        callback();
      } catch (e) {
        console.error(`❌ ${e.message}`);
        callback(e);
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`📬 SMTP relay listening on port ${PORT}`);
  console.log(`   Provider: ${PROVIDER}`);
});
