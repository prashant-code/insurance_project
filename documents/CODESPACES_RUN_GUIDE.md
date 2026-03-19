# 🌬️ CODESPACES RUN & TUNNEL GUIDE

This guide explains how to launch your project in the cloud and access it from your local browser as if it were running on your machine.

---

## 🏗️ 1. Automated Service Startup

The first time you enter your Codespace, follow this sequence:

1. **Terminal 1 (Infrastructure)**:
   ```bash
   # Enter the directory to avoid flag errors
   cd .devcontainer
   docker compose up -d
   cd ..
   ```
   *This launches Postgres, Redis, Prometheus, and Grafana in the cloud.*

2. **Terminal 2 (Database Init)**:
   ```bash
   cat backend/schema/db_schema.sql | docker exec -i $(docker ps -qf "name=postgres") psql -U user -d benefit_db
   ```
   *This seeds your data.*

3. **Terminal 3 (Backend API)**:
   ```bash
   cd backend && npm start
   ```

4. **Terminal 4 (Frontend UI)**:
   ```bash
   cd frontend && npm run dev
   ```

---

## 🚇 2. Tunneling to Local (How you see the app)

GitHub Codespaces uses **SSH Tunneling** to securely connect the cloud environment to your local computer.

### **Method A: Web Browser (Automatic)**
1. Go to the **"Ports"** tab in the bottom panel of VS Code.
2. You will see a list (3000, 5000, 3001, etc.).
3. Click the **Local Address** URL for Port **3000**.
4. GitHub will open a special URL like `https://name-3000.app.github.dev`. This is your secure tunnel.

### **Method B: VS Code Desktop (Recommended)**
If you prefer your local VS Code application:
1. Open your repository on GitHub.
2. Click **<> Code** -> **Codespaces** -> **... (Three dots)** -> **Open in VS Code Desktop**.
3. Now, your local VS Code will connect to the cloud.
4. **The Best Part**: Your local VS Code will automatically tunnel `localhost:3000` to the cloud. You can just open `localhost:3000` in your Chrome/Edge browser!

---

## 🛠️ 3. Testing the "Cloud Link"

To prove the frontend is talking to the backend across the tunnel:
1. Open your browser's **Developer Tools (F12)**.
2. Go to the **Network** tab.
3. Refresh the page. You will see API calls going to your `-5000.app.github.dev` address. 
4. My `api/client.js` code handles this logic automatically so you don't have to change any config.

---

## 🚦 4. Critical: Port Visibility
If you get a "404" or "Refused" error:
1. Go to the **Ports** tab.
2. Right-click on Port **3000** and **5000**.
3. Select **Port Visibility** -> **Public**.
4. *Note: "Public" just means anyone with the URL can see it; it's still protected by GitHub's authentication by default unless you explicitly change settings.*
