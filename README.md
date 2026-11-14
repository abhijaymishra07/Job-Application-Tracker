# JobTrack — Job Application Tracker using MongoDB

**Team:** Naman Sanjay Gupta (24BCE0768), Abhijay Mishra (24BCE2016)  
**Programme:** B.Tech Computer Science and Engineering, VIT Vellore  
**Stack:** MongoDB · Express.js · React.js · Node.js

A full-stack tracker for the complete job-hunt pipeline. Every application, status change, interview date, note, resume, and cover letter lives in one authenticated workspace. MongoDB is not just storage — it powers schema validation, indexes, text search, aggregations, GridFS file storage, and multi-document transactions.

## What the demo proves (14 functionalities)

### User-defined (frontend / app logic)

1. Centralized dashboard
2. Low-friction data entry
3. Pipeline visibility and status updates
4. Actionable analytics UI
5. Search and filter board
6. Upcoming interview alerts
7. File upload interface

### NoSQL / MongoDB

1. Data modeling and referencing (`users` + `applications.userId`)
2. Schema validation (required fields, enums, URL/email formats)
3. CRUD operations
4. Single and compound indexes
5. Aggregation pipeline (`$match`, `$group`, `$count`)
6. `$text` search on company, role, notes
7. GridFS for resume / cover-letter files

## Review 2 additions (14 more functionalities)

### User-defined

1. Interview rounds timeline and status history (application page)
2. Response tracker: ghosted applications and reply speed by source (`/insights`)
3. Duplicate application guard (warning on the form, 409 from the API)
4. Custom fields and tags, with tag / field filters on the board
5. Live notification centre: reminders plus instant activity feed
6. Offer comparison (`/offers`)
7. CSV import and export of applications
8. Light / dark mode toggle (sidebar and sign-in page, remembered per browser)

### NoSQL / MongoDB

1. Embedded sub-documents with `$push` (`$each` + `$sort`), `arrayFilters`, `$pull` — `rounds`, `statusHistory`
2. `$setWindowFields` + `$dateDiff` — days silent, rank inside source, offer ranking
3. Collation-aware partial unique index — `unique_active_company_role` (strength 2, active statuses only)
4. Multikey index on `tags` and compound wildcard index on `customFields.$**`
5. Change Streams with pre-images, pushed to the browser over server-sent events
6. `$densify` + `$fill` — months with no applications become zero in the trend
7. `explain("executionStats")` — **Query plan** button on the board compares IXSCAN with a forced COLLSCAN

Change Streams need a replica set. Atlas is one already; the embedded fallback starts a single-node replica set. A standalone local `mongod` still runs everything else, with live updates switched off.

Read **[DEMO_WALKTHROUGH.md](./DEMO_WALKTHROUGH.md)** out loud during evaluation. Every tick-box is called out by number.

## Prerequisites

- Node.js 18+
- MongoDB, either:
  - Docker: `docker compose up -d`
  - Local MongoDB at `mongodb://127.0.0.1:27017`
  - A MongoDB Atlas connection string

## Setup

```bash
cd DBMS
npm install
npm run install:all
```

If MongoDB is local, the included `server/.env` already points at `job-tracker`. For Atlas, edit `server/.env`:

```
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/job-tracker
JWT_SECRET=a-long-random-string
CLIENT_URL=http://localhost:5173
PORT=5000
```

Load the demo dataset (14 applications across all pipeline stages, including interviews in the next 7 days):

```bash
npm run seed
```

Demo login:

- **email:** `abhijaymishra07@gmail.com`
- **password:** `Demo@123`

Start both API and React app:

```bash
npm run dev
```

Open **http://localhost:5173** (not a random port). Both the API (`:5000`) and Vite (`:5173`) must be running — `ERR_CONNECTION_REFUSED` means `npm run dev` has not been started yet.

If MongoDB / Docker / Atlas is not installed, the API automatically starts an embedded MongoDB and seeds the demo user so the UI still loads.

- UI: http://localhost:5173
- API health: http://localhost:5000/api/health

Upload `sample-resume.txt` from this folder during the GridFS step.

## Project map

```
server/
  models/User.js            Users collection + password hashing
  models/Application.js     Applications collection, validation, indexes, text index
  controllers/              CRUD, upcoming date queries, aggregation, GridFS
  config/gridfs.js          GridFSBucket upload / download / delete
  seed/seed.js              Examiner-ready sample data
client/src/pages/           Dashboard, form, board, analytics, alerts, files
```

## MongoDB design (short)

| Collection | Role |
|---|---|
| `users` | Authenticated owners of a workspace |
| `applications` | One document per job, referenced by `userId` |
| `documents.files` / `documents.chunks` | GridFS bucket for resumes and cover letters |

Indexes on `applications`:

- `{ userId: 1 }`
- `{ userId: 1, status: 1 }` — status filter
- `{ userId: 1, appliedDate: -1 }` — recent-first sort
- `{ userId: 1, interviewDate: 1 }` — upcoming interviews
- text index on `company`, `role`, `notes`, `recruiterName`
- `{ userId: 1, company: 1, role: 1 }` unique, collation strength 2, partial on active statuses
- `{ userId: 1, tags: 1 }` — multikey
- `{ userId: 1, 'customFields.$**': 1 }` — compound wildcard (MongoDB 7.0+)

`notifications` stores the activity feed written by the change-stream listener.

The Analytics page also prints **live index metadata** from MongoDB so examiners can see the indexes without opening Compass.

## Bonus MongoDB features (beyond the 14)

- Pagination (`skip` / `limit`)
- Date-range querying for interviews
- Per-user isolation via JWT + `userId` filter
- Multi-document transaction on account deletion

## Deploy on Vercel

Vercel hosts the React UI as static files and the Express API as `/api/*` serverless functions. Production **requires MongoDB Atlas** (Vercel has no local MongoDB).

### 1. Atlas (one-time)

1. Create a free M0 cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Database Access → add a user.
3. Network Access → add `0.0.0.0/0` (allow Vercel).
4. Connect → Drivers → copy the URI, e.g.  
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/job-tracker?retryWrites=true&w=majority`

### 2. Deploy

```bash
cd /home/abhijay-mishra/Desktop/DBMS
npx vercel login
npx vercel --prod
```

When prompted, set these **Environment Variables** (or add them in the Vercel dashboard → Project → Settings → Environment Variables, then redeploy):

| Name | Value |
|---|---|
| `MONGO_URI` | Atlas connection string above |
| `JWT_SECRET` | any long random string |
| `CLIENT_URL` | your `https://….vercel.app` URL |

The first API request seeds the demo login:

- email: `abhijaymishra07@gmail.com`
- password: `Demo@123`

Open `https://your-project.vercel.app`. GridFS uploads on the Hobby plan should stay under **4.5 MB**.
