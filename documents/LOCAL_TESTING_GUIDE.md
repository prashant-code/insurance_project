# 🏠 LOCAL TESTING GUIDE

If you want to run the project directly on your local Windows machine instead of Codespaces, follow these exact steps.

---

## 🛠️ 1. Start Local Infrastructure (Docker)

You only need Docker for the database and cache. Open your terminal in the project root and run:
```bash
cd backend
docker-compose up -d postgres pgbouncer redis
```
*Note: This starts the "engine" (Postgres, PgBouncer, and Redis) but leaves the Node.js API free to run natively on your Windows machine for easier debugging.*

---

## 🚀 2. Launch the Application

Open **two** separate terminal windows:

### **Terminal 1: Node.js Backend**
```bash
cd backend
npm install   # If not already done
npm start     # Starts your API on http://localhost:5000
```

### **Terminal 2: React Frontend**
```bash
cd frontend
npm install   # If not already done
npm run dev   # Starts your UI on http://localhost:3000
```

---

## 🧪 3. Local Verification Checklist

1. **Database Check**: Open your browser to `http://localhost:5432` (or use a tool like DBeaver/pgAdmin) to confirm Postgres is healthy.
2. **API Check**: Open `http://localhost:5000/api/health` (if you have a health endpoint) or try to hit a route.
3. **UI Check**: Open `http://localhost:3000`. The login screen should appear with premium animations.
4. **Login**: Use the default credentials provided in your `db_schema.sql`.

---

## 💡 Pro-Tips for Local Windows Users

- **Port Conflicts**: If the terminal says `EADDRINUSE: port 3000 is already in use`, it means another app is blocking the UI. I have configured your UI to use `3000` to match your DevOps requirements.
- **Node Version**: Ensure you are using **Node.js 20+** locally for the best performance with our clustering logic.
- **Environment**: Your `backend/.env` should point to `DATABASE_URL=postgresql://user:password@localhost:6432/benefit_db` (using the PgBouncer port).

---

## 📂 Master Documentation
For deep technical questions during your interview, refer to your **Master Specs** in the `./documents` folder:
1. `ARCHITECTURE_MASTER.md`
2. `DATABASE_DEEP_DIVE.md`
3. `SECURITY_RESILIENCE_MASTER.md`
4. `SCALING_MASTER.md`
5. `INTERVIEW_PREP_MASTER.md`
6. `ULTIMATE_TESTING_MASTER.md`
