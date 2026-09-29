# Auto Apply — Playwright job application filler

Reads your details from `profile.json`, detects the ATS (Workday, Greenhouse,
Lever, Ashby, iCIMS, Taleo, SmartRecruiters…), fills every field it can, uploads
your resume, and **stops before submitting** unless you opt in.

## Setup

```bash
npm install
npx playwright install chromium
cp /path/to/your-resume.pdf resume/Resume.pdf   # required for uploads
```

Edit `profile.json` with your details. `answers` lets you override any question:
each rule's `match` keywords are checked against the field's label, and an empty
`value` means "leave this blank" (used for EEO questions by default).

## Usage

| Command | What it does |
| --- | --- |
| `npm run cli -- <url...> [--headed] [--submit]` | Fill one or more applications from the terminal |
| `npm run login -- "<url>"` | Log in once in a real browser; the session is saved to `auth/` and reused |
| `npm run app` | Web UI at http://localhost:5173 |
| `npm run app:desktop` | Same UI in an Electron window |
| `JOB_URL=<url> [HEADED=1] [AUTO_SUBMIT=1] npm test` | Run one application as a Playwright test |
| `npm run typecheck` | Type-check the project |

Each run writes a full-page screenshot and a JSON report to `runs/`.

## Login walls

Workday and iCIMS often require an account. When a run hits a login page:

- **Headless:** the run stops with `needsLogin`. Run `npm run login -- "<url>"` first.
- **Headed CLI:** log in in the browser window, then press Enter in the terminal.
- **Headed web UI / Electron / test:** log in in the browser window; the run
  continues once the login page is gone (waits up to 5 minutes).

Passwords and 2FA are always entered by you; only the resulting cookies are saved.

## Submitting

`settings.submit` is `false` by default: the run fills everything, finds the
submit button, and reports it without clicking. Review the form (or the
screenshot), then submit manually — or pass `--submit` / tick **Auto-submit**.
Nothing is ever submitted on a page where no field was filled.

## Docker

```bash
docker build -t auto-apply .
docker run -p 5173:5173 -v "$PWD/resume:/app/resume" -v "$PWD/auth:/app/auth" auto-apply
```

Docker runs headless only, so create sessions with `npm run login` on your machine first.
