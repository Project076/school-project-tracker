# School Project Management & Financial Tracker

This workspace contains a Next.js starter tailored to the project specification for a school-facing project delivery and finance tracker.

## What is included

- Role-aware dashboard for `Admin`, `Project Manager`, and `Member` personas
- WIP and Completed project views with vendor/date/status filtering surfaces
- Project detail screen with chat, attachments, task estimates, finance tracking, and audit history
- Email sync-ready data model showing outbound app-to-email and inbound email-to-app metadata
- Real-time notification ready UI sections

## Shared auth and storage

This app now supports a shared Supabase-backed mode so the same users can sign in from different computers and phones.

### What Supabase stores

- Auth users and passwords through `Supabase Auth`
- Role/profile records in `public.app_profiles`
- Full shared project state in `public.app_projects`

### One-time Supabase setup

1. Create a Supabase project.
2. Open the SQL editor in Supabase.
3. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it.
4. Copy these values into `.env.local` and your Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
GMAIL_FROM_NAME=School Project Tracker
GMAIL_FROM_ADDRESS=yourgmail@gmail.com
```

5. Start the app.
6. On the first launch, use the login page to create the first Admin account.
7. After that, the Admin can create all other users from the `Users` section.

## Core rules encoded in the starter

- Any authenticated user can create a project.
- Only the assigned PM can mark a project as `Completed`.
- Members can collaborate in chat but only view PM financial progress.
- Balance due is derived from invoice amount minus payment ledger entries.
- Audit entries capture important state changes.

## Run locally

```bash
npm install
npm run dev
```

Use a Gmail App Password, not your normal Gmail password.

## Build modes

- `npm run build`: web/server build with Gmail email support
- `npm run build:mobile`: static export for Capacitor mobile packaging
- `npm run build:web`: same as web/server build, useful before deployment

## Android and iOS wrapper

This project is set up for a `web + Capacitor` approach.

### What you need on your machine

- Node.js
- Android Studio for Android builds
- Xcode on macOS for iOS builds

### Wrapper flow

```bash
npm install
npm run build
npm run cap:sync
npm run cap:android
```

For iOS:

```bash
npm run cap:ios
```

### Important note

For Gmail email sending, use the web/server mode. The static mobile export does not include server email routes by itself, so mobile builds should point to a hosted backend/web deployment when you want live email.

## Recommended mobile production path

For this app, the best path is:

1. Deploy the `Next.js` app to a live server.
2. Set `CAPACITOR_SERVER_URL` to that live app URL before syncing Capacitor.
3. Build Android in Android Studio and iOS in Xcode.

This keeps working:

- Gmail outbound email
- inbound email reply sync
- project chat history sync
- all server/API routes

### Example live-wrapper flow

Create a mobile environment variable using `.env.mobile.example` as reference:

```bash
CAPACITOR_SERVER_URL=https://your-live-app-url.com
```

Then sync the wrapper against the live app URL:

```bash
set CAPACITOR_SERVER_URL=https://your-live-app-url.com
npm run cap:sync
npm run cap:android
```

For iOS on macOS:

```bash
set CAPACITOR_SERVER_URL=https://your-live-app-url.com
npm run cap:sync
npm run cap:ios
```

### Current native projects

- Android wrapper already exists in `android/`
- iOS wrapper already exists in `ios/`

### Best deployment target

The simplest hosting choice for this project is `Vercel`, because it runs the `Next.js` app and API routes together. Once the live URL is ready, the Capacitor wrappers can use that URL directly.
