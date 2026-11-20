# MedStock — ប្រព័ន្ធគ្រប់គ្រងស្តុក និងរបាយការណ៍ឱសថ

Frontend of the medicine stock, usage and reporting system for **ផ្នែកប្រពោធនកម្មសល្យសាស្ត្រ, មន្ទីរពេទ្យមិត្តភាពខ្មែរ-សូវៀត**.

Staff record each stock delivery and each medicine given to a patient once. Every report (daily, weekly, monthly, narcotic register) is then calculated by the API, and the frontend prints it in the same layout as the paper forms.

**This folder holds the frontend only** (React + Vite + Tailwind CSS). The backend API is
built separately. Every endpoint, field and rule the frontend expects is described in
**[API.md](API.md)**; an API that follows it works with this frontend without changes.

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Admitted patients, units used today, low and out-of-stock medicines, near-expiry batches, 14-day usage chart, stock status per category, most used medicines this month |
| **Patients** | Patient table with search by name, ID or diagnosis. Add patients with name, sex, age, diagnosis, province, date in and date out. Each patient's page shows everything they received |
| **Medicine usage** | Record the medicines given to a patient, several lines at once, with shift, payment (cash, ប.ស.ស / NSSF card, បណ្ណក្រីក្រ / IDPoor card), doctor and note. Narcotics require the doctor's name |
| **Stock** | One tab each for injections, pills and narcotics (Morphine, Fentanyl). Insert new stock (name, quantity, input date, expiry date, batch number); edit or write off batches |
| **Medicine list** | Add or edit medicines, their form and strength, and the minimum stock level used for alerts |
| **Reports** | Weekly usage and request report, daily stock report, daily sheet per patient, narcotic register, medicine report and patient report (daily, weekly or monthly). Print on A4 landscape or export to Excel |
| **Settings** | Users, roles with read / create / update / delete permissions per section, login history, auth settings (session timeout, password length, account lockout), change password |

## Requirements

- Node.js 18 or newer
- A running MedStock API (see [API.md](API.md))

## Run locally

```bash
npm install
npm run dev             # http://localhost:5173
```

During development, Vite forwards every `/api/...` request to the API on your computer,
`http://localhost:5000` by default. To use another address, create a `.env` file next to
`package.json` (see `.env.example`):

```bash
API_PROXY_TARGET=http://localhost:8080
```

## Connecting to the API

The browser sends requests to **`VITE_API_URL`**, which defaults to `/api` on the same domain as
the website. The variable is read when the site is **built**, so change it in Vercel and then
redeploy.

| Where the API runs | What to set |
|---|---|
| Same domain, under `/api` (recommended) | Nothing. |
| Another domain, e.g. `https://api.example.com` | 1. Set `VITE_API_URL=https://api.example.com/api`. 2. Add `https://api.example.com` to `connect-src` in the `Content-Security-Policy` header in `vercel.json`. 3. The API must allow CORS from the website's domain. |
| Another domain, but you want to keep `/api` | Add a Vercel rewrite in front of the SPA rule in `vercel.json`: `{ "source": "/api/:path*", "destination": "https://api.example.com/api/:path*" }`. The browser stays on one domain, so there is no CORS or CSP change. |

The browser keeps the login token in `localStorage` and sends it as `Authorization: Bearer <token>`.
Any 401 response sends the user back to the login page.

## Deploy on Vercel

The project is ready for Vercel (`vercel.json`): the build output `dist` is served as
static files, every page path falls back to `index.html`, and `/api/...` is left free for the API.

1. *Add New → Project* → import the GitHub repo. **Root Directory** is the folder that holds
   `package.json` (the repo root here; `frontend` if this sits inside a larger repo). The build
   settings come from `vercel.json`.
2. Set `VITE_API_URL` only if the API is on another domain (see above). Deploy.

Every push to `main` deploys automatically.

**Security headers** (Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy,
Permissions-Policy) are set in `vercel.json`. If you add an external script, font or API, add its
origin to the CSP there.

## Customising

- Hospital and department names printed on reports: `src/config/org.js`
- Labels for categories, payment types and permissions: `src/app/LangContext.jsx`

## Project structure

```
  API.md                the API contract for the backend
  src/main.jsx          entry: router + providers
  src/app/              App (routes), language and toast providers
  src/features/         one folder per screen:
                        auth, dashboard, patients, usage, stock, medicines, reports, settings
  src/components/       shared UI: ui/ (Modal, Select, Tabs, Pagination...), layout/, brand/ (logo, flags), pickers
  src/lib/              API client (api.js), date and Khmer helpers, Excel export, form validation
  src/shared/           input rules (Zod schemas) and the safe login redirect
  src/config/org.js     hospital names printed on reports
  vercel.json           build, routing and security headers for Vercel
  eslint.config.js      lint rules
```

Imports use the `@/` alias for `src`, and `@shared/` for `src/shared`.

### Validation

Forms check their input with the Zod schemas in `src/shared/schemas/` before sending, and
show errors under each field. Errors returned by the API in the `fields` object are shown the same
way (see *Errors* in [API.md](API.md)). The API must still check everything itself.

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
