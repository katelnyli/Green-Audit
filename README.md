# Green Audit

Full-site sustainability auditing powered by browser automation.

## Structure

```
green-audit/
├── frontend/   # Next.js 16 — dashboard & report viewer
└── backend/    # Python FastAPI — audit orchestration
```

## Quick start

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm install
playwright install chromium
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
bun install
bun dev
```
