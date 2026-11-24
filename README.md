# Courseway: a learning management system

React + TypeScript frontend, Python FastAPI backend, PostgreSQL, Docker, deployed to a Linux VM on Microsoft Azure, with GitHub for version control and CI/CD.

| # | Requirement | Where it lives |
|---|---|---|
| 1 | Student registration and login | `backend/app/routers/auth.py`, `frontend/src/pages/AuthPage.tsx` (JWT, bcrypt) |
| 2 | Course listing and management | `routers/courses.py`, `Catalog.tsx`, `Teach.tsx`, `CourseEditor.tsx` |
| 3 | Course content creation | `routers/content.py` (modules and lessons), lesson editor in `CourseEditor.tsx` |
| 4 | Video and learning material pages | `Learn.tsx` (YouTube, Vimeo or .mp4 player, reading text, material download link) |
| 5 | Quizzes and assessments | `routers/quizzes.py`, `QuizBuilder.tsx`, `QuizPage.tsx` (server-side grading) |
| 6 | Student progress tracking | `routers/progress.py`, `MyLearning.tsx`, outline ticks in `Learn.tsx` |
| 7 | Admin dashboard | `routers/admin.py`, `Admin.tsx` (stats, user roles, activate/deactivate, publish) |
| 8 | Azure deployment | `docker-compose.prod.yml`, `infra/`, `.github/workflows/` |

## Roles

- **student**: every self-registered account. Browses, enrolls, learns, takes quizzes.
- **instructor**: creates and edits their own courses, lessons and quizzes.
- **admin**: everything an instructor can do on any course, plus the admin dashboard. The first admin is created at startup from `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`. Admins promote students to instructors in the dashboard.

## Run it locally

Needs Docker.

```bash
docker compose up --build
```

- App: http://localhost:8080
- API docs (Swagger): http://localhost:8000/docs
- Admin login: `admin@example.com` / `ChangeMe123!`

Optional demo course and instructor (`instructor@example.com` / `Instructor123!`):

```bash
docker compose exec backend python -m app.seed_demo
```

### Without Docker (hot reload)

```bash
# terminal 1: database
docker compose up db
# terminal 2: API
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# terminal 3: UI (proxies /api to :8000)
cd frontend && npm install && npm run dev      # http://localhost:5173
```

### Tests

```bash
cd backend && pytest -q     # end-to-end API tests on an in-memory SQLite database
cd frontend && npm run build   # type-checks and builds
```

## Architecture

```
Browser ──HTTPS──> Caddy (80/443, automatic Let's Encrypt certificate)
                     └─> nginx (serves the React build, proxies /api/*)
                            └─> FastAPI (uvicorn, :8000)
                                   └─> PostgreSQL 16 (volume on the VM)
```

Only Caddy is published to the internet. The database and API are reachable only on the Docker network.

## Deploy to Azure

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:<you>/courseway.git
git push -u origin main
```

CI (`ci.yml`) then runs the backend tests, the frontend build and both Docker builds on every push.

### 2. Create the Azure VM

```bash
az login
./infra/azure/provision.sh
```

This creates a resource group, an Ubuntu 22.04 `Standard_B2s` VM with a public DNS name, opens ports 80 and 443, and installs Docker on first boot. The script prints your host name, for example `courseway-1234.northeurope.cloudapp.azure.com`. Override defaults with `RG`, `LOCATION`, `VM`, `SIZE`, `DNS_LABEL`.

### 3. First deploy on the VM

```bash
ssh azureuser@<your-host-name>
git clone https://github.com/<you>/courseway.git ~/courseway     # private repo: add a read-only deploy key
cd ~/courseway
cp .env.example .env && nano .env     # set POSTGRES_PASSWORD, SECRET_KEY (openssl rand -hex 32), admin password, DOMAIN
docker compose -f docker-compose.prod.yml up -d --build
```

Open `https://<your-host-name>`. The certificate is issued on first request, which can take a few seconds.

### 4. Automatic deploys from GitHub

Create a dedicated SSH key (`ssh-keygen -t ed25519 -f deploy_key`), append `deploy_key.pub` to `~/.ssh/authorized_keys` on the VM, and add these repository secrets:

| Secret | Value |
|---|---|
| `AZURE_VM_HOST` | the VM host name |
| `AZURE_VM_USER` | `azureuser` |
| `AZURE_VM_SSH_KEY` | contents of `deploy_key` (the private key) |

From then on, every push to `main` that passes CI runs `deploy.yml`, which pulls the code on the VM and rebuilds the containers.

## Before you call it production

- **Backups.** The database lives in a Docker volume on the VM. Schedule `pg_dump` (cron to Azure Blob Storage), or switch to *Azure Database for PostgreSQL – Flexible Server* by pointing `DATABASE_URL` at it and removing the `db` service.
- **Migrations.** Tables are created at startup with `create_all`, which never alters existing tables. Add Alembic before your first schema change.
- **SSH.** `az vm create` opens port 22 to everyone. Restrict the NSG rule to your IP.
- **Secrets.** `.env` stays on the VM and out of git. For stricter handling use Azure Key Vault.
- **Tokens.** The JWT is kept in `localStorage` for simplicity. If you add user-generated rich text, sanitize it, or move to httpOnly cookies.
- **Rate limiting** on `/api/auth/login`, and email verification or password reset, are not included.
- **Uploads.** Videos and materials are links (YouTube, Vimeo, any file URL). For hosting your own files, add Azure Blob Storage with SAS URLs.

## API at a glance

`/api/auth/{register,login,me}` · `/api/courses` (GET, POST, GET/PUT/DELETE `/{id}`, `/{id}/enroll`, `/enrolled`) · `/api/courses/{id}/modules` · `/api/modules/{id}/lessons` · `/api/lessons/{id}` · `/api/courses/{id}/quizzes` · `/api/quizzes/{id}` · `/api/quizzes/{id}/attempts` · `/api/lessons/{id}/complete` · `/api/progress/{me,courses/{id}}` · `/api/admin/{stats,users}`

Full interactive documentation is at `/docs` on the API.
