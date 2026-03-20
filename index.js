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
  const form = new FormData();
  form.append('from', from);
  to.forEach(addr => form.append('to', addr));
  form.append('subject', subject || '(no subject)');
  if (html) form.append('html', html);
  if (text) form.append('text', text);

  const url = `${MAILGUN_BASE_URL}/${MAILGUN_DOMAIN}/messages`;
  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64');

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}` },
    body: form
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
        const from = parsed.from?.text || `noreply@${MAILGUN_DOMAIN}`;
        const to = parsed.to?.value?.map(a => a.address) || [];
        const subject = parsed.subject;
        const html = parsed.html || undefined;
        const text = parsed.text || undefined;

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
