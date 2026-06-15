const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const PRACTITIONERS_FILE = path.join(DATA_DIR, 'practitioners.json');
const ORGANIZATIONS_FILE = path.join(DATA_DIR, 'organizations.json');
const SENT_FILE = path.join(DATA_DIR, 'sent.json');
const MARKETING_FILE = path.join(DATA_DIR, 'marketing.json');
const TEAM_FILE = path.join(DATA_DIR, 'team.json');
const IDEAS_FILE = path.join(DATA_DIR, 'ideas.json');
const GOALS_FILE = path.join(DATA_DIR, 'goals.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// On first boot with a volume, copy seed data if files don't exist yet
const SEED_DIR = path.join(__dirname, 'seeds');
const DATA_FILES = ['practitioners.json', 'organizations.json', 'sent.json', 'marketing.json', 'team.json', 'ideas.json'];
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
DATA_FILES.forEach(file => {
  const dest = path.join(DATA_DIR, file);
  const seed = path.join(SEED_DIR, file);
  if (!fs.existsSync(dest) && fs.existsSync(seed)) {
    fs.copyFileSync(seed, dest);
    console.log(`Seeded ${file} to volume`);
  }
});

function readJSON(filePath, defaultValue = []) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// --- Practitioners ---

app.get('/api/practitioners', (req, res) => {
  res.json(readJSON(PRACTITIONERS_FILE));
});

app.post('/api/practitioners', (req, res) => {
  const data = readJSON(PRACTITIONERS_FILE);
  const entry = { id: 'p' + Date.now(), log: [], ...req.body };
  data.push(entry);
  writeJSON(PRACTITIONERS_FILE, data);
  res.json(entry);
});

app.put('/api/practitioners/:id', (req, res) => {
  const data = readJSON(PRACTITIONERS_FILE);
  const idx = data.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeJSON(PRACTITIONERS_FILE, data);
  res.json(data[idx]);
});

app.delete('/api/practitioners/:id', (req, res) => {
  const data = readJSON(PRACTITIONERS_FILE);
  const filtered = data.filter(p => p.id !== req.params.id);
  writeJSON(PRACTITIONERS_FILE, filtered);
  res.json({ ok: true });
});

app.post('/api/practitioners/:id/log', (req, res) => {
  const data = readJSON(PRACTITIONERS_FILE);
  const idx = data.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const entry = {
    id: Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note,
    author: 'Craig',
    createdAt: new Date().toISOString()
  };
  data[idx].log.unshift(entry);
  writeJSON(PRACTITIONERS_FILE, data);
  res.json(entry);
});

app.delete('/api/practitioners/:id/log/:logId', (req, res) => {
  const data = readJSON(PRACTITIONERS_FILE);
  const idx = data.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx].log = data[idx].log.filter(e => String(e.id) !== req.params.logId);
  writeJSON(PRACTITIONERS_FILE, data);
  res.json({ ok: true });
});

// --- Organizations ---

app.get('/api/organizations', (req, res) => {
  res.json(readJSON(ORGANIZATIONS_FILE));
});

app.post('/api/organizations', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const entry = { id: 'o' + Date.now(), log: [], ...req.body };
  data.push(entry);
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json(entry);
});

app.put('/api/organizations/:id', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json(data[idx]);
});

app.delete('/api/organizations/:id', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const filtered = data.filter(o => o.id !== req.params.id);
  writeJSON(ORGANIZATIONS_FILE, filtered);
  res.json({ ok: true });
});

app.post('/api/organizations/:id/log', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const entry = {
    id: Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note,
    author: 'Craig',
    createdAt: new Date().toISOString()
  };
  data[idx].log.unshift(entry);
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json(entry);
});

app.delete('/api/organizations/:id/log/:logId', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx].log = data[idx].log.filter(e => String(e.id) !== req.params.logId);
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json({ ok: true });
});

// --- Org Contacts ---

app.post('/api/organizations/:id/contacts', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const contact = { id: 'c_' + Date.now(), log: [], ...req.body };
  if (!data[idx].contacts) data[idx].contacts = [];
  data[idx].contacts.push(contact);
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json(contact);
});

app.put('/api/organizations/:id/contacts/:contactId', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const ci = (data[idx].contacts || []).findIndex(c => c.id === req.params.contactId);
  if (ci === -1) return res.status(404).json({ error: 'Contact not found' });
  data[idx].contacts[ci] = { ...data[idx].contacts[ci], ...req.body };
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json(data[idx].contacts[ci]);
});

app.delete('/api/organizations/:id/contacts/:contactId', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx].contacts = (data[idx].contacts || []).filter(c => c.id !== req.params.contactId);
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json({ ok: true });
});

app.post('/api/organizations/:id/contacts/:contactId/log', (req, res) => {
  const data = readJSON(ORGANIZATIONS_FILE);
  const idx = data.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const ci = (data[idx].contacts || []).findIndex(c => c.id === req.params.contactId);
  if (ci === -1) return res.status(404).json({ error: 'Contact not found' });
  const entry = {
    id: Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note,
    author: 'Craig',
    createdAt: new Date().toISOString()
  };
  data[idx].contacts[ci].log.unshift(entry);
  writeJSON(ORGANIZATIONS_FILE, data);
  res.json(entry);
});

// --- Sent Emails ---

app.get('/api/sent', (req, res) => {
  res.json(readJSON(SENT_FILE));
});

app.post('/api/sent', (req, res) => {
  const data = readJSON(SENT_FILE);
  const entry = { id: 's' + Date.now(), createdAt: new Date().toISOString(), ...req.body };
  data.unshift(entry);
  writeJSON(SENT_FILE, data);
  res.json(entry);
});

app.put('/api/sent/:id', (req, res) => {
  const data = readJSON(SENT_FILE);
  const idx = data.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeJSON(SENT_FILE, data);
  res.json(data[idx]);
});

app.delete('/api/sent/:id', (req, res) => {
  const data = readJSON(SENT_FILE);
  const filtered = data.filter(s => s.id !== req.params.id);
  writeJSON(SENT_FILE, filtered);
  res.json({ ok: true });
});

// --- Marketing Hire ---

app.get('/api/marketing', (req, res) => {
  res.json(readJSON(MARKETING_FILE));
});

app.post('/api/marketing', (req, res) => {
  const data = readJSON(MARKETING_FILE);
  const entry = { id: 'm' + Date.now(), log: [], ...req.body };
  data.push(entry);
  writeJSON(MARKETING_FILE, data);
  res.json(entry);
});

app.put('/api/marketing/:id', (req, res) => {
  const data = readJSON(MARKETING_FILE);
  const idx = data.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeJSON(MARKETING_FILE, data);
  res.json(data[idx]);
});

app.delete('/api/marketing/:id', (req, res) => {
  const data = readJSON(MARKETING_FILE);
  const filtered = data.filter(m => m.id !== req.params.id);
  writeJSON(MARKETING_FILE, filtered);
  res.json({ ok: true });
});

app.post('/api/marketing/:id/log', (req, res) => {
  const data = readJSON(MARKETING_FILE);
  const idx = data.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const entry = {
    id: Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note,
    author: 'Craig',
    createdAt: new Date().toISOString()
  };
  data[idx].log.unshift(entry);
  writeJSON(MARKETING_FILE, data);
  res.json(entry);
});

app.delete('/api/marketing/:id/log/:logId', (req, res) => {
  const data = readJSON(MARKETING_FILE);
  const idx = data.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx].log = data[idx].log.filter(e => String(e.id) !== req.params.logId);
  writeJSON(MARKETING_FILE, data);
  res.json({ ok: true });
});

// --- Team ---

app.get('/api/team', (req, res) => {
  res.json(readJSON(TEAM_FILE));
});

app.post('/api/team', (req, res) => {
  const data = readJSON(TEAM_FILE);
  const entry = { id: 't' + Date.now(), log: [], ...req.body };
  data.push(entry);
  writeJSON(TEAM_FILE, data);
  res.json(entry);
});

app.put('/api/team/:id', (req, res) => {
  const data = readJSON(TEAM_FILE);
  const idx = data.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeJSON(TEAM_FILE, data);
  res.json(data[idx]);
});

app.delete('/api/team/:id', (req, res) => {
  const data = readJSON(TEAM_FILE);
  const filtered = data.filter(t => t.id !== req.params.id);
  writeJSON(TEAM_FILE, filtered);
  res.json({ ok: true });
});

app.post('/api/team/:id/log', (req, res) => {
  const data = readJSON(TEAM_FILE);
  const idx = data.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const entry = {
    id: Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note,
    author: 'Craig',
    createdAt: new Date().toISOString()
  };
  data[idx].log.unshift(entry);
  writeJSON(TEAM_FILE, data);
  res.json(entry);
});

app.delete('/api/team/:id/log/:logId', (req, res) => {
  const data = readJSON(TEAM_FILE);
  const idx = data.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx].log = data[idx].log.filter(e => String(e.id) !== req.params.logId);
  writeJSON(TEAM_FILE, data);
  res.json({ ok: true });
});

// --- Ideas ---

app.get('/api/ideas', (req, res) => {
  res.json(readJSON(IDEAS_FILE));
});

app.post('/api/ideas', (req, res) => {
  const data = readJSON(IDEAS_FILE);
  const entry = { id: 'i' + Date.now(), log: [], createdAt: new Date().toISOString().split('T')[0], ...req.body };
  data.push(entry);
  writeJSON(IDEAS_FILE, data);
  res.json(entry);
});

app.put('/api/ideas/:id', (req, res) => {
  const data = readJSON(IDEAS_FILE);
  const idx = data.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx] = { ...data[idx], ...req.body };
  writeJSON(IDEAS_FILE, data);
  res.json(data[idx]);
});

app.delete('/api/ideas/:id', (req, res) => {
  const data = readJSON(IDEAS_FILE);
  const filtered = data.filter(i => i.id !== req.params.id);
  writeJSON(IDEAS_FILE, filtered);
  res.json({ ok: true });
});

app.post('/api/ideas/:id/log', (req, res) => {
  const data = readJSON(IDEAS_FILE);
  const idx = data.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const entry = {
    id: Date.now(),
    date: req.body.date || new Date().toISOString().split('T')[0],
    note: req.body.note,
    author: req.body.author || 'Craig',
    createdAt: new Date().toISOString()
  };
  data[idx].log.unshift(entry);
  writeJSON(IDEAS_FILE, data);
  res.json(entry);
});

app.delete('/api/ideas/:id/log/:logId', (req, res) => {
  const data = readJSON(IDEAS_FILE);
  const idx = data.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data[idx].log = data[idx].log.filter(e => String(e.id) !== req.params.logId);
  writeJSON(IDEAS_FILE, data);
  res.json({ ok: true });
});

// --- Goals ---

app.get('/api/goals', (req, res) => {
  res.json(readJSON(GOALS_FILE, { weekly_target: 15 }));
});

app.put('/api/goals', (req, res) => {
  const current = readJSON(GOALS_FILE, { weekly_target: 15 });
  const updated = { ...current, ...req.body };
  writeJSON(GOALS_FILE, updated);
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`SessionCraft Outreach running at http://localhost:${PORT}`);
});
