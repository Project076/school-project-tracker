# School Project Management & Financial Tracker

This workspace contains a Next.js starter tailored to the project specification for a school-facing project delivery and finance tracker.

## What is included

- Role-aware dashboard for `Admin`, `Project Manager`, and `Member` personas
- WIP and Completed project views with vendor/date/status filtering surfaces
- Project detail screen with chat, attachments, task estimates, finance tracking, and audit history
- Email sync-ready data model showing outbound app-to-email and inbound email-to-app metadata
- Real-time notification ready UI sections

## Suggested production architecture

1. `Next.js` app for UI and API routes.
2. `PostgreSQL` for users, projects, messages, attachments, PRs, invoices, payments, and audit events.
3. `NextAuth` or your preferred SSO for role-based access.
4. `Resend`, `SendGrid`, or `Microsoft Graph` for outbound email notifications.
5. An inbound email webhook that validates sender, identifies the project thread, strips quoted replies, stores attachments, and posts the parsed reply back to chat.
6. WebSockets or Pusher/Ably for real-time in-app notifications.

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

## Gmail setup for chat email

To send real chat emails through Gmail, create `.env.local` in the project root and add:

```bash
GMAIL_USER=yourgmail@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
GMAIL_FROM_NAME=School Project Tracker
GMAIL_FROM_ADDRESS=yourgmail@gmail.com
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
