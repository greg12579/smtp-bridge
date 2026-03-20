const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const FormData = require('form-data');

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net/v3';
const PORT = parseInt(process.env.PORT || '2525', 10);

if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
  console.error('MAILGUN_API_KEY and MAILGUN_DOMAIN are required');
  process.exit(1);
}

async function sendViaMailgun(from, to, subject, html, text) {
  const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;
  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');

  // Use URLSearchParams instead of FormData for compatibility with Node fetch
  const params = new URLSearchParams();
  params.append('from', from);
  to.forEach(addr => params.append('to', addr));
  params.append('subject', subject || '(no subject)');
  if (html) params.append('html', html);
  if (text) params.append('text', text);

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const body = await resp.text();
  if (!resp.ok) {
    throw new Error(`Mailgun ${resp.status}: ${body}`);
  }
  console.log(`✅ Sent to ${to.join(', ')} — ${subject}`);
  return body;
}

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
        // Get from address from parsed email or SMTP envelope
        const fromAddr = parsed.from?.value?.[0]?.address;
        const fromName = parsed.from?.value?.[0]?.name;
        const from = fromAddr 
          ? (fromName ? `${fromName} <${fromAddr}>` : fromAddr)
          : (session.envelope?.mailFrom?.address || `noreply@${MAILGUN_DOMAIN}`);
        
        const to = parsed.to?.value?.map(a => a.address) 
          || session.envelope?.rcptTo?.map(r => r.address) 
          || [];
        const subject = parsed.subject;
        const html = parsed.html || undefined;
        const text = parsed.text || undefined;

        console.log(`📨 Received: from=${from} to=${to.join(',')} subject=${subject}`);
        await sendViaMailgun(from, to, subject, html, text);
        callback();
      } catch (e) {
        console.error('Send error:', e.message);
        callback(e);
      }
    });
  }
});

server.listen(PORT, () => {
  console.log(`📬 Mail bridge listening on port ${PORT}`);
  console.log(`   Forwarding to Mailgun HTTP API (${MAILGUN_DOMAIN})`);
});
