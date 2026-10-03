import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import multer from 'multer';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
function chooseDataDir() {
  if (process.env.JOB_HUNTER_DATA_DIR) return process.env.JOB_HUNTER_DATA_DIR;
  if (fs.existsSync('D:\\JobHunter')) return 'D:\\JobHunter';
  if (fs.existsSync('E:\\JobHunter')) return 'E:\\JobHunter';
  if (fs.existsSync('D:\\')) return 'D:\\JobHunter';
  if (fs.existsSync('E:\\')) return 'E:\\JobHunter';
  return path.join(process.env.USERPROFILE || process.cwd(), 'JobHunter');
}
const DATA_DIR = chooseDataDir();
const DB_PATH = path.join(DATA_DIR, 'job-hunter.db');
const RESUME_DIR = path.join(DATA_DIR, 'resumes');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || '';

if (!fs.existsSync('E:\\') && !process.env.JOB_HUNTER_DATA_DIR) {
  console.error('E: drive was not found. Set JOB_HUNTER_DATA_DIR if you want a different storage location.');
  process.exit(1);
}

fs.mkdirSync(RESUME_DIR, { recursive: true });

function loadOrCreateConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (parsed.accessKey) return parsed;
    } catch {}
  }
  const config = {
    accessKey: crypto.randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
    dataDir: DATA_DIR,
    databasePath: DB_PATH,
    resumeDir: RESUME_DIR
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  return config;
}

const config = loadOrCreateConfig();
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    salary TEXT,
    salary_min INTEGER,
    posted TEXT,
    source TEXT,
    url TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT '',
    ollama_score INTEGER,
    ollama_verdict TEXT,
    ollama_strengths TEXT,
    ollama_gaps TEXT,
    ollama_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    mime_type TEXT,
    extracted_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const defaultProfile = {
  roles: 'QA Manager, Quality Analyst, Customer Service QA, Operations Analyst, React Developer',
  location: 'Florida / Remote',
  minSalary: 70000,
  resume: '',
  resumeFile: ''
};

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, JSON.stringify(value));
}

function cleanText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function salaryNumber(text = '') {
  const matches = String(text).replace(/,/g, '').match(/\$?\s?(\d{2,3}(?:\.\d+)?)(?:k|000)?/ig) || [];
  if (!matches.length) return null;
  const n = Number(matches[0].replace(/[$,\s]/g, '').replace(/k/i, ''));
  if (!Number.isFinite(n)) return null;
  return n < 1000 ? Math.round(n * 1000) : Math.round(n);
}

async function fetchJson(url, timeoutMs = 12000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'user-agent': 'JobHunterJunior/0.3',
        ...(options.headers || {})
      }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function mapJobRow(row) {
  return {
    id: row.id,
    title: row.title,
    company: row.company || '',
    location: row.location || '',
    salary: row.salary || '',
    salaryMin: row.salary_min ?? null,
    posted: row.posted || '',
    source: row.source || '',
    url: row.url || '',
    description: row.description || '',
    status: row.status || '',
    ollamaScore: row.ollama_score ?? null,
    ollamaVerdict: row.ollama_verdict || '',
    ollamaStrengths: row.ollama_strengths ? JSON.parse(row.ollama_strengths) : null,
    ollamaGaps: row.ollama_gaps ? JSON.parse(row.ollama_gaps) : null,
    ollamaReason: row.ollama_reason || ''
  };
}

function saveJobs(jobs) {
  const stmt = db.prepare(`
    INSERT INTO jobs (
      id,title,company,location,salary,salary_min,posted,source,url,description,updated_at
    ) VALUES (
      @id,@title,@company,@location,@salary,@salaryMin,@posted,@source,@url,@description,CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      company=excluded.company,
      location=excluded.location,
      salary=excluded.salary,
      salary_min=excluded.salary_min,
      posted=excluded.posted,
      source=excluded.source,
      url=excluded.url,
      description=excluded.description,
      updated_at=CURRENT_TIMESTAMP
  `);
  const tx = db.transaction((rows) => {
    for (const job of rows) stmt.run(job);
  });
  tx(jobs);
}

async function remotiveSearch(query) {
  const data = await fetchJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`);
  return (data.jobs || []).slice(0, 50).map((j) => ({
    id: `remotive-${j.id}`,
    title: j.title || 'Untitled role',
    company: j.company_name || '',
    location: j.candidate_required_location || 'Remote',
    salary: j.salary || '',
    salaryMin: salaryNumber(j.salary),
    posted: j.publication_date ? new Date(j.publication_date).toLocaleDateString() : '',
    source: 'Remotive',
    url: j.url || '',
    description: cleanText(j.description)
  }));
}

async function arbeitnowSearch(query) {
  const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api');
  const parts = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (data.data || [])
    .filter((j) => {
      const hay = `${j.title} ${j.description || ''} ${(j.tags || []).join(' ')}`.toLowerCase();
      return parts.some((part) => hay.includes(part));
    })
    .slice(0, 50)
    .map((j) => ({
      id: `arbeitnow-${j.slug || crypto.createHash('sha1').update(j.url || j.title).digest('hex')}`,
      title: j.title || 'Untitled role',
      company: j.company_name || '',
      location: j.location || (j.remote ? 'Remote' : ''),
      salary: '',
      salaryMin: null,
      posted: j.created_at ? new Date(Number(j.created_at) * 1000).toLocaleDateString() : '',
      source: 'Arbeitnow',
      url: j.url || '',
      description: cleanText(j.description)
    }));
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.title}|${job.company}|${job.location}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ollamaInfo() {
  try {
    const data = await fetchJson(`${OLLAMA_URL}/api/tags`, 3500);
    const models = (data.models || []).map((m) => m.name).filter(Boolean);
    const model = OLLAMA_MODEL || models[0] || '';
    return { online: true, model, models };
  } catch {
    return { online: false, model: OLLAMA_MODEL || '', models: [] };
  }
}

async function ollamaAnalyze(job, profile) {
  const info = await ollamaInfo();
  if (!info.online) throw new Error('Ollama is not running on this PC.');
  if (!info.model) throw new Error('Ollama is running but no model is installed.');

  const resume = String(profile.resume || '').slice(0, 18000);
  const description = String(job.description || '').slice(0, 12000);
  const prompt = `You are a strict job-fit evaluator. Use only facts present in the candidate profile/resume and the job posting. Never invent experience.

Return ONLY valid JSON with this exact shape:
{"score":0,"verdict":"","strengths":[],"gaps":[],"reason":""}

Rules:
- score: integer 0-100
- verdict: one of "Strong match", "Worth reviewing", "Lower priority"
- strengths: up to 6 short phrases supported by both the candidate and job
- gaps: up to 5 real requirements not clearly supported by the candidate
- reason: max 2 short sentences
- Do not treat missing evidence as experience.

Candidate target roles: ${profile.roles || ''}
Candidate preferred location: ${profile.location || ''}
Candidate minimum salary: ${profile.minSalary || ''}
Candidate resume:
${resume}

Job:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Salary: ${job.salary}
Description:
${description}`;

  const data = await fetchJson(`${OLLAMA_URL}/api/generate`, 120000, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: info.model,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 }
    })
  });

  let parsed;
  try {
    parsed = JSON.parse(data.response || '{}');
  } catch {
    throw new Error('Ollama returned invalid JSON.');
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  const verdict = ['Strong match','Worth reviewing','Lower priority'].includes(parsed.verdict)
    ? parsed.verdict
    : score >= 80 ? 'Strong match' : score >= 65 ? 'Worth reviewing' : 'Lower priority';

  return {
    model: info.model,
    analysis: {
      ollamaScore: score,
      ollamaVerdict: verdict,
      ollamaStrengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6).map(String) : [],
      ollamaGaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 5).map(String) : [],
      ollamaReason: String(parsed.reason || '').slice(0, 600)
    }
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

const allowedOrigins = new Set([
  'http://localhost:5180',
  'http://127.0.0.1:5180',
  'https://job-hunter-junior.netlify.app'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+--job-hunter-junior\.netlify\.app$/i.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by Job Hunter CORS policy.'));
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-JobHunter-Key'],
  maxAge: 86400
}));

app.use(express.json({ limit: '4mb' }));

app.use('/api', (req, res, next) => {
  const supplied = String(req.headers['x-jobhunter-key'] || '');
  const expected = String(config.accessKey || '');
  if (!supplied || supplied.length !== expected.length) {
    return res.status(401).json({ error: 'Invalid private access key.' });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: 'Invalid private access key.' });
  next();
});

app.get('/api/health', async (_req, res) => {
  const ollama = await ollamaInfo();
  res.json({
    ok: true,
    databasePath: DB_PATH,
    resumeDir: RESUME_DIR,
    ollamaOnline: ollama.online,
    ollamaModel: ollama.model,
    ollamaModels: ollama.models,
    paidApiRequired: false
  });
});

app.get('/api/state', (_req, res) => {
  const profile = getSetting('profile', defaultProfile);
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 500').all().map(mapJobRow);
  res.json({ profile, jobs });
});

app.put('/api/profile', (req, res) => {
  const current = getSetting('profile', defaultProfile);
  const next = {
    ...current,
    roles: String(req.body?.roles ?? current.roles ?? ''),
    location: String(req.body?.location ?? current.location ?? ''),
    minSalary: Number(req.body?.minSalary ?? current.minSalary ?? 0),
    resume: String(req.body?.resume ?? current.resume ?? ''),
    resumeFile: String(req.body?.resumeFile ?? current.resumeFile ?? '')
  };
  setSetting('profile', next);
  res.json({ ok: true, profile: next });
});

app.post('/api/resume', upload.single('cv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CV file received.' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.pdf','.docx','.txt'].includes(ext)) {
    return res.status(400).json({ error: 'Use a PDF, DOCX, or TXT CV.' });
  }

  const safeBase = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._ -]/g, '_');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storedName = `${stamp}-${safeBase}`;
  const storedPath = path.join(RESUME_DIR, storedName);
  fs.writeFileSync(storedPath, req.file.buffer);

  let text = '';
  if (ext === '.pdf') {
    const parsed = await pdf(req.file.buffer);
    text = parsed.text || '';
  } else if (ext === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer: req.file.buffer });
    text = parsed.value || '';
  } else {
    text = req.file.buffer.toString('utf8');
  }
  text = cleanText(text);

  db.prepare('INSERT INTO resumes (file_name, stored_path, mime_type, extracted_text) VALUES (?, ?, ?, ?)')
    .run(req.file.originalname, storedPath, req.file.mimetype || '', text);

  const profile = getSetting('profile', defaultProfile);
  const nextProfile = { ...profile, resume: text, resumeFile: req.file.originalname };
  setSetting('profile', nextProfile);

  res.json({
    ok: true,
    fileName: req.file.originalname,
    storedPath,
    text
  });
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const location = String(req.query.location || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: 'Missing search query.' });

  const settled = await Promise.allSettled([remotiveSearch(q), arbeitnowSearch(q)]);
  const sources = [];
  let jobs = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      jobs.push(...result.value);
      sources.push(index === 0 ? 'Remotive' : 'Arbeitnow');
    }
  });

  if (location) {
    if (location === 'remote') {
      jobs = jobs.filter((job) => /remote/i.test(job.location) || /remote/i.test(job.description));
    } else {
      jobs = jobs.filter((job) =>
        `${job.location} ${job.description}`.toLowerCase().includes(location) ||
        /remote/i.test(job.location)
      );
    }
  }

  jobs = dedupe(jobs).slice(0, 100);
  saveJobs(jobs);

  const ids = jobs.map((j) => j.id);
  const stored = ids.length
    ? db.prepare(`SELECT * FROM jobs WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(mapJobRow)
    : [];

  res.json({ jobs: stored, sources, freeSourcesOnly: true });
});

app.put('/api/jobs/:id/status', (req, res) => {
  const id = req.params.id;
  const current = db.prepare('SELECT status FROM jobs WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Job not found.' });
  const requested = ['saved','applied','ignored'].includes(req.body?.status) ? req.body.status : '';
  const next = current.status === requested ? '' : requested;
  db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(next, id);
  res.json({ ok: true, status: next });
});

app.post('/api/jobs/:id/analyze', async (req, res) => {
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Job not found.' });

  const profile = getSetting('profile', defaultProfile);
  if (!profile.resume) return res.status(400).json({ error: 'Upload or paste your CV before running Ollama analysis.' });

  const job = mapJobRow(row);
  const result = await ollamaAnalyze(job, profile);

  db.prepare(`
    UPDATE jobs SET
      ollama_score = ?,
      ollama_verdict = ?,
      ollama_strengths = ?,
      ollama_gaps = ?,
      ollama_reason = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    result.analysis.ollamaScore,
    result.analysis.ollamaVerdict,
    JSON.stringify(result.analysis.ollamaStrengths),
    JSON.stringify(result.analysis.ollamaGaps),
    result.analysis.ollamaReason,
    job.id
  );

  res.json(result);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err?.message || 'Server error.' });
});

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('Job Hunter Junior backend is running.');
  console.log(`API: http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`CV storage: ${RESUME_DIR}`);
  console.log(`Private key file: ${CONFIG_PATH}`);
  console.log(`Ollama: ${OLLAMA_URL}`);
  console.log('');
});
