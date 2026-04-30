# ABM Blinder + Liberty CAD CRM

Internal app: ABM Blinder (managed outbound campaigns) and Liberty CAD CRM
(tracks responders from Smartlead/HeyReach and recurring follow-ups).

Stack: FastAPI + MongoDB (Motor) backend, React (CRA/craco) + Tailwind +
Shadcn frontend, JWT auth.

---

## Prereqs

- **Python** 3.10+
- **Node** 18+ and **npm** (or yarn)
- **MongoDB** 6+ running locally (or any Mongo URI you have access to)
  - macOS: `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`
  - Ubuntu: follow https://www.mongodb.com/docs/manual/administration/install-on-linux/
  - Or run via Docker: `docker run -d -p 27017:27017 --name mongo mongo:7`

---

## 1. Configure environment

Create `backend/.env`:

```
MONGO_URL=mongodb://localhost:27017
DB_NAME=liberty_crm
JWT_SECRET=change-me-to-a-long-random-string
CORS_ORIGINS=http://localhost:3000
```

Create `frontend/.env`:

```
REACT_APP_BACKEND_URL=http://localhost:8000
```

> Both files are gitignored.

---

## 2. Install + run backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

On first start the backend creates a default super-admin:

- email: `srihariramasheshu@gmail.com`
- password: `superadmin123`

(Change it immediately in production.)

---

## 3. Install + run frontend

In a second terminal:

```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000, log in as super admin, then:
- Create seat/admin accounts under **Users & Approvals**, or
- Have teammates self-signup at `/signup` and approve them

The CRM lives at **/crm** (sidebar → "Liberty CAD CRM").

---

## 4. Sharing with your team

### Option A — Same Wi-Fi / office network (easiest)

1. Find your machine's LAN IP (`ipconfig getifaddr en0` on macOS,
   `hostname -I` on Linux, `ipconfig` on Windows). Example: `192.168.1.42`.
2. In `frontend/.env`, change `REACT_APP_BACKEND_URL` to
   `http://192.168.1.42:8000`.
3. In `backend/.env`, change
   `CORS_ORIGINS=http://192.168.1.42:3000,http://localhost:3000`.
4. Restart both servers (backend already binds to `0.0.0.0`).
5. Teammates open `http://192.168.1.42:3000` from their browsers.
6. Make sure your firewall allows inbound TCP on ports 3000 and 8000.

### Option B — Remote teammates (use a tunnel)

Use [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
or [ngrok](https://ngrok.com/) to expose both services. With ngrok:

```bash
# Terminal 1
ngrok http 8000
# Terminal 2
ngrok http 3000
```

Take the two HTTPS URLs ngrok prints, then:
- set `REACT_APP_BACKEND_URL=https://<backend-tunnel>.ngrok-free.app` in `frontend/.env`
- set `CORS_ORIGINS=https://<frontend-tunnel>.ngrok-free.app` in `backend/.env`

Restart both servers and share the frontend tunnel URL.

> Tunnels are fine for testing; for production deploy backend + frontend
> on a real host (Render, Fly, Railway, your own VM, etc.) and put both
> behind HTTPS.

---

## Smoke test (CRM)

1. Sign in as super admin.
2. Sidebar → **Liberty CAD CRM** → **CRM Dashboard**.
3. Click **Add Responder**, fill in name + source (Smartlead/HeyReach) → Save.
4. Open the responder, **Schedule Follow-up** for today, then mark it **Done**.
5. Visit **Follow-ups** to see Today / Overdue / Next 7 Days tabs.
6. Have a teammate log in and confirm they see the same responder.

---

## Common issues

- **`ModuleNotFoundError: motor`** — you forgot to activate the venv before `pip install`.
- **Frontend shows "Network Error" / CORS** — `REACT_APP_BACKEND_URL` is wrong, or your
  current origin isn't in `CORS_ORIGINS`. Restart backend after editing `.env`.
- **Login fails with 401** on first run — wait for the backend log line
  `Created super admin: srihariramasheshu@gmail.com` before logging in.
- **Mongo connection refused** — Mongo isn't running. `brew services list` /
  `systemctl status mongod` / `docker ps`.
