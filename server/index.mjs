import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8788;

function cleanText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function salaryNumber(text = '') {
  const nums = String(text).replace(/,/g, '').match(/\$?\s?(\d{2,3}(?:\.\d+)?)(?:k|000)?/ig) || [];
  if (!nums.length) return null;
  const n = Number(nums[0].replace(/[$,\s]/g, '').replace(/k/i, ''));
  if (!Number.isFinite(n)) return null;
  return n < 1000 ? Math.round(n * 1000) : Math.round(n);
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'JobHunterJunior/0.1' } });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function remotiveSearch(query) {
  const data = await fetchJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`);
  return (data.jobs || []).slice(0, 35).map((j) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || 'Remote',
    salary: j.salary || '',
    salaryMin: salaryNumber(j.salary),
    posted: j.publication_date ? new Date(j.publication_date).toLocaleDateString() : '',
    source: 'Remotive',
    url: j.url,
    description: cleanText(j.description),
  }));
}

async function arbeitnowSearch(query) {
  const first = await fetchJson('https://www.arbeitnow.com/api/job-board-api');
  const q = query.toLowerCase();
  return (first.data || [])
    .filter((j) => `${j.title} ${j.description || ''} ${(j.tags || []).join(' ')}`.toLowerCase().includes(q))
    .slice(0, 35)
    .map((j) => ({
      id: `arbeitnow-${j.slug || j.url}`,
      title: j.title,
      company: j.company_name,
      location: j.location || (j.remote ? 'Remote' : ''),
      salary: '',
      salaryMin: null,
      posted: j.created_at ? new Date(Number(j.created_at) * 1000).toLocaleDateString() : '',
      source: 'Arbeitnow',
      url: j.url,
      description: cleanText(j.description),
    }));
}

function dedupe(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.title}|${job.company}`.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

app.get('/api/health', (_, res) => res.json({ ok: true, paidApiRequired: false }));

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const location = String(req.query.location || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ error: 'Missing q' });

  const settled = await Promise.allSettled([remotiveSearch(q), arbeitnowSearch(q)]);
  const sourceNames = [];
  let jobs = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      jobs.push(...result.value);
      sourceNames.push(index === 0 ? 'Remotive' : 'Arbeitnow');
    }
  });

  if (location && location !== 'remote') {
    jobs = jobs.filter((job) => `${job.location} ${job.description}`.toLowerCase().includes(location) || /remote/i.test(job.location));
  } else if (location === 'remote') {
    jobs = jobs.filter((job) => /remote/i.test(job.location) || /remote/i.test(job.description));
  }

  jobs = dedupe(jobs).slice(0, 60);
  res.json({ jobs, sources: sourceNames, freeSourcesOnly: true });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Job Hunter Junior server: http://127.0.0.1:${PORT}`);
});
