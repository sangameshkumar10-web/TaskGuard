# TaskGuard Deployment Guide

## Architecture Overview

TaskGuard consists of two separate deployable components:

1. **Frontend** (React + Vite) → Deploy to **Vercel** (static site)
2. **Backend** (FastAPI + SQLite + Background Scheduler) → Deploy separately (NOT on Vercel)

The frontend is a static React app that makes API calls to the backend. The backend runs a FastAPI server with a background reminder scheduler and uses SQLite for persistence.

---

## Root Cause of 404 / Backend Offline on Vercel

The frontend was deployed to Vercel as a static site, but the FastAPI backend was NOT deployed. The frontend uses relative API paths (`/api/*`) which work in:
- Local development (Vite proxies `/api` to `http://127.0.0.1:8000`)
- Electron desktop app (backend serves both frontend and API on same origin)

On Vercel, the frontend is deployed as a static site with **NO backend**. The `/api/*` requests go to the Vercel domain where there's no backend - hence 404 errors and "Backend offline" status.

---

## Files Changed

### 1. `frontend/src/services/api.ts`
- Made API base URL configurable via `VITE_API_BASE_URL` environment variable
- Defaults to `/api` for local development (works with Vite proxy)
- Production: Set `VITE_API_BASE_URL` to your deployed backend URL

### 2. `frontend/.env.example`
- Documents the required `VITE_API_BASE_URL` environment variable

### 3. `frontend/.env.production`
- Template for production environment variables
- Set `VITE_API_BASE_URL` to your deployed backend URL

---

## Deployment Instructions

### Step 1: Deploy the Backend (Required First)

The FastAPI backend **cannot run on Vercel** because:
- It runs a background reminder scheduler (long-running process)
- It uses SQLite (file-based, not suitable for serverless)
- It runs background tasks and Windows notifications (Electron only)

**Recommended Backend Hosting Options:**

| Platform | Why |
|----------|-----|
| **Render** | Free tier, supports background workers, persistent disks for SQLite |
| **Railway** | Simple deployment, persistent volumes |
| **Fly.io** | Global deployment, persistent volumes |
| **VPS (DigitalOcean, Linode, Hetzner)** | Full control, run with Docker |

#### Backend Deployment Example (Render):

1. Create a new **Web Service** on Render
2. Connect your GitHub repo
3. Build Command: `cd backend && pip install -r requirements.txt`
4. Start Command: `cd backend && python run.py`
5. Add **Persistent Disk** for `/data` (for SQLite database)
6. Set Environment Variables:
   - `TASKGUARD_API_HOST=0.0.0.0` (bind to all interfaces)
   - `TASKGUARD_API_PORT=8000` (or Render's PORT env var)
   - `TASKGUARD_REMINDER_ENABLED=1`
   - `TASKGUARD_DB_PATH=/data/taskguard.db` (on persistent disk)

#### Backend Deployment Example (Docker):

```dockerfile
# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY run.py .

# Create data directory for SQLite
RUN mkdir -p /data

ENV TASKGUARD_API_HOST=0.0.0.0
ENV TASKGUARD_API_PORT=8000
ENV TASKGUARD_DB_PATH=/data/taskguard.db
ENV TASKGUARD_REMINDER_ENABLED=1

EXPOSE 8000
CMD ["python", "run.py"]
```

```bash
docker build -t taskguard-backend ./backend
docker run -d -p 8000:8000 -v taskguard-data:/data taskguard-backend
```

---

### Step 2: Deploy Frontend to Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. **Framework Preset**: Vite
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment Variables** (Vercel Project Settings → Environment Variables):
   - `VITE_API_BASE_URL` = `https://your-backend-url.com` (your deployed backend URL)

   **Important**: No trailing slash! Example: `https://taskguard-api.onrender.com`

7. Deploy!

---

### Step 3: Verify Deployment

1. Open your Vercel URL
2. Check sidebar shows "Backend connected" (green dot)
3. Create a test task
4. Verify task appears in dashboard
5. Check Settings page loads reminder settings

---

## Local Development (Unchanged)

```bash
# Terminal 1: Start frontend dev server
cd frontend && npm run dev

# Terminal 2: Start backend
cd backend && .venv\Scripts\python.exe run.py
# or
cd backend && python run.py
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000` automatically.

---

## Desktop App (Unchanged)

The Electron desktop app continues to work as before - it starts the backend locally and serves the frontend from the backend.

```bash
cd desktop && npm run dev    # Development
cd desktop && npm start      # Production (uses built frontend)
```

---

## Environment Variables Summary

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | **Yes** | Your deployed backend URL (e.g., `https://api.yourapp.com`) |

### Backend (Render/Railway/Fly.io/VPS)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TASKGUARD_API_HOST` | No | `127.0.0.1` | Bind address (`0.0.0.0` for production) |
| `TASKGUARD_API_PORT` | No | `8000` | Port to listen on |
| `TASKGUARD_DB_PATH` | No | `data/taskguard.db` | SQLite database path |
| `TASKGUARD_REMINDER_ENABLED` | No | `1` | Enable background reminders |
| `TASKGUARD_REMINDER_INTERVAL_MINUTES` | No | `15` | Overdue reminder interval |
| `TASKGUARD_REMINDER_OFFSETS_MINUTES` | No | `30,5` | Pre-deadline reminder offsets |
| `TASKGUARD_DEADLINE_REMINDERS_ENABLED` | No | `1` | Enable pre-deadline reminders |
| `TASKGUARD_OVERDUE_ALERTS_ENABLED` | No | `1` | Enable overdue alerts |

---

## Important Notes

1. **SQLite Persistence**: The backend uses SQLite. On platforms like Render/Railway, you MUST configure a persistent disk/volume for the database file, otherwise data will be lost on redeploy.

2. **CORS**: The backend doesn't explicitly configure CORS because in production, the frontend and backend should be on the same domain (or you configure CORS in FastAPI). If using different domains, add CORS middleware to `main.py`.

3. **WebSocket/Background Tasks**: The reminder scheduler runs in the FastAPI lifespan. This requires a long-running process - NOT compatible with Vercel's serverless functions.

4. **Windows Notifications**: Only work in the Electron desktop app. The web version (Vercel) will not show Windows notifications.

5. **Database Migrations**: The backend uses `CREATE TABLE IF NOT EXISTS` - schema updates are additive. For breaking changes, you'll need manual migration scripts.

---

## Troubleshooting

### "Backend offline" in sidebar
- Check `VITE_API_BASE_URL` is set correctly in Vercel
- Verify backend is running and accessible at that URL
- Check backend logs for errors
- Test backend health endpoint: `curl https://your-backend-url.com/api/health`

### 404 on `/api/tasks`
- Backend not deployed or wrong URL
- Check `VITE_API_BASE_URL` doesn't have trailing slash
- Verify backend routes are registered at `/api/tasks`

### CORS Errors
- Add CORS middleware to `backend/app/main.py`:
```python
from fastapi.middleware.cors import CORSMiddleware
application.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-vercel-app.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Database Locked / Locked Errors
- Ensure only one backend instance runs
- Check SQLite file permissions on persistent disk
- Increase `busy_timeout` in `database.py` if needed

---

## Validation Checklist

- [ ] Backend deployed and accessible at `https://your-backend-url.com/api/health` → returns `{"status": "ok"}`
- [ ] Frontend `VITE_API_BASE_URL` set to backend URL in Vercel
- [ ] Frontend builds successfully on Vercel
- [ ] Vercel deployment loads without console errors
- [ ] Sidebar shows "Backend connected" (green)
- [ ] Can create, read, update, delete tasks
- [ ] Settings page loads reminder configuration
- [ ] Overdue task triggers notification (desktop app only)
- [ ] Data persists across backend restarts

---

## Summary

**Root Cause**: Frontend deployed to Vercel without backend. The `/api/*` requests 404 because no backend exists on Vercel.

**Solution**: 
1. Deploy FastAPI backend separately (Render/Railway/Fly.io/VPS)
2. Set `VITE_API_BASE_URL` in Vercel to point to deployed backend
3. Frontend builds and works on Vercel

**Files Modified**:
- `frontend/src/services/api.ts` - Configurable API base URL
- `frontend/.env.example` - Documentation
- `frontend/.env.production` - Production template

**Tests Pass**: 53 backend tests, 22 desktop tests, frontend build successful, notification pipeline verified.