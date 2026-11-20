# MedStock API contract

This is the HTTP API the MedStock frontend (this `frontend/` folder) calls. A backend that implements
everything below works with the frontend without changing frontend code.

- [Conventions](#conventions): base URL, auth, IDs, dates, paging, errors
- [Data types](#data-types): User, Role, Patient, Medicine, Batch, Usage record
- Endpoints: [Auth](#auth) · [Dashboard](#dashboard) · [Patients](#patients) · [Medicines](#medicines) ·
  [Stock](#stock) · [Usage](#usage) · [Reports](#reports) · [Users](#users) · [Roles](#roles) ·
  [Login history](#login-history)
- [Business rules](#business-rules) the frontend relies on

---

## Conventions

### Base URL

The frontend sends every request to `VITE_API_URL` (default `/api`, same origin). Paths below
are relative to it: `GET /patients` means `GET {VITE_API_URL}/patients`.

Requests and responses are JSON (`Content-Type: application/json`). Responses to API calls should
send `Cache-Control: no-store`, because they contain patient data.

If the API runs on a different domain from the frontend, it must allow CORS from the frontend's
origin, including the `Authorization` header and the `GET, POST, PUT, DELETE` methods.

### Authentication

- `POST /auth/login` returns a `token`. The frontend stores it and sends it on every request as
  `Authorization: Bearer <token>`. The format of the token is up to the backend (JWT or opaque).
- When any request except `/auth/login` returns **401**, the frontend deletes the token and shows
  the login page. Return 401 for: no token, invalid or expired token, logged-out session, or a
  disabled account.
- Return **403** when the user is logged in but lacks the permission. The frontend shows `message`.

### Permissions

Each user has one role. A role either has `isSystem: true` (the built-in Admin, full access) or a
list of permissions:

```json
{ "module": "patients", "actions": ["read", "create", "update", "delete"] }
```

| Modules | Actions |
|---|---|
| `dashboard`, `patients`, `medicines`, `stock`, `usage`, `reports`, `users`, `roles`, `loginHistory`, `authSettings` | `read`, `create`, `update`, `delete` |

The frontend hides screens and buttons with the same rule, but the API must enforce it. The
permission needed by each endpoint is listed below as **Permission: module.action**.

### IDs

Records are identified by a string ID, sent back as **`_id`**. Two exceptions, both from the
current implementation:

- **User** objects use **`id`**, and so does the `role` object inside a user.
- **Role** objects in `GET /roles` carry both `_id` and `id`, with the same value.

### Dates

The hospital works in **Cambodia time (Asia/Phnom_Penh, UTC+7)**, and every "day" means a
Cambodia calendar day.

- **Request fields and query parameters** with dates are days, written `YYYY-MM-DD`, e.g. `2026-11-20`.
- **Day fields in responses** (`dateIn`, `dateOut`, `date`, `receivedDate`, `expiryDate`) may be
  returned as `YYYY-MM-DD` or as an ISO date-time. The frontend converts ISO values to the
  Cambodia day, so `2026-11-19T17:00:00.000Z` (midnight in Phnom Penh) shows as 20/11/2026.
- **Timestamps** (`createdAt`, `updatedAt`, `loginAt`, `logoutAt`, `lastLoginAt`, `lockedUntil`)
  are ISO date-times.
- A date range `from`–`to` is **inclusive** of both days.

### Paged lists

Endpoints marked *paged* accept `?page=1&limit=50` and return:

```json
{ "items": [ ... ], "total": 134, "page": 1, "limit": 50 }
```

`page` starts at 1. `total` is the count of all matching records, used for the page numbers.

### Categories

Medicines have one category: `INJECTION` (ថ្នាំចាក់), `PILL` (ថ្នាំគ្រាប់) or `NARCOTIC`
(ថ្នាំញៀន: Morphine, Fentanyl). A `categories` parameter is a comma-separated list such as
`INJECTION,NARCOTIC`. If it is missing or empty, use all three.

### Errors

Every error response has this shape:

```json
{
  "message": "Patient name is required",
  "code": "VALIDATION_ERROR",
  "fields": { "name": "Patient name is required", "items.0.quantity": "Quantity must be at least 1" }
}
```

| Field | Required | Used by the frontend for |
|---|---|---|
| `message` | yes | Shown to the user as a notification. Write it for a nurse to read. |
| `code` | no | Not read by the frontend; useful for logs. |
| `fields` | no | Error text shown under each form field. Keys are the request field names; rows in an `items` list are written `items.<index>.<field>`. |

| Status | When |
|---|---|
| 400 | Invalid input (`fields` recommended) or a broken business rule |
| 401 | Not logged in or session ended (the frontend returns to the login page) |
| 403 | Missing permission |
| 404 | Record not found |
| 409 | Conflict, e.g. deleting a record that is still in use, or a duplicate |
| 423 | Account locked after too many failed logins |
| 429 | Too many login attempts |
| 503 | Database or another service is down; `message` says to try again later |

---

## Data types

### User

```json
{
  "id": "665f…",
  "username": "sokha",
  "fullName": "Sok Kha",
  "isActive": true,
  "lastLoginAt": "2026-11-20T01:15:00.000Z",
  "lockedUntil": null,
  "createdAt": "2026-01-03T08:00:00.000Z",
  "role": {
    "id": "665e…",
    "name": "Nurse",
    "isSystem": false,
    "permissions": [{ "module": "usage", "actions": ["read", "create"] }]
  }
}
```

`lockedUntil` is a date-time only while the account is locked; otherwise it is `null`. A user
never includes the password or its hash.

### Role

```json
{
  "_id": "665e…", "id": "665e…",
  "name": "Nurse",
  "description": "Records usage",
  "isSystem": false,
  "permissions": [{ "module": "usage", "actions": ["read", "create"] }],
  "userCount": 4
}
```

`userCount` is the number of users with this role. Only `GET /roles` returns it.

### Patient

```json
{
  "_id": "6660…",
  "code": "KS-2026-0012",
  "name": "សុខ ដារ៉ា",
  "sex": "M",
  "age": 42,
  "diagnosis": "Burn 30%",
  "province": "Kandal",
  "dateIn": "2026-11-17",
  "dateOut": null,
  "status": "ADMITTED",
  "note": "",
  "createdAt": "…", "updatedAt": "…"
}
```

| Field | Rules |
|---|---|
| `code` | Optional hospital ID, ≤ 40 characters |
| `name` | Required, ≤ 120 characters |
| `sex` | `M` or `F` |
| `age` | Whole number 0–150, or `null` |
| `diagnosis` | ≤ 500 characters |
| `province` | ≤ 120 characters |
| `dateIn`, `dateOut` | `dateOut` cannot be before `dateIn` |
| `status` | `ADMITTED` or `DISCHARGED` |
| `note` | ≤ 500 characters |

### Medicine

```json
{
  "_id": "6661…",
  "name": "Morphine",
  "form": "Amp",
  "strength": "10mg",
  "category": "NARCOTIC",
  "order": 3,
  "minStock": 10,
  "isActive": true,
  "note": ""
}
```

`order` is the row number (ល.រ) used to sort medicines the same way as the paper reports. The
combination of name, form, strength and category is unique.

**With stock information** (`?withStock=1`), each medicine also has:

| Field | Meaning |
|---|---|
| `balance` | Total remaining quantity in all batches |
| `usable` | `balance` minus the quantity in expired batches |
| `status` | `OUT` if `usable` ≤ 0, `LOW` if `usable` ≤ `minStock`, otherwise `OK` |
| `expiredQty` | Remaining quantity in batches past their expiry date |
| `expiringQty` | Remaining quantity that expires within the warning period (default 90 days) |
| `nearestExpiry` | Earliest expiry date among batches that have not expired, or `null` |
| `batches` | Number of batches with stock left |

### Batch (stock in, ចំណូល)

```json
{
  "_id": "6662…",
  "medicine": { "_id": "6661…", "name": "Morphine", "form": "Amp", "strength": "10mg", "category": "NARCOTIC" },
  "quantity": 100,
  "remaining": 64,
  "receivedDate": "2026-11-01",
  "expiryDate": "2027-06-30",
  "batchNo": "MX231",
  "source": "Central pharmacy",
  "note": "",
  "createdBy": { "fullName": "Sok Kha" },
  "createdAt": "…"
}
```

`quantity` is what was received. `remaining` is what is left after usage and write-offs.

### Usage record (ចំណាយ) and write-off

One record holds one medicine given to one patient on one day, or a write-off of stock.

```json
{
  "_id": "6663…",
  "type": "USAGE",
  "medicine": { "_id": "6661…", "name": "Morphine", "form": "Amp", "strength": "10mg", "category": "NARCOTIC" },
  "patient": { "_id": "6660…", "name": "សុខ ដារ៉ា", "sex": "M", "age": 42 },
  "date": "2026-11-20",
  "quantity": 2,
  "shift": "NIGHT",
  "payment": "HEF",
  "doctor": "វេជ្ជ. ចាន់ វិបុល",
  "note": "",
  "createdBy": { "fullName": "Sok Kha" },
  "createdAt": "2026-11-20T13:02:11.000Z"
}
```

| Field | Values |
|---|---|
| `type` | `USAGE` (given to a patient), or a write-off: `EXPIRED`, `DAMAGED`, `ADJUSTMENT` |
| `shift` | `DAY`, `NIGHT` or `""` |
| `payment` | `CASH` (សាច់ប្រាក់: riel or dollar), `NSSF` (បណ្ណ ប.ស.ស), `HEF` (បណ្ណមូលនិធិសមធម៌សុខាភិបាល, IDPoor). Required on new usage records; older records may have `""`. |
| `doctor` | ≤ 120 characters; required when the medicine is `NARCOTIC` |

Write-offs have no `patient`, `shift`, `payment` or `doctor`.

---

## Auth

### `POST /auth/login`

No token needed.

Request: `{ "username": "admin", "password": "…" }`. Usernames are case-insensitive.

200 response: `{ "token": "…", "user": User }`

| Error | Status |
|---|---|
| Wrong username or password | 401 `"Invalid username or password"`. Use the same text for both, so it doesn't reveal which usernames exist. |
| Account disabled | 403 |
| Account locked | 423, with a message that says how many minutes remain |
| Too many attempts from one address | 429 |

Record every attempt, successful or not, in the login history. Lock the account after
`maxFailedAttempts` failed logins in a row for `lockoutMinutes` (see
[auth settings](#get-authsettings)). `maxFailedAttempts: 0` means never lock.

### `GET /auth/me`

Returns `{ "user": User }` for the token. The frontend calls it on page load to restore the
session; a 401 sends the user to the login page.

### `GET /auth/policy`

Any logged-in user. Returns `{ "minPasswordLength": 6 }`, which the password forms use as a hint.

### `POST /auth/logout`

Ends the current session, so this token is refused from now on. Returns `{ "ok": true }`.

### `POST /auth/change-password`

Request: `{ "currentPassword": "…", "newPassword": "…" }`

- 400 if the current password is wrong, or the new one equals it or is shorter than `minPasswordLength`.
- On success, ends **all other** sessions of this user and returns a new token for this one:
  `{ "ok": true, "token": "…" }`. The frontend replaces its stored token with it.

### `GET /auth/settings`

**Permission: authSettings.read**. Returns:

```json
{ "sessionTimeoutHours": 12, "minPasswordLength": 6, "maxFailedAttempts": 5, "lockoutMinutes": 15 }
```

### `PUT /auth/settings`

**Permission: authSettings.update**. The request contains any of the fields above, as whole
numbers within these ranges; the response is the full settings object.

| Field | Range | Effect |
|---|---|---|
| `sessionTimeoutHours` | 1–720 | A login expires this many hours after it starts, including sessions that are already open. |
| `minPasswordLength` | 4–64 | Applies to new passwords. |
| `maxFailedAttempts` | 0–50 | 0 = never lock accounts. |
| `lockoutMinutes` | 1–1440 | How long an account stays locked. |

---

## Dashboard

### `GET /dashboard`

**Permission: dashboard.read**

```json
{
  "today": "2026-11-20",
  "expiryWarnDays": 90,
  "kpis": {
    "medicines": 84, "admitted": 37, "admittedToday": 3,
    "usageToday": 212, "usageEntriesToday": 96, "patientsTreatedToday": 31,
    "lowStock": 6, "outOfStock": 2, "expiringBatches": 4, "expiredBatches": 1
  },
  "stockByCategory": [
    { "category": "INJECTION", "OK": 50, "LOW": 4, "OUT": 1, "total": 55 },
    { "category": "PILL", "OK": 20, "LOW": 2, "OUT": 1, "total": 23 },
    { "category": "NARCOTIC", "OK": 6, "LOW": 0, "OUT": 0, "total": 6 }
  ],
  "lowStock": [ { "_id": "…", "name": "…", "form": "…", "strength": "…", "category": "PILL", "minStock": 10, "balance": 4, "usable": 4, "status": "LOW", "nearestExpiry": "…" } ],
  "expiring": [ Batch ],
  "trend": [ { "date": "2026-11-07", "INJECTION": 120, "PILL": 30, "NARCOTIC": 2, "admissions": 4 } ],
  "topUsed": [ { "name": "Ceftriaxone 1g", "category": "INJECTION", "quantity": 340 } ]
}
```

| Field | Meaning |
|---|---|
| `kpis.medicines` | Active medicines |
| `kpis.admitted` | Patients with status `ADMITTED` |
| `kpis.admittedToday` | Patients with `dateIn` today |
| `kpis.usageToday` | Total quantity used today |
| `kpis.usageEntriesToday` | Number of usage records today |
| `kpis.patientsTreatedToday` | Different patients with usage today |
| `kpis.lowStock`, `kpis.outOfStock` | Active medicines with status `LOW` or `OUT` |
| `kpis.expiringBatches` | Batches with stock left that expire within `expiryWarnDays` |
| `kpis.expiredBatches` | Batches with stock left that are past their expiry date |
| `stockByCategory` | Stock status counts per category, always in the order shown |
| `lowStock` | Up to 15 medicines that are `LOW`, or `OUT` but were stocked before; lowest `usable` first |
| `expiring` | Up to 15 batches with stock left expiring before today + `expiryWarnDays` (expired ones included), soonest first |
| `trend` | The last 14 days, oldest first, including days with no usage: quantity used per category and the number of admissions |
| `topUsed` | Top 10 medicines by quantity used this calendar month |

---

## Patients

### `GET /patients` *(paged, default limit 20)*

**Permission: patients.read**

| Query | Meaning |
|---|---|
| `search` | Text in the name, code or diagnosis (case-insensitive, ≤ 100 characters) |
| `status` | `ADMITTED` or `DISCHARGED` |
| `from`, `to` | `dateIn` within these days |

Sort: newest `dateIn` first. The usage form's patient picker also calls this with `search` and a
small `limit`.

### `GET /patients/:id`

**Permission: patients.read**. Returns a Patient, or 404.

### `POST /patients`

**Permission: patients.create**. Request: the Patient fields from the table above. `name` and
`sex` are required; `dateIn` defaults to today. If `dateOut` is set and `status` is not given,
`status` becomes `DISCHARGED`. Returns **201** with the Patient.

### `PUT /patients/:id`

**Permission: patients.update**. Request: any Patient fields; fields that are left out don't
change. `dateOut: ""` or `null` clears the discharge date, and so does `status: "ADMITTED"`.
`age: ""` or `null` clears the age. Returns the Patient.

### `DELETE /patients/:id`

**Permission: patients.delete**. Returns **409** if the patient has any usage records, otherwise
`{ "ok": true }`.

---

## Medicines

### `GET /medicines`

Any logged-in user: the stock, usage and report screens all need the list. Not paged; returns
`{ "items": [Medicine] }`, sorted by category, then `order`, then name.

| Query | Meaning |
|---|---|
| `categories` (or `category`) | Comma-separated categories |
| `active` | Missing or `true`: active only. `false`: inactive only. `all`: both. |
| `search` | Text in the name |
| `withStock` | `1` adds the stock fields (`balance`, `usable`, `status`, …) to each medicine |

### `POST /medicines`

**Permission: medicines.create**. Request: `name` (required, ≤ 120), `form` (≤ 60), `strength`
(≤ 60), `category` (required), `order` (optional whole number; when it is missing, use the last
`order` in that category + 1), `minStock` (whole number, default 10), `isActive`, `note`.
Returns **201** with the Medicine, or **409** if the same name, form, strength and category
already exist.

### `PUT /medicines/:id`

**Permission: medicines.update**. Any fields; returns the Medicine.

### `DELETE /medicines/:id`

**Permission: medicines.delete**. If the medicine has never been stocked or used, delete it and
return `{ "ok": true, "deleted": true }`. Otherwise set `isActive: false`, so old reports stay
correct, and return `{ "ok": true, "deactivated": true }`.

---

## Stock

### `GET /stock/batches` *(paged, default limit 50)*

**Permission: stock.read**

| Query | Meaning |
|---|---|
| `medicine` | Only this medicine's batches |
| `status` | `all` (default), `available` (stock left), `expiring` (stock left and expiring within `days`, default 90), `expired` (stock left and past expiry) |
| `days` | 1–3650, used with `status=expiring` |

Sort: `expiryDate` ascending for `expiring` and `expired`; otherwise newest `receivedDate` first.
Each item is a Batch with `medicine` and `createdBy.fullName` filled in.

### `POST /stock/batches` (insert stock)

**Permission: stock.create**

```json
{ "items": [ { "medicine": "6661…", "quantity": 100, "receivedDate": "2026-11-20", "expiryDate": "2027-06-30", "batchNo": "MX231", "source": "Central pharmacy", "note": "" } ] }
```

- Between 1 and 200 lines. `quantity` is a whole number from 1 to 1,000,000. `receivedDate`
  defaults to today. `expiryDate` is required and must be **after** `receivedDate`.
- A single line sent without the `items` wrapper must also be accepted.
- Errors in line *n* go in `fields` as `items.<n>.<field>`.
- `remaining` starts equal to `quantity`.
- Returns **201** with `{ "items": [Batch] }`.

### `PUT /stock/batches/:id`

**Permission: stock.update**. Request: any of `quantity`, `receivedDate`, `expiryDate`, `batchNo`,
`source`, `note`.

- `quantity` cannot be less than what was already used (`quantity − remaining`); return 400 if it
  is. `remaining` changes by the same amount as `quantity`.
- `expiryDate` must stay after `receivedDate`.

Returns the Batch.

### `DELETE /stock/batches/:id`

**Permission: stock.delete**. Returns **409** if any of the batch has been used or written off
(`remaining ≠ quantity`), otherwise `{ "ok": true }`.

### `POST /stock/writeoff`

**Permission: stock.update**

```json
{ "batch": "6662…", "quantity": 5, "type": "EXPIRED", "date": "2026-11-20", "note": "Broken in transport" }
```

`type` is `EXPIRED` (default), `DAMAGED` or `ADJUSTMENT`; `date` defaults to today. This takes the
quantity out of **that** batch, even if it has expired, and creates a record with this `type`.
Returns 400 if the batch doesn't have enough left. Returns **201** with the record.

### `GET /stock/movements?medicine=<id>&limit=100`

**Permission: stock.read**. All movements of one medicine, newest first (limit up to 500):

```json
{ "items": [
  { "_id": "…", "kind": "IN", "date": "2026-11-01", "quantity": 100, "detail": "Batch MX231 · Central pharmacy", "by": "Sok Kha", "createdAt": "…" },
  { "_id": "…", "kind": "USAGE", "date": "2026-11-20", "quantity": -2, "detail": "សុខ ដារ៉ា", "by": "Sok Kha", "createdAt": "…" }
] }
```

`kind` is `IN` for stock received, or the record `type` for stock going out. Outgoing quantities
are **negative**. `detail` is the batch number and source for stock in, and the patient name (or
the note, for a write-off) for stock out.

---

## Usage

### `GET /usage` *(paged, default limit 50)*

**Permission: usage.read**

| Query | Meaning |
|---|---|
| `from`, `to` | `date` within these days |
| `patient` | Only this patient (the patient page asks for `limit=1000`) |
| `medicine` | Only this medicine |
| `categories` | Only medicines in these categories |
| `payment` | `CASH`, `NSSF` or `HEF` |
| `type` | `USAGE` (default) or a write-off type |

Sort: newest `date` first, then newest `createdAt`. Each item is a Usage record with `medicine`
(`name form strength category`), `patient` (`name sex age`) and `createdBy.fullName` filled in.

When a patient is chosen in the usage form, the frontend also calls
`GET /usage?patient=<id>&limit=1` and pre-selects that record's `payment`.

### `POST /usage` (record medicines given to a patient)

**Permission: usage.create**

```json
{
  "patient": "6660…",
  "date": "2026-11-20",
  "shift": "NIGHT",
  "payment": "CASH",
  "doctor": "វេជ្ជ. ចាន់ វិបុល",
  "note": "",
  "items": [ { "medicine": "6661…", "quantity": 2 }, { "medicine": "6664…", "quantity": 1 } ]
}
```

| Rule | Error |
|---|---|
| `patient` must exist | 404 |
| `payment` is required: `CASH`, `NSSF` or `HEF` | 400, `fields.payment` |
| `date` defaults to today and **cannot be in the future** | 400, `fields.date` |
| `date` cannot be before the patient's `dateIn` | 400 |
| 1–100 lines; `quantity` is a whole number ≥ 1 | 400, `fields["items.<n>.quantity"]` |
| `doctor` is required when any line is a `NARCOTIC` medicine | 400 |
| Enough usable stock on that date for every line (see [stock allocation](#stock-allocation-fefo)) | 400, e.g. `"Not enough stock for Morphine 10mg: requested 5, available 3"` |

- Add up repeated lines of the same medicine and save **one record per medicine**.
- The request is **all or nothing**: if any line fails, nothing is saved and no stock is taken.
- Returns **201** with `{ "items": [Usage record] }`.

### `DELETE /usage/:id`

**Permission: usage.delete**. Deletes a usage or write-off record and puts its quantity back into
the batches it came from. Returns `{ "ok": true }`.

---

## Reports

All report endpoints require **reports.read**, except saving a requisition. `from`/`to` are
inclusive days. The longest range is 31 days for `stock-summary` and `daily-sheet`, and 400 days
for the others; return 400 for a longer range.

Rows inside reports use the medicine summary object
`{ "_id", "name", "form", "strength", "category", "order" }`.

### `GET /reports/stock-summary?from&to&categories`

The daily stock report (with `from = to`) and the weekly request report. For each medicine:

```
closing (ចំនួនសល់) = opening (ដើមគ្រា) + received (ចំណូល) − used (ចំណាយ) − writeOff
```

```json
{
  "from": "2026-11-16", "to": "2026-11-22",
  "days": ["2026-11-16", "2026-11-17", "…", "2026-11-22"],
  "categories": ["INJECTION"],
  "rows": [ {
    "medicine": { "_id": "…", "name": "Ceftriaxone", "form": "FL", "strength": "1g", "category": "INJECTION", "order": 1 },
    "isActive": true,
    "opening": 120, "received": 200,
    "daily": { "2026-11-16": 14, "2026-11-17": 9 },
    "used": 23, "writeOff": 0, "closing": 297,
    "requested": 150, "provided": 150
  } ],
  "requisition": { "note": "", "updatedAt": "…" }
}
```

| Field | Meaning |
|---|---|
| `opening` | All stock received before `from`, minus all stock taken out before `from` (usage and write-offs) |
| `received` | Batch quantities with `receivedDate` in the range |
| `daily` | Usage per day, keyed `YYYY-MM-DD`; days with no usage can be left out |
| `used` | Sum of `daily` |
| `writeOff` | Write-offs in the range |
| `requested`, `provided` | From the saved requisition for exactly this category set and range, or `null` |
| `requisition` | `null` when nothing is saved |

Sort rows by `order`, then name. Leave out inactive medicines that have no numbers in the range.

### `PUT /reports/requisition`

**Permission: reports.update**. Saves the requested and provided quantities typed into the
weekly report. Store one requisition per **category set + from + to**, and replace it on each save.

```json
{ "categories": "INJECTION", "from": "2026-11-16", "to": "2026-11-22", "note": "",
  "items": [ { "medicine": "6661…", "requested": 150, "provided": 150 } ] }
```

`categories` may be a comma-separated string or an array; treat the set as unordered.
Quantities are 0 or more. Returns the saved requisition.

### `GET /reports/daily-sheet?date&categories&allColumns`

The daily injection or pill sheet: one row per patient and one column per medicine. `date` is a
single day (`from`/`to` are also accepted).

```json
{
  "from": "2026-11-20", "to": "2026-11-20", "categories": ["INJECTION"],
  "columns": [ { "_id": "6661…", "name": "Ceftriaxone", "form": "FL", "strength": "1g", "category": "INJECTION" } ],
  "rows": [ { "patient": Patient, "quantities": { "6661…": 2 }, "first": "2026-11-20T01:10:00.000Z" } ],
  "totals": { "6661…": 37 }
}
```

- `columns` are the medicines used that day, in `order`; with `allColumns=1`, all medicines of the categories.
- `quantities` and `totals` are keyed by medicine `_id`.
- Rows are sorted by the time of the patient's first record that day (`first`).

### `GET /reports/narcotic?from&to&medicine`

The Morphine/Fentanyl register: one line per usage record, oldest first. Without `medicine`,
include all `NARCOTIC` medicines.

```json
{
  "from": "2026-11-01", "to": "2026-11-30",
  "medicine": Medicine,
  "items": [ Usage record ],
  "total": 18
}
```

`medicine` is `null` when none was chosen. Each item has `patient` (`name age sex province
diagnosis`) and `medicine` (`name form strength`) filled in. `total` is the sum of quantities.

### `GET /reports/medicine-usage?from&to&categories&medicine`

Totals per medicine, with a breakdown per patient:

```json
{ "from": "…", "to": "…", "categories": ["INJECTION", "PILL", "NARCOTIC"],
  "items": [ {
    "medicine": Medicine, "total": 42, "patientCount": 2,
    "patients": [ { "patient": { "_id": "…", "name": "…", "sex": "F", "age": 30 }, "quantity": 30, "times": 6 } ]
  } ] }
```

`times` is the number of usage records. Patients are sorted by quantity, highest first; medicines
by `order`, then name. Only medicines that were used appear.

### `GET /reports/patient-usage?from&to&categories&patient`

What each patient received in the period:

```json
{ "from": "…", "to": "…", "categories": ["INJECTION", "PILL", "NARCOTIC"],
  "items": [ {
    "patient": Patient, "total": 31,
    "items": [ { "medicine": Medicine, "quantity": 12, "days": 4 } ]
  } ] }
```

`days` is the number of different days the medicine was given. Patients are sorted by name;
medicines by category, then `order`.

---

## Users

### `GET /users?search=`

**Permission: users.read**. Returns `{ "items": [User] }` (not paged), oldest first. `search`
matches the username or full name.

### `GET /users/role-options`

**Permission: users.read**. The role choices for the user form: `{ "items": [ { "_id", "name",
"isSystem" } ] }`. Leave out `isSystem` roles unless the current user is an Admin.

### `POST /users`

**Permission: users.create**

```json
{ "username": "sokha", "fullName": "Sok Kha", "password": "…", "role": "665e…", "isActive": true }
```

- `username`: 3–50 characters, `a-z 0-9 . _ -` only, stored in lowercase, unique (**409** if taken).
- `password` must meet `minPasswordLength`.

Returns **201** with the User.

### `PUT /users/:id`

**Permission: users.update**. Any of `username`, `fullName`, `role`, `isActive`, `password` (sets
a new password), `unlock: true` (clears a lockout). Returns the User.

### `DELETE /users/:id`

**Permission: users.delete**. Returns `{ "ok": true }`.

**Rules for user changes** (return 400 or 403 with a message):

- Nobody can change their own role, disable their own account, or delete their own account.
- Only an Admin (`isSystem` role) can create, edit, disable or delete an Admin account, or give
  someone the Admin role.
- There must always be at least one active Admin.
- Setting a new password or disabling an account ends that user's sessions. A new password also
  clears any lockout.

---

## Roles

### `GET /roles`

**Permission: roles.read**. Returns `{ "items": [Role] }` with `userCount`; the Admin role first,
then by name.

### `POST /roles`

**Permission: roles.create**. Request: `{ "name": "Nurse", "description": "", "permissions":
[{ "module", "actions" }] }`. `name` is ≤ 60 characters and unique (**409** if taken). Ignore
unknown modules and actions. Returns **201** with the Role.

### `PUT /roles/:id`

**Permission: roles.update**. Any of `name`, `description`, `permissions`. Returns the Role.

### `DELETE /roles/:id`

**Permission: roles.delete**. Returns **409** if users still have this role, otherwise
`{ "ok": true }`.

**Rules for roles:**

- The Admin (`isSystem`) role cannot be edited or deleted (400).
- A user who is not an Admin cannot edit their own role, and cannot **add** the `users`, `roles`
  or `authSettings` permissions to a role (403). They may keep ones the role already has.
  Without this rule, a role manager could give themselves full access.

---

## Login history

### `GET /login-history` *(paged, default limit 30)*

**Permission: loginHistory.read**

| Query | Meaning |
|---|---|
| `status` | `SUCCESS` or `FAILED` |
| `user` | A user ID |
| `search` | Text in the username that was typed |
| `from`, `to` | `loginAt` within these days |

Items are sorted newest first:

```json
{ "_id": "…", "user": { "_id": "…", "username": "sokha", "fullName": "Sok Kha" },
  "username": "sokha", "status": "FAILED", "reason": "Invalid username or password",
  "ip": "203.0.113.5", "userAgent": "Mozilla/5.0 …",
  "loginAt": "2026-11-20T01:15:00.000Z", "logoutAt": null }
```

`user` is `null` when the typed username doesn't exist. The current implementation deletes
entries older than 2 years.

---

## Business rules

### Stock allocation (FEFO)

Stock is not stored as one number per medicine. It is the sum of `remaining` in the medicine's
batches. When usage is recorded:

1. Take the quantity from batches of that medicine that have stock left, have **not expired**,
   and were received **on or before the usage date**.
2. Use the batch that **expires first** first (First-Expiry-First-Out), then the next one.
3. Remember which batches the quantity came from, so deleting the record can put it back.
4. Two nurses saving at the same moment must not take the same units; update `remaining` atomically.

A write-off takes stock from one chosen batch, even if it has expired.

### Day boundaries

"Today", "this month" and the date ranges all use Cambodia days (UTC+7), whatever the server's
time zone is.
