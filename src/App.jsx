import React, { useEffect, useMemo, useState } from 'react';

const starterProfile = {
  roles: 'QA Manager, Quality Analyst, Customer Service QA, Operations Analyst, React Developer',
  location: 'Florida / Remote',
  minSalary: 70000,
  resume: '',
};

const starterJobs = [
  {
    id: 'demo-1',
    title: 'Senior Quality Assurance Analyst',
    company: 'Example Hospitality Group',
    location: 'Remote - United States',
    salary: '$85,000 - $105,000',
    salaryMin: 85000,
    posted: 'Demo role',
    source: 'Demo',
    url: '#',
    description: 'Quality assurance, customer service, operations analysis, coaching, reporting, contact center performance, and process improvement.',
  },
  {
    id: 'demo-2',
    title: 'Customer Experience QA Manager',
    company: 'Example Travel Co.',
    location: 'Florida / Hybrid',
    salary: '$95,000 - $115,000',
    salaryMin: 95000,
    posted: 'Demo role',
    source: 'Demo',
    url: '#',
    description: 'Lead quality programs for a customer service organization. Build scorecards, coach teams, analyze calls, identify trends, and improve customer experience.',
  },
  {
    id: 'demo-3',
    title: 'React Frontend Developer',
    company: 'Example Software',
    location: 'Remote',
    salary: '$100,000 - $125,000',
    salaryMin: 100000,
    posted: 'Demo role',
    source: 'Demo',
    url: '#',
    description: 'Build React interfaces with JavaScript, CSS, APIs, testing, accessibility, responsive design, and modern frontend engineering practices.',
  },
];

const commonStopWords = new Set([
  'and','the','with','for','from','this','that','your','you','our','are','will','have','has','job','role','work','team','years','year','using','into','who','all','but','not','can','skills','experience','required','preferred'
]);

function tokens(text = '') {
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9+#. -]/g, ' ')
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 2 && !commonStopWords.has(x))
  )];
}

function scoreJob(job, profile) {
  const profileText = `${profile.roles} ${profile.location} ${profile.resume}`;
  const profileTokens = new Set(tokens(profileText));
  const jobTokens = tokens(`${job.title} ${job.description || ''} ${job.location || ''}`);
  const matched = jobTokens.filter((token) => profileTokens.has(token));
  const missing = jobTokens.filter((token) => !profileTokens.has(token)).slice(0, 5);
  const roleTerms = tokens(profile.roles);
  const titleTokens = new Set(tokens(job.title));
  const titleMatches = roleTerms.filter((term) => titleTokens.has(term)).length;
  const remoteBoost = /remote/i.test(profile.location) && /remote/i.test(job.location || '') ? 8 : 0;
  const salaryBoost = job.salaryMin && Number(profile.minSalary) && job.salaryMin >= Number(profile.minSalary) ? 8 : 0;
  const base = jobTokens.length ? Math.round((matched.length / Math.min(jobTokens.length, 28)) * 72) : 0;
  const titleBoost = Math.min(18, titleMatches * 6);
  const score = Math.max(28, Math.min(99, base + titleBoost + remoteBoost + salaryBoost));
  return {
    score,
    matched: matched.slice(0, 6),
    missing,
    verdict: score >= 80 ? 'Strong match' : score >= 65 ? 'Worth reviewing' : 'Lower priority',
  };
}

const Icon = ({ name, size = 18 }) => {
  const icons = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    x: <path d="m6 6 12 12M18 6 6 18"/>,
    external: <><path d="M14 4h6v6"/><path d="m10 14 10-10"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    spark: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.4 6L20 11M4 13l1.6 5A7 7 0 0 0 17.9 16"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
};

export default function App() {
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jh-profile')) || starterProfile; } catch { return starterProfile; }
  });
  const [jobs, setJobs] = useState(starterJobs);
  const [query, setQuery] = useState('QA Manager');
  const [location, setLocation] = useState('Remote');
  const [status, setStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('jh-status')) || {}; } catch { return {}; }
  });
  const [tab, setTab] = useState('Best Matches');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Ready. No paid API key required.');
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => localStorage.setItem('jh-profile', JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem('jh-status', JSON.stringify(status)), [status]);

  const scoredJobs = useMemo(() => jobs.map((job) => ({ ...job, ...scoreJob(job, profile) }))
    .sort((a, b) => b.score - a.score), [jobs, profile]);

  const visibleJobs = useMemo(() => {
    if (tab === 'Saved') return scoredJobs.filter((j) => status[j.id] === 'saved');
    if (tab === 'Applied') return scoredJobs.filter((j) => status[j.id] === 'applied');
    if (tab === 'Ignored') return scoredJobs.filter((j) => status[j.id] === 'ignored');
    return scoredJobs.filter((j) => status[j.id] !== 'ignored');
  }, [scoredJobs, tab, status]);

  const stats = {
    total: scoredJobs.length,
    strong: scoredJobs.filter((j) => j.score >= 80).length,
    saved: Object.values(status).filter((v) => v === 'saved').length,
    applied: Object.values(status).filter((v) => v === 'applied').length,
  };

  async function searchJobs() {
    setLoading(true);
    setMessage('Searching free public sources...');
    try {
      const params = new URLSearchParams({ q: query, location });
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) throw new Error('Search server unavailable');
      const data = await res.json();
      if (Array.isArray(data.jobs) && data.jobs.length) {
        setJobs(data.jobs);
        setMessage(`Found ${data.jobs.length} jobs from ${data.sources?.join(', ') || 'free sources'}.`);
      } else {
        setMessage('No live results found. Keeping demo jobs so the dashboard stays usable.');
      }
    } catch {
      setMessage('Start the local server with npm run dev. Demo jobs remain available.');
    } finally {
      setLoading(false);
    }
  }

  function setJobStatus(id, value) {
    setStatus((prev) => ({ ...prev, [id]: prev[id] === value ? '' : value }));
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">JH</div>
          <div><strong>Job Hunter</strong><span>Junior</span></div>
        </div>

        <nav>
          {['Best Matches','Saved','Applied','Ignored'].map((item) => (
            <button key={item} className={tab === item ? 'nav-item active' : 'nav-item'} onClick={() => setTab(item)}>
              <Icon name={item === 'Saved' ? 'star' : item === 'Applied' ? 'check' : item === 'Ignored' ? 'x' : 'briefcase'} />
              {item}
              {item === 'Saved' && <b>{stats.saved}</b>}
              {item === 'Applied' && <b>{stats.applied}</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <Icon name="spark" />
          <div><strong>Local-first</strong><span>Your profile stays in this browser.</span></div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">FREE JOB SEARCH COMMAND CENTER</p>
            <h1>Find less. Match better. Apply faster.</h1>
            <p>Search free public sources, score every role against your profile, and keep the final decision in your hands.</p>
          </div>
          <button className="profile-button" onClick={() => setShowProfile(!showProfile)}><Icon name="user" /> My Profile</button>
        </header>

        {showProfile && (
          <section className="profile-panel">
            <div className="section-heading">
              <div><span className="kicker">PROFILE</span><h2>Teach Job Hunter what fits you</h2></div>
              <button className="text-button" onClick={() => setShowProfile(false)}>Close</button>
            </div>
            <div className="profile-grid">
              <label>Target roles<input value={profile.roles} onChange={(e) => setProfile({ ...profile, roles: e.target.value })} /></label>
              <label>Preferred location<input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></label>
              <label>Minimum salary<input type="number" value={profile.minSalary} onChange={(e) => setProfile({ ...profile, minSalary: e.target.value })} /></label>
            </div>
            <label>Resume / career profile<textarea rows="7" placeholder="Paste your resume text here. It stays in localStorage on this browser." value={profile.resume} onChange={(e) => setProfile({ ...profile, resume: e.target.value })} /></label>
          </section>
        )}

        <section className="search-panel">
          <div className="search-row">
            <div className="search-box"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Job title or skill" /></div>
            <input className="location-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location or Remote" />
            <button className="primary" onClick={searchJobs} disabled={loading}>{loading ? <Icon name="refresh" /> : <Icon name="search" />} {loading ? 'Searching' : 'Search jobs'}</button>
          </div>
          <p className="status-line">{message}</p>
        </section>

        <section className="stats">
          <article><span>Total roles</span><strong>{stats.total}</strong></article>
          <article><span>Strong matches</span><strong>{stats.strong}</strong></article>
          <article><span>Saved</span><strong>{stats.saved}</strong></article>
          <article><span>Applied</span><strong>{stats.applied}</strong></article>
        </section>

        <section className="results">
          <div className="section-heading">
            <div><span className="kicker">{tab.toUpperCase()}</span><h2>{visibleJobs.length} roles</h2></div>
            <div className="legend"><span className="dot strong"></span>80%+ strong match</div>
          </div>

          <div className="job-list">
            {visibleJobs.map((job) => (
              <article className="job-card" key={job.id}>
                <div className="score-ring"><strong>{job.score}%</strong><span>match</span></div>
                <div className="job-content">
                  <div className="job-topline">
                    <div>
                      <span className="source">{job.source}</span>
                      <h3>{job.title}</h3>
                      <p>{job.company} · {job.location}</p>
                    </div>
                    <span className={job.score >= 80 ? 'verdict strong' : job.score >= 65 ? 'verdict medium' : 'verdict low'}>{job.verdict}</span>
                  </div>

                  <div className="job-meta">
                    <span>{job.salary || 'Salary not listed'}</span>
                    <span>{job.posted || 'Recently listed'}</span>
                  </div>

                  <div className="match-grid">
                    <div><h4>Matches</h4><div className="chips">{job.matched.length ? job.matched.map((x) => <span className="chip good" key={x}>✓ {x}</span>) : <span className="muted">Add your resume for better scoring.</span>}</div></div>
                    <div><h4>Potential gaps</h4><div className="chips">{job.missing.slice(0,4).map((x) => <span className="chip gap" key={x}>{x}</span>)}</div></div>
                  </div>

                  <div className="actions">
                    <button className={status[job.id] === 'saved' ? 'small active-save' : 'small'} onClick={() => setJobStatus(job.id, 'saved')}><Icon name="star" /> Save</button>
                    <button className={status[job.id] === 'applied' ? 'small active-apply' : 'small'} onClick={() => setJobStatus(job.id, 'applied')}><Icon name="check" /> Applied</button>
                    <button className="small" onClick={() => setJobStatus(job.id, 'ignored')}><Icon name="x" /> Ignore</button>
                    {job.url && job.url !== '#' && <a className="open-job" href={job.url} target="_blank" rel="noreferrer">Open job <Icon name="external" /></a>}
                  </div>
                </div>
              </article>
            ))}
            {!visibleJobs.length && <div className="empty">Nothing here yet.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
