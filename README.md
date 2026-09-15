# HR Portal

A minimal in-house HR portal: employees log in to mark attendance, apply for
leave, download payslips, and raise requests to HR. HR (admin) gets one
dashboard to manage employees, review attendance, approve/reject leave,
upload payslips, and reply to requests.

Runs fully **locally** with zero external services required. Data is stored
in a single JSON file (`backend/data/db.json`) so you can inspect it directly
and swap it for Supabase later without changing any frontend code — you'd
only rewrite the three functions in `backend/db.js`.

## What's included

- **Attendance** — employee check-in/check-out, personal history, admin
  overview with filters by employee/date.
- **Leave management** — apply for leave, HR approves/rejects with a
  comment, employee sees status update. Both sides get an email notification
  (or a console log if email isn't configured — see below).
- **Payslips** — HR uploads the payslip file it receives (PDF/PNG/JPG),
  employee downloads it any time. No portal on the payslip-sender's side
  needed; this becomes your own archive.
- **HR requests** — employee submits a request (e.g. "need Form 16"), HR
  replies and marks it resolved. Notifies by email both ways.
- **Admin panel** — create/remove employee accounts, set roles.

## Project structure

```
hr-portal/
  backend/     Node.js + Express API, JSON-file storage
  frontend/    React + Vite single-page app
```

## Requirements

- Node.js 18+ and npm

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
npm start
```

The API runs on **http://localhost:4000**.

On first run it seeds a default HR admin account:

```
email:    admin@company.com
password: admin123
```

**Log in and change this immediately** (Admin → Employees → edit, or just
create your real admin account and delete this one).

### Email notifications (optional)

By default, `.env` has no SMTP settings, so the app just logs
`[mailer] SMTP not configured - skipped email to ...` to the console instead
of sending anything — everything else works normally. To actually send
emails (e.g. leave request notifications to HR, payslip-ready notices to
employees), fill in `backend/.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

For Gmail, use an **App Password**, not your normal password (Google
Account → Security → App Passwords). Any standard SMTP provider works the
same way.

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. It talks to the backend at
`http://localhost:4000/api` by default — if you run the backend on a
different port, copy `frontend/.env.example` to `.env` and update
`VITE_API_URL`.

## 3. Using it

- Log in as `admin@company.com` / `admin123`.
- Go to **Employees** and add your real employees (name, email, a temporary
  password, employee code). Each one gets an email with their login details
  (or check the backend console if SMTP isn't set up).
- Employees log in at the same URL — they land on their own dashboard
  automatically based on their role.
- As HR, upload each employee's payslip under **Payslips** once you receive
  it in your email — from then on, it's in their own portal permanently.

## Data storage

Everything lives in `backend/data/db.json` (auto-created on first run) plus
uploaded payslip files in `backend/uploads/payslips/`. Back this up
regularly, or migrate it into Supabase/Postgres when you're ready — since
all data access goes through `backend/db.js`, that's the only file you need
to rewrite.

## Security notes before real use

- Change `JWT_SECRET` in `backend/.env` to a long random string.
- Change the default admin password immediately.
- This is built for a small internal team on a trusted network. For
  internet-facing deployment, put it behind HTTPS and consider moving from
  the JSON file to a real database for concurrent-write safety.
