# 🚀 ULTIMATE FULL-STACK TESTING GUIDE

This master document explains how to launch, monitor, and stress-test the entire Benefit Illustration system in your local environment.

---

## 🏗️ 1. Infrastructure Startup

Run this command in the project root to spin up the database, cache, and monitoring tools using Docker Desktop:
```bash
docker compose up -d
```

### ✅ Health Check Status:
| Service | Port | Local URL | Verify Command |
| :--- | :---: | :---: | :--- |
| **Postgres** | `5432` | `localhost:5432` | `pg_isready -h localhost` |
| **Redis** | `6379` | `localhost:6379` | `redis-cli ping` |
| **Prometheus**| `9090` | `localhost:9090` | Check `Status -> Targets` |
| **Grafana** | `3001` | `localhost:3001` | Login: `admin/admin` |

---

## 🛠️ 2. Application Launch

Open two terminal tabs:

**Tab 1 (API Server):**
```bash
cd backend && npm run dev
```

**Tab 2 (Frontend UI):**
```bash
cd frontend && npm run dev
```

---

## 📊 3. Monitoring & Metrics (Interview Highlight)

Our system exports real-time technical metrics to Prometheus. Here is how to verify them:

### **A. Prometheus (Raw Data)**
1. Open `http://localhost:9090`.
2. Type `http_request_duration_seconds_count` in the query box.
3. Click "Execute". You will see counts for all API hits (login, calculations, etc.).

### **B. Grafana (Visualization)**
1. Open `http://localhost:3001`.
2. Login with `admin / admin`.
3. **Connect Prometheus**: Go to `Connections -> Data Sources -> Add Prometheus`. Use `http://prometheus:9090` (if inside docker) or `http://localhost:9090`.
4. **Import Dashboard**: Import the JSON found in `documents/grafana_dashboard.json`.

---

## 🧪 4. Stress Testing Example (Simulating Load)

To see the **API Clustering** and **Redis Rate Limiting** in action, run this stress script from your terminal:

```bash
# Simulates 50 users hitting the calculation engine simultaneously
npx autocannon -c 50 -d 10 http://localhost:5000/api/calculations
```

### **What to Watch For:**
1. **Prometheus**: Watch the `rate` of requests spike in real-time.
2. **Cluster Health**: Open the `backend` terminal; you will see different Worker PIDs handling requests, proving the **Clustering** is working.
3. **Redis**: If you hit the rate limit, the API will start returning `429 Too Many Requests`.

---

## 🔍 5. Troubleshooting (Local Environment)

**Q: Connection to Database Refused?**
*A: Ensure the Postgres container is running (`docker ps`) and that you have initialized the schema if necessary.*

**Q: Grafana can't find Prometheus?**
*A: If running both in Docker, use the service name `http://prometheus:9090`.*

**Q: Port 5000 or 3000 already in use?**
*A: Check if another Node process is running using `lsof -i :5000` (Mac/Linux) or `netstat -ano | findstr :5000` (Windows).*
