# ATS CV Studio

A bilingual English–Indonesian resume builder with a live preview, private saved CVs, and selectable-text PDF and editable DOCX downloads.

## Requirements

- Node.js 24 or newer and npm.
- A writable persistent directory for the SQLite database.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Create an account with an email and a password of 12–128 characters. The backend runs on port 3000 and creates the database schema automatically. Email is an account identifier; this version does not send email or verify ownership of an address.

Both the application and database run on your own machine. Accounts, sessions, and resume collections are stored in `data/cv-studio.sqlite`; keep the entire data directory private and persistent. PDF and DOCX generation happens in the browser.

## Production

```sh
cp .env.example .env
npm run build
npm start
```

Open `http://127.0.0.1:3000` for local production testing. For a public server, set `APP_ORIGIN` to your exact HTTPS origin and use an HTTPS reverse proxy to the Node process. Keep one application process per SQLite database. Back up the data directory using a SQLite-aware backup or stop the process before copying the database and any WAL files. This app needs a Node server; it cannot run solely on static hosting.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Backend listening port. |
| `BIND_ADDRESS` | `127.0.0.1` | Backend listening address. |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Exact allowed origin for state-changing requests. Remote deployments require HTTPS. |
| `DATABASE_PATH` | `./data/cv-studio.sqlite` | SQLite database file on persistent storage. |
| `ALLOW_REGISTRATION` | `true` | Set to `false` after creating the desired accounts to close public registration. |
| `DEV_PORT` | `5173` | Optional local frontend port used by `npm run dev`. |

Passwords use salted scrypt hashes. Sessions use random tokens in HttpOnly cookies; only token hashes are stored in the database. Each account's CV collection is isolated by its authenticated session. The API also checks the expected account to prevent stale tabs from saving into an account that changed in another tab. Origin checks, bounded JSON bodies, login throttling, and database revisions guard updates.

There is no email-based password recovery in this version. Keep your password safely; account deletion, password changes and external sign-in providers are not implemented.

## Features

- Independent interface and resume languages; separately editable English and Indonesian text with shared contact details and dates.
- Contact details, summary, experience, projects, education, skills, certifications and languages. Repeatable entries support adding, removing and reordering.
- Light, dark and monochrome workspaces; desktop editing beside the preview and mobile Edit/Preview tabs.
- Up to 50 saved CVs per account, with manual save, autosave, creation, switching, renaming and confirmed deletion. A collection may contain up to 1.5 MB of JSON.
- Account-specific browser recovery, retryable database failures and conflict copies for overlapping edits. Sign out saves pending changes first.
- One conservative single-column A4 document layout, standard headings, empty-section omission, and separate `-en` / `-id` downloads. No photos, tables or graphical skill ratings.
- Five bilingual examples, including beginners and career changers. The Indonesian language evaluator example includes a synthetic practice portfolio ZIP with 18 reviewed cases, bilingual explanations, a rubric and blank worksheets.
- Optional WebMCP draft read/update tools in supporting browsers.

Examples are fictional. Complete your own practice work and replace names, employers, dates, project counts and proficiency claims before applying. Practice projects remain labelled. Formatting does not guarantee an interview or screening outcome.

## Existing CVs

A new standalone installation starts with its own accounts and empty database. It does not copy records from another hosting service. Existing browser drafts on the same origin can be migrated after a successful database save. Keep your old documents available until you have recreated and saved the versions you need here.

## Validation

```sh
npm run check
npm test
```

The tests exercise authenticated database saves, account isolation, stale revisions, retries, session invalidation and origin/body validation. Build output and local database files are ignored by Git.

## Third-party components

Uses React, Vite, accessible UI primitives, Tailwind CSS, Zod, `@react-pdf/renderer`, and `docx`. Bundled font and stylesheet licenses are retained next to their assets. Dependency licenses remain applicable to their respective packages.
