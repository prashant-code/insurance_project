# NexGen Benefit Illustration Suite

Enterprise-grade policy illustration engine for Indian insurance products. Simulates projected fund values, death benefits, and premium schedules at scale — from single-policy projections to million-row bulk batch jobs.

---

## 🏗️ Architecture at a Glance

```
Browser (React + Vite)
     │  HTTPS / Cookie Auth
     ▼
Node.js API Cluster (Express + Helmet + CORS)
     │              │
     ▼              ▼
PostgreSQL     Redis Pub/Sub ──► Background Workers
(PgBouncer)    (Rate Limit,       (calculateBenefits
                Pub/Sub)           → JSONB → DB)
     │
     ▼
Prometheus / Grafana
```

**Tech Stack**

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Framer Motion, TailwindCSS v3 |
| Backend | Node.js (Cluster), Express, bcrypt, JWT, AJV |
| Database | PostgreSQL 15 (via PgBouncer) |
| Cache / Queue | Redis 7 (Pub/Sub for bulk jobs) |
| Monitoring | Prometheus + Grafana |
| Containerisation | Docker Compose |

---

## 📋 Prerequisites

- **Node.js v18+** (LTS recommended)
- **Docker Desktop** — for PostgreSQL, Redis, Prometheus, Grafana
- **Git**
- **PostgreSQL client** (optional) — `psql` or pgAdmin for manual inspection

---

## 🛠️ Local Development Setup

### 1. Clone & Install

```bash
# Root tooling
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Start Infrastructure (Docker)

```bash
# From project root
docker compose up -d
```

This launches:
| Service | Port | Purpose |
|---|---|---|
| PostgreSQL | 5432 | Primary database |
| PgBouncer | 5433 | Connection pooling |
| Redis | 6379 | Pub/Sub + rate limiting |
| Prometheus | 9090 | Metrics scraping |
| Grafana | 3001 | Visual dashboards |

### 3. Environment Variables

Create `backend/.env` (copy from `backend/.env.example`):

```env
DATABASE_URL=postgresql://nexgen:nexgen@localhost:5433/nexgen_db
REDIS_PASSWORD=your_redis_password
JWT_SECRET=use-a-long-random-string-min-32-chars
ENCRYPTION_KEY=64-char-hex-string-for-pii-masking
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
PORT=5000
DB_ENGINE=postgres      # or 'yugabyte' for distributed mode
NODE_ENV=development
```

### 4. Run the Apps

Open two terminals:

```bash
# Terminal 1 — Backend API
cd backend && node index.js

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

---

## 🚀 API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Register a new user |
| `POST` | `/api/auth/login` | None | Login, sets JWT cookie |
| `GET` | `/api/auth/me` | Required | Get current user profile |
| `POST` | `/api/auth/logout` | None | Clear JWT cookie |
| `POST` | `/api/auth/secure-ping` | Required | Test protected endpoint |

### Calculations (Individual)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/calculations/calculate` | Required | Run single policy projection |

**Request body:**
```json
{
  "product_id": "00000000-0000-0000-0000-000000000000",
  "age": 30,
  "policy_term": 20,
  "premium_payment_term": 15,
  "premium_amount": 50000
}
```

**Validations enforced:**
- `premium_payment_term` ≤ `policy_term`
- `age + policy_term` ≤ 85 (max maturity age)
- `premium_amount` ≥ ₹1,000

### Bulk Calculations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/bulk/upload` | Required | Upload CSV-parsed batch (max 10,000 rows) |
| `GET` | `/api/bulk/:batch_id/results` | Required | Fetch batch results (with projection JSONB) |

---

## 📊 Bulk Upload Flow (End-to-End)

```
User selects CSV  →  Frontend parses rows  →  POST /api/bulk/upload
        │
        ▼
  Rows written to DB (status: PENDING)
        │
        ▼
  batch_id published to Redis BATCH_JOBS channel
        │
        ▼
  Background Worker picks up job
  → calculateBenefits() per row
  → INSERT illustration_results (JSONB)
  → UPDATE status = 'COMPLETED'
        │
        ▼
  Frontend polls GET /api/bulk/:id/results
  → Shows progress (X/N completed)
  → Renders year-by-year table per policy
  → Allows CSV export
```

**CSV Template (download from UI "Download Template" button):**
```csv
product_id,age,policy_term,premium_payment_term,premium_amount
00000000-0000-0000-0000-000000000000,30,20,15,50000
00000000-0000-0000-0000-000000000000,35,25,20,75000
```

---

## 🔐 Security

| Feature | Implementation |
|---|---|
| Password hashing | `bcrypt` with salt rounds = 10 |
| Token auth | `JWT` (1h expiry) stored as `httpOnly` cookie |
| PII masking | Names, DOB, mobile masked on register (`utils/encryption.js`) |
| Input validation | `ajv` schema on every endpoint |
| Rate limiting | Redis-backed per-IP limiter |
| CORS | Strict origin whitelist via `ALLOWED_ORIGINS` env |
| Helmet | Full HTTP security headers (CSP, X-Frame, etc.) |

---

## 📊 Monitoring

- **Prometheus Metrics**: `GET http://localhost:5000/metrics`
- **Grafana Dashboard**: http://localhost:3001 (admin / admin)
- **Stress Test**: `npx autocannon -c 100 -d 20 http://localhost:5000/health`

---

## 🛡️ Failure Resilience (War Cases)

| Failure Scenario | Component | Strategy | Outcome |
|---|---|---|---|
| Worker process crash | Node Cluster | Master auto-forks replacement | Zero downtime |
| Redis goes offline | Pub/Sub | Batch stays PENDING, retried | Graceful degradation |
| DB connection spike | PostgreSQL | PgBouncer pools + queue | No connection exhaustion |
| Duplicate batch job | Worker | `UNIQUE` on `request_id` in results | Idempotent — no duplicate results |
| Invalid CSV row | Bulk API | `Promise.allSettled` — other rows proceed | Partial success |

---

## 📚 Technical Documentation

| Document | Location | Contents |
|---|---|---|
| SQL Reference | [`backend/schema/SQL_REFERENCE.md`](backend/schema/SQL_REFERENCE.md) | Every query, table design, index rationale |
| Architecture Master | [`documents/ARCHITECTURE_MASTER.md`](documents/ARCHITECTURE_MASTER.md) | Clustering, Redis Sentinel, Pub/Sub mechanics |
| Database Deep-Dive | [`documents/DATABASE_DEEP_DIVE.md`](documents/DATABASE_DEEP_DIVE.md) | UUIDv7, JSONB vs Normalized, scaling |
| Security Resilience | [`documents/SECURITY_RESILIENCE_MASTER.md`](documents/SECURITY_RESILIENCE_MASTER.md) | PII masking, CSP, XSS defence |
| Testing Guide | [`documents/ULTIMATE_TESTING_MASTER.md`](documents/ULTIMATE_TESTING_MASTER.md) | Step-by-step local verification |

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Tests cover:
- `calculateBenefits()` — mathematical accuracy across multiple ages and terms
- Edge cases: zero premium payment years, maturity age limit enforcement

---

## 🚀 Production Deployment

```bash
# Build obfuscated Docker images
chmod +x mkdocker.sh
./mkdocker.sh benefit-api:v1 benefit-ui:v1

# Deploy full stack
cd backend && docker compose -f docker-compose.yml up -d
```

> **Production checklist**: Use PgBouncer for connection scaling, Redis Sentinel for failover, set `NODE_ENV=production`, and use strong secrets for `JWT_SECRET` and `ENCRYPTION_KEY`.

---

*© 2026 NexGen Financial Technologies — Enterprise Benefit Illustration Platform*
