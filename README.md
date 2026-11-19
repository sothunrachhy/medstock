# MedStock — ប្រព័ន្ធគ្រប់គ្រងស្តុក និងរបាយការណ៍ឱសថ

Medicine stock, usage and reporting system for **ផ្នែកប្រពោធនកម្មសល្យសាស្ត្រ, មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត**.

Staff record each stock delivery and each medicine given to a patient once. Every report (daily, weekly, monthly, narcotic register) is then calculated automatically and printed in the same layout as the paper forms.

**Stack:** MongoDB · Express (Node.js) · React + Vite · Tailwind CSS

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Admitted patients, units used today, low / out-of-stock, near-expiry batches, 14-day usage chart, stock status per category, top used medicines this month |
| **Patients** | Patient table with search by name / ID / diagnosis. Add patients with name, sex, age, diagnosis, province, date in and date out. Each patient's page shows everything they received |
| **Medicine usage** | Record the medicines given to a patient (several lines at once). Stock is taken from the batch that expires first. Narcotics require the doctor's name. Deleting a record puts the quantity back into stock |
| **Stock** | One tab each for injections, pills and narcotics (Morphine / Fentanyl). Shows balance, nearest expiry and status. **Insert new stock** takes name, quantity, input date (default today), expiry date and batch number. Batches can be edited or written off (expired / damaged / adjustment) |
| **Medicine list** | Add or edit medicines, their form and strength, and the minimum stock level used for alerts |
| **Reports** | Weekly usage & request report (with editable ចំនួនស្នើសុំ / ចំនួនផ្ដល់), daily stock report, daily sheet per patient, narcotic register, medicine report and patient report (daily / weekly / monthly). All can be printed (A4 landscape) or exported to Excel |
| **Settings** | Users, roles with read / create / update / delete per section, login history (successful and failed logins, IP address, device, logout time), **Auth** (session timeout, minimum password length, account lockout after repeated wrong passwords, admin unlock), and change password |

The medicine list is pre-loaded from the templates: 102 injections and 44 pills. Fentanyl and Morphine are stored as narcotics.

## Requirements

- Node.js 18 or newer
- MongoDB 6 or newer: a local install, Docker, or a MongoDB Atlas connection string

## Setup

```bash
# 1. install everything
npm run install:all

# 2. configure the API
cp server/.env.example server/.env      # Windows: copy server\.env.example server\.env
#    then edit server/.env: set MONGO_URI and a long random JWT_SECRET

# 3. create roles, the admin account and the medicine list
npm run seed
#    or, to try the system with sample stock, patients and 14 days of usage:
npm run seed:demo

# 4. start the API (port 5000) and the web app (port 5173)
npm run dev
```

Open http://localhost:5173 and sign in as **admin / admin123**. **Change this password right away** under *Settings → My account*.

To start MongoDB quickly with Docker:

```bash
docker run -d --name medstock-mongo -p 27017:27017 -v medstock-data:/data/db mongo:7
```

## Production

```bash
npm run build     # builds client/dist
npm start         # Express serves the API and the built app on PORT (default 5000)
```

If the app runs behind nginx or another proxy, set `TRUST_PROXY=1` so the login history records the real client IP.

**Security headers** (Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are defined once in `server/src/config/security.js`. Express sends them through helmet, and `vercel.json` repeats them for the static files Vercel serves (a test fails if the two drift apart). API responses are sent with `Cache-Control: no-store`. If you add a new external script, font or API, add its origin to the CSP in both places.

**CORS:** in production the API only accepts same-origin requests unless `CLIENT_ORIGIN` lists other allowed origins (comma-separated).

## Deploy on Vercel

The repo is ready for Vercel (`vercel.json`). The React app is served as static files and the Express API runs as one serverless function (`api/index.js` → `server/src/app.js`). Both are on the same domain, so the client needs no environment variables.

1. **Database:** create a MongoDB Atlas cluster (choose the Singapore region, close to Vercel's `sin1`).
   - *Database Access*: add a database user with a strong password.
   - *Network Access*: allow `0.0.0.0/0` (Vercel has no fixed IP addresses).
   - Copy the connection string and add the database name: `mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/medstock?retryWrites=true&w=majority`
2. **Seed the database once** from your computer (creates roles, the admin user and the medicine list):
   ```bash
   # Windows PowerShell
   $env:MONGO_URI="mongodb+srv://..."; $env:ADMIN_PASSWORD="a-strong-password"; npm run seed
   # macOS / Linux
   MONGO_URI="mongodb+srv://..." ADMIN_PASSWORD="a-strong-password" npm run seed
   ```
   `ADMIN_PASSWORD` is required here (at least 8 characters); the seed refuses to create an admin with the default password on a non-local database, and never prints the password. `seed:demo` refuses to add sample patients to a non-local database.
3. **Vercel:** *Add New → Project* → import the GitHub repo. Leave *Root Directory* as the repo root; the build settings come from `vercel.json`.
4. **Environment variables** (*Settings → Environment Variables*), then deploy:

   | Name | Value |
   |---|---|
   | `MONGO_URI` | the Atlas connection string |
   | `JWT_SECRET` | a long random string (e.g. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
   | `TRUST_PROXY` | `1` |
   | `EXPIRY_WARN_DAYS` | optional, default `90` |

5. Open the Vercel URL, sign in as `admin`, and change the password under *Settings → My account*.

Every push to `main` deploys automatically. Notes: the login rate limiter is per serverless instance (account lockout after wrong passwords is stored in the database and still applies everywhere); function time is limited to 30 s, which is plenty for the reports.

## How stock is calculated

- **Stock in (ចំណូល)** creates a *batch* with a quantity and an expiry date.
- **Usage (ចំណាយ)** is taken from the batches that expire first. Expired batches are never dispensed; write them off from the stock page. A usage cannot exceed the available stock, so balances never go negative.
- Report columns for a date range:
  `ដើមគ្រា (opening) + ចំណូល (received) − ចំណាយ (used) − write-offs = ចំនួនសល់ (closing)`
- Weeks run Monday to Sunday. All dates use Cambodia time (UTC+7).

## Default roles

| Role | Access |
|---|---|
| Admin | Everything. Cannot be edited or deleted |
| Pharmacist | Medicine list, stock in/out, usage and reports (can save weekly requests) |
| Nurse | Register and edit patients, record usage, view stock and reports |
| Viewer | Read-only dashboard, patients, stock and reports |

You can create more roles under *Settings → Roles & permissions*.

## Customising

- Hospital and department names printed on reports: `client/src/config/org.js`
- Near-expiry warning window: `EXPIRY_WARN_DAYS` in `server/.env` (default 90 days)
- Low-stock threshold: the *Min stock* value of each medicine in **Medicine list**

## Project structure

```
api/index.js           Vercel serverless entry (loads server/src/app.js)
server/                Express API (layered)
  src/app.js           builds the Express app (used by local server and Vercel)
  src/index.js         local / VPS entry: connects MongoDB and listens on PORT
  src/config/          db connection, permissions (modules × actions)
  src/middleware/      auth (JWT + permissions), error handler
  src/models/          Medicine, StockBatch, StockOut, Patient, Requisition, User, Role, LoginHistory, Setting
  src/routes/          one router per API area (auth, users, roles, patients, stock, usage, reports, ...)
  src/services/        stock allocation (first-expiry-first-out), auth settings
  src/seed/            roles, admin user, medicine list from the paper templates, demo data
  tests/               Vitest + supertest
client/                React + Vite app (feature-based)
  src/main.jsx         entry: router + providers
  src/app/             App (routes), language and toast providers
  src/features/        one folder per screen/domain:
                       auth, dashboard, patients, usage, stock, medicines, reports, settings
  src/components/      shared UI: ui/ (Modal, Select, Tabs, Pagination...), layout/, brand/ (logo, flags), pickers
  src/lib/             API client, date and Khmer helpers, Excel export
  src/config/org.js    hospital names printed on reports
```

Imports inside the client use the `@/` alias for `client/src` (e.g. `import { Modal } from '@/components/ui'`).
Files in the same feature folder import each other with `./`.

### Quality checks

```bash
npm run lint     # ESLint (client + server)
npm test         # Vitest (server/tests); integration tests use the medstock_test database
npm run check    # lint + test + build
```
