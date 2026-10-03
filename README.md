# Job Hunter Junior

Netlify hosts the React frontend. Your Windows PC runs the private API, SQLite database, CV storage, and talks to local Ollama.

## Storage auto-detection

The backend chooses storage in this order:

1. `JOB_HUNTER_DATA_DIR` environment variable, if set.
2. Existing `D:\JobHunter`.
3. Existing `E:\JobHunter`.
4. `D:\JobHunter` if D: exists.
5. `E:\JobHunter` if E: exists.
6. `%USERPROFILE%\JobHunter` as fallback.

This means an existing `D:\JobHunter\config.json` and database are preserved automatically.

The storage folder contains:

```
JobHunter\
├── job-hunter.db
├── config.json
└── resumes\
```

Ollama is separate and normally runs at:

```
http://127.0.0.1:11434
```

## Run backend

```powershell
git pull
npm install
npm run server
```

Or double-click `START-BACKEND.bat`.

The terminal prints the exact database path and config path being used.

## Netlify connection

Keep the backend and Cloudflare tunnel running:

```powershell
cloudflared tunnel --url http://127.0.0.1:8788
```

In the Netlify app, enter:

- Backend HTTPS URL: the current `https://...trycloudflare.com` URL
- Private access key: the `accessKey` from the config file printed by the backend

## CV upload

PDF, DOCX, and TXT are supported. Files and extracted text stay on your PC.

## Ollama

The backend checks local Ollama and uses an installed model for job-fit analysis. You can select a default model before launch:

```powershell
$env:OLLAMA_MODEL="llama3.2:3b"
npm run server
```

## Local frontend

```
http://localhost:5180
```

## Local backend

```
http://127.0.0.1:8788
```
