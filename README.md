# Job Hunter Junior

A light React job-search frontend designed for Netlify, with a private Windows backend that stores your data on your own PC.

## Architecture

```
Netlify React frontend
        |
        | HTTPS tunnel URL + private access key
        v
Your Windows PC
  ├─ Node/Express private API
  ├─ SQLite database: E:\JobHunter\job-hunter.db
  ├─ CV files: E:\JobHunter\resumes\
  └─ saved Ollama evaluations in SQLite

Ollama runs separately as its normal local Windows service:
http://127.0.0.1:11434
```

**E:\JobHunter is storage only. Ollama does not run from D:.**

## First local run

Requirements:

- Node.js 20+ recommended
- An `E:` drive
- Ollama installed if you want AI scoring

Clone and run:

```powershell
git clone https://github.com/ValdemirJunior2020/Job-hunter.git
cd Job-hunter
npm install
npm run dev
```

Local frontend: `http://localhost:5180`
Local backend: `http://127.0.0.1:8788`

Or double-click:

- `START-LOCAL.bat` — starts backend + local frontend
- `START-BACKEND.bat` — starts only the PC backend for use with the Netlify frontend

On the first backend start it automatically creates:

```
E:\JobHunter\
├── job-hunter.db
├── config.json
└── resumes\
```

The private access key is inside:

```
E:\JobHunter\config.json
```

Do not commit or publish that key.

## Ollama

Ollama is optional for normal job search. For AI scoring:

```powershell
ollama list
ollama pull llama3.2:3b
```

The backend checks:

```
http://127.0.0.1:11434
```

To force a particular installed model before starting the backend:

```powershell
$env:OLLAMA_MODEL="llama3.2:3b"
npm run server
```

## CV upload

Supported files:

- PDF
- DOCX
- TXT

Uploaded CVs are copied into `E:\JobHunter\resumes\`. Extracted resume text is stored in SQLite and used for matching and Ollama evaluation.

## Netlify frontend

Build command:

```
npm run build
```

Publish directory:

```
dist
```

The Netlify frontend requires an HTTPS URL that reaches the local backend. A tunnel can point to:

```
http://127.0.0.1:8788
```

Paste the HTTPS tunnel URL and the access key from `E:\JobHunter\config.json` into the app's connection panel.

The access key is kept in browser session storage, not bundled into the Netlify build.

## Free job sources currently included

- Remotive
- Arbeitnow

Search results, statuses, profile data, CV text, and Ollama results are persisted to your SQLite database.

## Security model

Every `/api/*` endpoint requires the private `X-JobHunter-Key` header. The key is generated locally on first run. Do not expose `E:\JobHunter\config.json` or hard-code the key into the frontend repository.
