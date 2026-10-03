import React, { useEffect, useMemo, useState } from 'react';

const starterProfile = {
  roles: 'QA Manager, Quality Analyst, Customer Service QA, Operations Analyst, React Developer',
  location: 'Florida / Remote',
  minSalary: 70000,
  resume: '',
  resumeFile: ''
};

const demoJobs = [
  {id:'demo-1',title:'Senior Quality Assurance Analyst',company:'Example Hospitality Group',location:'Remote - United States',salary:'$85,000 - $105,000',salaryMin:85000,posted:'Demo role',source:'Demo',url:'#',description:'Quality assurance customer service operations analysis coaching reporting contact center performance process improvement.'},
  {id:'demo-2',title:'Customer Experience QA Manager',company:'Example Travel Co.',location:'Florida / Hybrid',salary:'$95,000 - $115,000',salaryMin:95000,posted:'Demo role',source:'Demo',url:'#',description:'Lead quality programs customer service scorecards coaching call analysis trends customer experience.'},
];

const stop = new Set(['and','the','with','for','from','this','that','your','you','our','are','will','have','has','job','role','work','team','years','year','using','into','who','all','but','not','can','skills','experience','required','preferred']);
const toks=(text='')=>[...new Set(text.toLowerCase().replace(/[^a-z0-9+#. -]/g,' ').split(/\s+/).map(x=>x.trim()).filter(x=>x.length>2&&!stop.has(x)))];

function localScore(job,profile){
  const p=new Set(toks(`${profile.roles} ${profile.location} ${profile.resume}`));
  const j=toks(`${job.title} ${job.description||''} ${job.location||''}`);
  const matched=j.filter(x=>p.has(x));
  const missing=j.filter(x=>!p.has(x)).slice(0,5);
  const titleSet=new Set(toks(job.title));
  const titleMatches=toks(profile.roles).filter(x=>titleSet.has(x)).length;
  const remoteBoost=/remote/i.test(profile.location)&&/remote/i.test(job.location||'')?8:0;
  const salaryBoost=job.salaryMin&&Number(profile.minSalary)&&job.salaryMin>=Number(profile.minSalary)?8:0;
  const base=j.length?Math.round((matched.length/Math.min(j.length,28))*72):0;
  const score=Math.max(28,Math.min(99,base+Math.min(18,titleMatches*6)+remoteBoost+salaryBoost));
  return {score,matched:matched.slice(0,6),missing,verdict:score>=80?'Strong match':score>=65?'Worth reviewing':'Lower priority'};
}

const Icon=({name,size=18})=>{
  const i={
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></>,
    briefcase:<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></>,
    star:<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
    check:<path d="m5 12 4 4L19 6"/>,x:<path d="m6 6 12 12M18 6 6 18"/>,
    external:<><path d="M14 4h6v6"/><path d="m10 14 10-10"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></>,
    user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    spark:<><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/></>,
    refresh:<><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.4 6L20 11M4 13l1.6 5A7 7 0 0 0 17.9 16"/></>,
    upload:<><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
    plug:<><path d="m8 12 8-8M14 4l6 6M4 14l6 6M8 16l-4 4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{i[name]}</svg>
};

export default function App(){
  const [backendUrl,setBackendUrl]=useState(()=>localStorage.getItem('jh-backend-url')||'');
  const [accessKey,setAccessKey]=useState(()=>sessionStorage.getItem('jh-access-key')||'');
  const [connected,setConnected]=useState(false);
  const [profile,setProfile]=useState(starterProfile);
  const [jobs,setJobs]=useState(demoJobs);
  const [query,setQuery]=useState('QA Manager');
  const [location,setLocation]=useState('Remote');
  const [tab,setTab]=useState('Best Matches');
  const [showProfile,setShowProfile]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Connect this Netlify frontend to your PC backend.');
  const [ollama,setOllama]=useState({online:false,model:''});

  const api=async(pathName,options={})=>{
    if(!backendUrl) throw new Error('Backend URL required');
    const url=`${backendUrl.replace(/\/$/,'')}${pathName}`;
    const headers={...(options.headers||{}),'x-jobhunter-key':accessKey};
    const res=await fetch(url,{...options,headers});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||`Request failed (${res.status})`);
    return data;
  };

  useEffect(()=>{ if(backendUrl) localStorage.setItem('jh-backend-url',backendUrl); },[backendUrl]);
  useEffect(()=>{ if(accessKey) sessionStorage.setItem('jh-access-key',accessKey); },[accessKey]);

  const connect=async()=>{
    setBusy(true);
    try{
      const h=await api('/api/health');
      setConnected(true);
      setOllama({online:h.ollamaOnline,model:h.ollamaModel||''});
      const state=await api('/api/state');
      setProfile({...starterProfile,...state.profile});
      setJobs(state.jobs?.length?state.jobs:demoJobs);
      setMessage(`Connected to your PC · Database: ${h.databasePath}`);
    }catch(e){setConnected(false);setMessage(e.message)}finally{setBusy(false)}
  };

  const saveProfile=async(next=profile)=>{
    setProfile(next);
    if(connected){
      try{await api('/api/profile',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(next)});}catch(e){setMessage(e.message)}
    }
  };

  const uploadCv=async(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setBusy(true);setMessage(`Saving ${file.name} to your local storage...`);
    try{
      const form=new FormData(); form.append('cv',file);
      const data=await api('/api/resume',{method:'POST',body:form});
      const next={...profile,resume:data.text,resumeFile:data.fileName};
      setProfile(next);
      setMessage(`CV saved locally: ${data.storedPath}`);
    }catch(err){setMessage(err.message)}finally{setBusy(false);e.target.value=''}
  };

  const searchJobs=async()=>{
    setBusy(true);setMessage('Searching free public sources from your PC...');
    try{
      const data=await api(`/api/search?q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`);
      setJobs(data.jobs||[]);
      setMessage(`Saved ${data.jobs?.length||0} jobs to your local database`);
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  };

  const setJobStatus=async(id,status)=>{
    setJobs(prev=>prev.map(j=>j.id===id?{...j,status:j.status===status?'':status}:j));
    if(connected) try{await api(`/api/jobs/${encodeURIComponent(id)}/status`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({status})});}catch(e){setMessage(e.message)}
  };

  const analyze=async(id)=>{
    setBusy(true);setMessage('Ollama is analyzing this job on your PC...');
    try{
      const data=await api(`/api/jobs/${encodeURIComponent(id)}/analyze`,{method:'POST'});
      setJobs(prev=>prev.map(j=>j.id===id?{...j,...data.analysis}:j));
      setMessage(`Ollama analysis saved locally using ${data.model}.`);
    }catch(e){setMessage(e.message)}finally{setBusy(false)}
  };

  const scored=useMemo(()=>jobs.map(j=>{
    const local=localScore(j,profile);
    return {...j,...local,score:j.ollamaScore??local.score,verdict:j.ollamaVerdict||local.verdict,matched:j.ollamaStrengths||local.matched,missing:j.ollamaGaps||local.missing}
  }).sort((a,b)=>b.score-a.score),[jobs,profile]);

  const visible=useMemo(()=>{
    if(tab==='Saved')return scored.filter(j=>j.status==='saved');
    if(tab==='Applied')return scored.filter(j=>j.status==='applied');
    if(tab==='Ignored')return scored.filter(j=>j.status==='ignored');
    return scored.filter(j=>j.status!=='ignored');
  },[scored,tab]);

  const stats={total:scored.length,strong:scored.filter(j=>j.score>=80).length,saved:scored.filter(j=>j.status==='saved').length,applied:scored.filter(j=>j.status==='applied').length};

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">JH</div><div><strong>Job Hunter</strong><span>Junior</span></div></div>
      <nav>{['Best Matches','Saved','Applied','Ignored'].map(item=><button key={item} className={tab===item?'nav-item active':'nav-item'} onClick={()=>setTab(item)}><Icon name={item==='Saved'?'star':item==='Applied'?'check':item==='Ignored'?'x':'briefcase'}/>{item}{item==='Saved'&&<b>{stats.saved}</b>}{item==='Applied'&&<b>{stats.applied}</b>}</button>)}</nav>
      <div className={connected?'connection-card online':'connection-card'}>
        <span className="connection-dot"/><div><strong>{connected?'PC Backend Online':'PC Backend Offline'}</strong><span>{connected?(ollama.online?`Ollama: ${ollama.model||'online'}`:'Ollama service offline'):'Connect to your local database'}</span></div>
      </div>
    </aside>

    <main>
      <header><div><p className="eyebrow">NETLIFY FRONTEND · YOUR PC BACKEND</p><h1>Find less. Match better. Apply faster.</h1><p>Your database, CVs, job history, and saved AI results stay under <b>your PC storage</b>. Ollama runs separately as your normal local Windows service.</p></div><button className="profile-button" onClick={()=>setShowProfile(!showProfile)}><Icon name="user"/> My Profile</button></header>

      <section className="connect-panel">
        <div className="section-heading"><div><span className="kicker">PRIVATE BACKEND</span><h2>Connect Netlify to your PC</h2></div><span className={connected?'badge-ok':'badge-warn'}>{connected?'CONNECTED':'NOT CONNECTED'}</span></div>
        <div className="connect-grid">
          <label>Backend HTTPS URL<input value={backendUrl} onChange={e=>setBackendUrl(e.target.value)} placeholder="https://your-tunnel.example.com"/></label>
          <label>Private access key<input type="password" value={accessKey} onChange={e=>setAccessKey(e.target.value)} placeholder="Paste key from your JobHunter config.json"/></label>
          <button className="primary" onClick={connect} disabled={busy}><Icon name="plug"/>{busy?'Connecting...':'Connect'}</button>
        </div>
        <p className="status-line">{message}</p>
      </section>

      {showProfile&&<section className="profile-panel">
        <div className="section-heading"><div><span className="kicker">PROFILE + CV</span><h2>Your private candidate profile</h2></div><label className="upload-button"><Icon name="upload"/> Upload CV<input type="file" accept=".pdf,.docx,.txt" onChange={uploadCv} hidden disabled={!connected}/></label></div>
        <div className="profile-grid">
          <label>Target roles<input value={profile.roles} onChange={e=>saveProfile({...profile,roles:e.target.value})}/></label>
          <label>Preferred location<input value={profile.location} onChange={e=>saveProfile({...profile,location:e.target.value})}/></label>
          <label>Minimum salary<input type="number" value={profile.minSalary} onChange={e=>saveProfile({...profile,minSalary:e.target.value})}/></label>
        </div>
        <label>Resume text<textarea rows="7" value={profile.resume} onChange={e=>saveProfile({...profile,resume:e.target.value})} placeholder="Upload PDF/DOCX/TXT or paste resume text here."/></label>
        {profile.resumeFile&&<p className="file-note">Current CV: <b>{profile.resumeFile}</b> · Stored on local storage</p>}
      </section>}

      <section className="search-panel"><div className="search-row"><div className="search-box"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Job title or skill"/></div><input className="location-input" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location or Remote"/><button className="primary" onClick={searchJobs} disabled={busy||!connected}><Icon name={busy?'refresh':'search'}/>{busy?'Working...':'Search jobs'}</button></div></section>

      <section className="stats"><article><span>Total roles</span><strong>{stats.total}</strong></article><article><span>Strong matches</span><strong>{stats.strong}</strong></article><article><span>Saved</span><strong>{stats.saved}</strong></article><article><span>Applied</span><strong>{stats.applied}</strong></article></section>

      <section className="results"><div className="section-heading"><div><span className="kicker">{tab.toUpperCase()}</span><h2>{visible.length} roles</h2></div><div className="legend"><span className="dot strong"/>80%+ strong match</div></div>
        <div className="job-list">{visible.map(job=><article className="job-card" key={job.id}>
          <div className="score-ring"><strong>{job.score}%</strong><span>{job.ollamaScore!=null?'ollama':'match'}</span></div>
          <div className="job-content">
            <div className="job-topline"><div><span className="source">{job.source}</span><h3>{job.title}</h3><p>{job.company} · {job.location}</p></div><span className={job.score>=80?'verdict strong':job.score>=65?'verdict medium':'verdict low'}>{job.verdict}</span></div>
            <div className="job-meta"><span>{job.salary||'Salary not listed'}</span><span>{job.posted||'Recently listed'}</span></div>
            <div className="match-grid"><div><h4>Matches</h4><div className="chips">{job.matched?.length?job.matched.map(x=><span className="chip good" key={x}>✓ {x}</span>):<span className="muted">Upload your CV for better scoring.</span>}</div></div><div><h4>Potential gaps</h4><div className="chips">{job.missing?.slice(0,4).map(x=><span className="chip gap" key={x}>{x}</span>)}</div></div></div>
            {job.ollamaReason&&<p className="ai-reason">{job.ollamaReason}</p>}
            <div className="actions"><button className={job.status==='saved'?'small active-save':'small'} onClick={()=>setJobStatus(job.id,'saved')}><Icon name="star"/> Save</button><button className={job.status==='applied'?'small active-apply':'small'} onClick={()=>setJobStatus(job.id,'applied')}><Icon name="check"/> Applied</button><button className="small" onClick={()=>setJobStatus(job.id,'ignored')}><Icon name="x"/> Ignore</button><button className="small ai-button" onClick={()=>analyze(job.id)} disabled={!connected||busy||!ollama.online}><Icon name="spark"/> Ollama</button>{job.url&&job.url!=='#'&&<a className="open-job" href={job.url} target="_blank" rel="noreferrer">Open job <Icon name="external"/></a>}</div>
          </div>
        </article>)}{!visible.length&&<div className="empty">Nothing here yet.</div>}</div>
      </section>
    </main>
  </div>
}
