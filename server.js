const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DB = path.join(__dirname, 'data.json');
const seed = [
  { id: 'c1', name: 'Example Star One', bio: 'Actor and producer. Replace me in the admin page.', image: '', managerEmail: 'manager1@example.com' },
  { id: 'c2', name: 'Example Star Two', bio: 'Singer and songwriter. Replace me in the admin page.', image: '', managerEmail: 'manager2@example.com' }
];
function load() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch { return { celebrities: seed, requests: [] }; }
}
function save(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---- Public API (never exposes manager emails) ----
app.get('/api/celebrities', (req, res) => {
  res.json(load().celebrities.map(({ id, name, bio, image }) => ({ id, name, bio, image })));
});

const hits = new Map();
app.post('/api/requests', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const recent = (hits.get(ip) || []).filter(t => Date.now() - t < 3600000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many requests. Try again in an hour.' });
  hits.set(ip, [...recent, Date.now()]);

  const { celebrityId, name, email, message } = req.body || {};
  if (!name || !validEmail(email || '') || !message) return res.status(400).json({ error: 'Enter your name, a valid email, and a message.' });
  const db = load();
  const celeb = db.celebrities.find(c => c.id === celebrityId);
  if (!celeb) return res.status(404).json({ error: 'Celebrity not found.' });

  const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), celebrity: celeb.name,
    fanName: String(name).slice(0, 100), fanEmail: email, message: String(message).slice(0, 2000), emailed: false };

  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
          to: [celeb.managerEmail],
          reply_to: email,
          subject: `Meet & greet request for ${celeb.name}`,
          html: `<p><b>${esc(entry.fanName)}</b> (${esc(email)}) would like to meet ${esc(celeb.name)}.</p><p>${esc(entry.message).replace(/\n/g, '<br>')}</p><p>Reply to this email to reach the fan.</p>`
        })
      });
      entry.emailed = r.ok;
      if (!r.ok) console.error('Resend error:', await r.text());
    } catch (e) { console.error('Email failed:', e.message); }
  } else console.log('RESEND_API_KEY not set; request saved but not emailed.');

  db.requests.unshift(entry);
  save(db);
  res.json({ ok: true });
});

// ---- Admin API (password in ADMIN_PASSWORD env var) ----
function admin(req, res, next) {
  const pw = process.env.ADMIN_PASSWORD || '';
  const given = String(req.headers['x-admin-password'] || '');
  const a = Buffer.from(pw), b = Buffer.from(given);
  if (!pw || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Wrong password.' });
  next();
}
app.get('/api/admin/data', admin, (req, res) => res.json(load()));
app.post('/api/admin/celebrities', admin, (req, res) => {
  const { name, bio, image, managerEmail } = req.body || {};
  if (!name || !validEmail(managerEmail || '')) return res.status(400).json({ error: 'Name and a valid manager email are required.' });
  const db = load();
  db.celebrities.push({ id: crypto.randomUUID(), name, bio: bio || '', image: image || '', managerEmail });
  save(db);
  res.json({ ok: true });
});
app.delete('/api/admin/celebrities/:id', admin, (req, res) => {
  const db = load();
  db.celebrities = db.celebrities.filter(c => c.id !== req.params.id);
  save(db);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
