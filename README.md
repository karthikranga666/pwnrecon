# PwnRecon

> Autonomous Attack Surface Intelligence Platform

Dark terminal UI meets professional recon engine. Built for pentesters, bug bounty hunters, and security engineers.

---

## Features

- **DNS Enumeration** — A/AAAA/MX/NS/TXT/SOA/CAA records, subdomain bruteforce (50+ prefixes), SPF/DMARC/DKIM, zone transfer check
- **TLS Analysis** — Full cert chain, protocol/cipher grading (A–F), expiry countdown, SAN enumeration
- **HTTP Fingerprinting** — Tech stack detection, WAF identification, open redirect testing, response timing
- **Security Headers** — 10 OWASP headers checked, CSP analysis, one-click nginx/Apache remediation config
- **Risk Scoring** — CVSS-inspired 0–100 score, severity-sorted findings with remediation guidance
- **AI Analysis** — Ollama (local LLM) with rule-based fallback engine, interactive pentest assistant chat

---

## Quick Start

```bash
# Install everything
npm run setup

# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Optional — Local AI (requires Ollama)
ollama pull llama3.2 && ollama serve
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

---

## Ollama Setup (Optional)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull llama3.2

# Start server
ollama serve
```

Without Ollama, the built-in rule-based engine handles all AI analysis automatically.

---

## Deploy

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
```

Set env var: `VITE_API_URL=https://your-backend.railway.app`

### Backend → Railway

1. Connect repo to Railway
2. Set root directory: `backend`
3. Add env vars: `FRONTEND_URL`, `OLLAMA_URL` (optional)

---

## Environment Variables

Copy `.env.example` to `.env` in each directory:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `FRONTEND_URL` | `*` | CORS allowed origin |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Default model |
| `VITE_API_URL` | `` (empty) | Backend URL for frontend |

---

## Architecture

```
pwnrecon/
├── backend/
│   └── src/
│       ├── index.js          # Express server + rate limiting
│       ├── modules/
│       │   ├── dns.js        # DNS enum + subdomain brute
│       │   ├── tls.js        # TLS cert analysis + grading
│       │   ├── http.js       # HTTP fingerprinting + WAF detection
│       │   ├── headers.js    # Security header audit
│       │   └── risk.js       # Risk scoring engine
│       └── ai/
│           ├── ollama.js     # Ollama integration
│           ├── fallback.js   # Rule-based analysis
│           └── prompts.js    # Prompt templates
└── frontend/
    └── src/
        ├── App.jsx
        ├── components/       # All UI components
        ├── hooks/            # useRecon, useAI
        └── lib/api.js        # API client
```

---

## API Reference

```
POST /api/recon
  Body: { target: "example.com", modules: ["dns","tls","http","headers"] }

POST /api/ai/analyze
  Body: { reconData: {...}, domain: "example.com", model: "llama3.2" }

POST /api/ai/chat
  Body: { message: "string", context: { domain, riskScore } }

GET  /api/ai/status
GET  /health
```

---

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K` — Focus scan input

---

*Ethical use only. Only scan domains you own or have explicit permission to test.*
