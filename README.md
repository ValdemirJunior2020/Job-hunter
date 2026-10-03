# Job Hunter Junior

A light, local-first job search dashboard inspired by the strongest ideas in **career-ops**, **ai-job-search**, and **Anveshana** while keeping this implementation free to run without a required paid AI API.

## What it does

- Searches free public job sources with no API key required.
- Scores roles against your target roles, location, salary floor, and pasted resume.
- Lets you save, ignore, and mark applications as applied.
- Stores profile and pipeline state in your browser localStorage.
- Keeps the final application decision with you.
- Uses a light, minimal UI.
- Includes demo roles so the frontend stays usable when a public source is unavailable.

## Current free sources

- Remotive public remote jobs endpoint.
- Arbeitnow public job board endpoint.

Public endpoints can change their limits or availability. The app is designed so more source adapters can be added without changing the UI.

## Run

```bash
npm install
npm run install:browsers
npm run dev
```

Frontend: http://localhost:5173  
Local server: http://127.0.0.1:8788

## Architecture

```
React + Vite
   |
   +-- Local profile + pipeline state
   |
Express local server
   |
   +-- Free job-source adapters
   +-- Normalization + dedupe
```

## Product direction

The next high-value additions are:

1. Resume file import and parsing.
2. Local Ollama scoring and job-gap explanations.
3. Greenhouse / Lever / Ashby source adapters.
4. Resume and cover-letter drafts that never invent experience.
5. Human-reviewed application form preparation with Playwright.
6. Interview tracker and outcome analytics.

## Principles

- Apply better to fewer roles.
- Never fabricate resume facts.
- No automatic final submission.
- Prefer local storage and free sources.
- Keep paid services optional, never required.
