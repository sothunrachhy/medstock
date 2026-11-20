# MedStock — ប្រព័ន្ធគ្រប់គ្រងស្តុក និងរបាយការណ៍ឱសថ

Frontend of the medicine stock, usage and reporting system for **ផ្នែកប្រពោធនកម្មសល្យសាស្ត្រ, មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត**.

Staff record each stock delivery and each medicine given to a patient once. Every report (daily, weekly, monthly, narcotic register) is then calculated by the backend, and the frontend prints it in the same layout as the paper forms.

**This folder holds the frontend only** (React + Vite + Tailwind CSS). The backend is the FastAPI
service **msm_api** (PostgreSQL). Its OpenAPI page (`/docs` on a non-production API server) is the
API contract; every call the frontend makes goes through one file, [`src/lib/backend.js`](src/lib/backend.js).

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Admitted patients, units used today, low and out-of-stock medicines, near-expiry batches, 14-day usage chart, stock status per category, most used medicines this month |
| **Patients** | Patient table with search by name, ID or diagnosis. Add patients with name, sex, age, diagnosis, province, date in and date out. Each patient's page shows everything they received |
| **Medicine usage** | Record the medicines given to a patient, several lines at once, with shift, payment (cash, ប.ស.ស / NSSF card, បណ្ណក្រីក្រ / IDPoor card), doctor and note. Narcotics require the doctor's name. Stock is taken from the batch that expires first |
| **Stock** | One tab each for injections, pills and narcotics (Morphine, Fentanyl). Insert new stock (quantity, input date, expiry date, batch number); correct, delete or write off batches; see every movement |
| **Medicine list** | Add or edit medicines, their form and strength, and the minimum stock level used for alerts |
| **Reports** | Weekly usage and request report, daily stock report, daily sheet per patient, narcotic register, medicine report and patient report (daily, weekly or monthly). Print on A4 landscape or export to Excel |
| **Settings** | Users, roles with read / create / update / delete permissions per module, login history, change password |

Forms (new patient, record usage, stock in, medicine, user, role) open as a panel on the right side of the screen.

## Requirements

- Node.js 18 or newer
- The msm_api backend running (locally: `http://127.0.0.1:8000`)

## Run locally

```bash
npm install
npm run dev             # http://localhost:5173
```

During development, Vite forwards every `/api/...` request to the backend on your computer,
`http://127.0.0.1:8000` by default. To use another address, create a `.env` file next to
`package.json` (see `.env.example`):

```bash
API_PROXY_TARGET=http://127.0.0.1:8080
```

For a local backend, set `COOKIE_SECURE=false` in its `.env` (the dev site runs on `http://`), and
create the first admin with `python scripts/create_admin.py <username>` in the msm_api folder.

## How login works

- `POST /api/v1/auth/login` returns a short-lived access token. The frontend keeps it **in memory
  only** and sends it as `Authorization: Bearer <token>`.
- The backend also sets an HttpOnly refresh cookie (the page can't read it) and a readable CSRF
  cookie. When the access token expires, or after a page reload, the frontend calls
  `/auth/refresh` once with the CSRF value in `X-CSRF-Token` and retries the request.
- If the refresh fails, the user is sent back to the login page.
- What the menu and buttons show follows the user's role permissions from `/auth/me`; the backend
  checks the same permissions on every request.

## Connecting to the API

The browser sends requests to **`VITE_API_URL`**, which defaults to `/api/v1` on the same domain as
the website. The variable is read when the site is **built**, so change it in Vercel and then
redeploy.

| Where the API runs | What to set |
|---|---|
| Behind the same domain, under `/api` (recommended) | Add a Vercel rewrite in front of the SPA rule in `vercel.json`: `{ "source": "/api/:path*", "destination": "https://<api-server>/api/:path*" }`. The browser stays on one domain, so the login cookies, CORS and the CSP need no change. |
| On another domain, e.g. `https://api.example.com` | 1. Set `VITE_API_URL=https://api.example.com/api/v1`. 2. Add `https://api.example.com` to `connect-src` in the `Content-Security-Policy` header in `vercel.json`. 3. In the API: list the website in `WHITE_LIST_CORS`, and the two sites must share a parent domain with `COOKIE_DOMAIN` set to it, so the CSRF cookie is readable by the website. |

## Deploy on Vercel

The project is ready for Vercel (`vercel.json`): the build output `dist` is served as
static files, every page path falls back to `index.html`, and `/api/...` is left free for the API.

1. *Add New → Project* → import the GitHub repo. **Root Directory** is the folder that holds
   `package.json` (the repo root here; `frontend` if this sits inside a larger repo). The build
   settings come from `vercel.json`.
2. Connect the API (see above). Deploy.

Every push to `main` deploys automatically.

**Security headers** (Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy,
Permissions-Policy) are set in `vercel.json`. If you add an external script, font or API, add its
origin to the CSP there.

## Customising

- Hospital and department names printed on reports: `src/config/org.js`
- Labels for categories, payment types, roles and permission modules: `src/app/LangContext.jsx`
- Medicine forms, payment types and the medicine catalogue come from the backend database.

## Project structure

```
  src/main.jsx          entry: router + providers
  src/app/              App (routes), language and toast providers
  src/features/         one folder per screen:
                        auth, dashboard, patients, usage, stock, medicines, reports, settings
  src/components/       shared UI: ui/ (Modal side panel, Select, Tabs, Pagination...), layout/, brand/ (logo, flags), pickers
  src/lib/api.js        HTTP client: access token, refresh + CSRF, error messages
  src/lib/backend.js    every backend call, and the conversion between backend and screen shapes
  src/lib/              date and Khmer helpers, Excel export, form validation
  src/shared/           input rules (Zod schemas) and the safe login redirect
  src/config/org.js     hospital names printed on reports
  vercel.json           build, routing and security headers for Vercel
  eslint.config.js      lint rules
```

Imports use the `@/` alias for `src`, and `@shared/` for `src/shared`.

### How screens talk to the backend

Screens never build URLs. They call functions such as `patients.list()`, `usage.record()` or
`reports.stockSummary()` from `src/lib/backend.js`, which:

- sends the backend's field names (`full_name`, `payment_code`, `tabs=TABLET,INJECTION`, `limit/offset`),
- unwraps the `{ trace_id, status, message, data, total }` envelope,
- converts the answer to the shapes the screens use (`_id`, `name`, categories `INJECTION` / `PILL` /
  `NARCOTIC`, page numbers).

When the backend changes a field, only that file needs updating.

### Validation

Forms check their input with the Zod schemas in `src/shared/schemas/` before sending, and
show errors under each field. Validation errors returned by the backend (422) are shown the same
way. The backend still checks everything itself.

### Performance

Each screen is a separate file loaded the first time it is opened (`React.lazy` in
`src/app/App.jsx`). React and the router are in their own long-cached file, and the charts
library loads only with the dashboard. Files in `/assets` have a content hash in their name and are
cached for a year; `index.html` is always checked for a new version.

### Quality checks

```bash
npm run lint     # ESLint
npm run check    # lint + production build
```
