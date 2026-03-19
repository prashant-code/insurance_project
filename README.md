# NexGen Benefit Illustration Suite

NexGen is an enterprise-grade Benefit Illustration engine designed for high-performance insurance simulations. It features a clustered Node.js backend, a responsive React frontend, and a resilient infrastructure stack using PostgreSQL and Redis.

## 📋 Prerequisites

Before starting, ensure you have the following installed:
- **Node.js (v18+)**: Recommended LTS version.
- **Docker Desktop**: Required for the local database, cache, and monitoring stack.
- **Git**: For version control.
- **PostgreSQL Client (Optional)**: Such as `psql` or `pgAdmin` for manual database inspection.

---

## 🛠️ 1. Local Development Setup

### A. Clone & Install
```bash
# Install root documentation tools
npm install

# Install Backend dependencies
cd backend && npm install

# Install Frontend dependencies
cd ../frontend && npm install
```

### B. Infrastructure (Docker)
In the project root, start the supporting services:
```bash
docker compose up -d
```
*This launches PostgreSQL (Port 5432), Redis (Port 6379), Prometheus (Port 9090), and Grafana (Port 3001).*

### C. Environment Configuration
Navigate to the `backend` directory and create your `.env` file:
```bash
cp .env.example .env
```
Update the `.env` with your local credentials (see [Environment Variables](#-environment-variables) below).

### D. Running the Apps
Open two terminals:
- **Backend**: `cd backend && npm run dev`
- **Frontend**: `cd frontend && npm run dev`

---

## 🚀 2. Production Deployment

### A. Docker Build (Proprietary Obfuscation)
The project includes a `mkdocker.sh` script to build production-ready, obfuscated images:
```bash
chmod +x mkdocker.sh
./mkdocker.sh benefit-api:v1 benefit-ui:v1
```

### B. Orchestration
Use the production-grade `docker-compose.yml` (located in `backend/` or root) to deploy the full stack:
```bash
cd backend
docker compose -f docker-compose.yml up -d
```
*In production, ensure you use PgBouncer for connection scaling and Redis Sentinel for failover.*

---

## 🔐 3. Environment Variables

The backend requires the following variables in `.env`:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_PASSWORD` | Security password for Redis | `your_redis_pass` |
| `JWT_SECRET` | Secret key for token signing | `use-a-long-random-string` |
| `ENCRYPTION_KEY` | 64-char hex key for PII masking | `32-byte-hex-string` |
| `ALLOWED_ORIGINS`| CORS whitelist (comma separated) | `http://localhost:5173,https://app.com` |
| `PORT` | API Listening Port | `5000` |

---

## 📊 4. Monitoring & Stress Testing

- **Prometheus**: Access `http://localhost:9090` to view raw metrics.
- **Grafana**: Access `http://localhost:3001` (user: `admin`, pass: `admin`) for visual dashboards.
- **Stress Test**: `npx autocannon -c 100 -d 20 http://localhost:5000/api/calculations`

---

## 🛡️ Failure Management & Resilience (War Cases)

| Scenario | Component | Resilience Strategy | Outcome |
| :--- | :--- | :--- | :--- |
| **Worker Crash** | API Cluster | Master auto-forks new worker | Zero downtime |
| **Redis Down** | Cache/Rate Limit| Sentinel handles failover | High Availability |
| **DB Overload** | PostgreSQL | PgBouncer + Read Replicas | Prevents freeze |

---

## 📚 Technical Deep-Dives
- [Architecture Master](documents/ARCHITECTURE_MASTER.md): Clustering, Redis Sentinel, and Pub/Sub mechanics.
- [Database Deep-Dive](documents/DATABASE_DEEP_DIVE.md): UUIDv7, JSONB vs Normalized, and Scaling.
- [Security & Resilience](documents/SECURITY_RESILIENCE_MASTER.md): PII Masking, CSP, and XSS defense.
- [Ultimate Testing Guide](documents/ULTIMATE_TESTING_MASTER.md): Step-by-step local verification.
