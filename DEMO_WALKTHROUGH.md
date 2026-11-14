# Demo Walkthrough Script

**Project:** Job Application Tracker using MongoDB  
**Presented by:** Naman Sanjay Gupta (24BCE0768), Abhijay Mishra (24BCE2016)  
**Duration:** about 8–10 minutes  
**How to use this:** Read the spoken lines. The **TICK** lines are for the examiner — say them clearly so each rubric item can be marked.

Before you start, run:

```bash
npm run seed
npm run dev
```

Open http://localhost:5173. Have `sample-resume.txt` ready on the desktop.

---

## 0. Opening (30 seconds)

“Good morning. This is JobTrack, a MERN stack Job Application Tracker. The problem we set out to solve is that candidates currently scatter applications across spreadsheets, inboxes, and browser tabs, so deadlines and documents get lost. Our system models the entire hunt as a MongoDB-backed pipeline: every application has a status, a timeline, notes, and files, all inside one authenticated workspace.

We will demonstrate **seven user-defined functionalities** and **seven MongoDB / NoSQL functionalities** — fourteen in total.”

---

## 1. Login and centralized workspace

**Do:** Sign in with `abhijaymishra07@gmail.com` / `Demo@123`. Land on the Dashboard.

**Say:** “Each user has a private workspace. JWT authentication identifies the user, and every query is scoped to that user’s `_id`. You are now looking at a single screen that summarises the entire active and past pipeline — totals, conversion, upcoming interviews, and a kanban of every stage.”

> **TICK — User-Defined 1: Centralized Dashboard**  
> One workspace for the full pipeline, not a spreadsheet.

---

## 2. Pipeline visibility on the dashboard

**Do:** Scroll the six columns: Saved, Applied, OA, Interview, Offer, Rejected. Click any card.

**Say:** “Pipeline visibility is the status model. An application is not a static row; it moves through stages. The dashboard groups documents by the `status` enum so we can see immediately what needs attention next — for example, Google and Goldman Sachs are in Interview, Atlassian and PhonePe are already at Offer.”

> **TICK — User-Defined 3 (part A): Pipeline Visibility**

---

## 3. Upcoming interview alerts

**Do:** Open **Upcoming** in the sidebar. Toggle **Next 3 / 7 / 14 days**.

**Say:** “This is not a hard-coded list. The API runs a MongoDB date-range query: `interviewDate` greater than now and less than now plus N days, restricted to OA and Interview. Microsoft, Google, Goldman Sachs, Zoho, and Swiggy should appear inside the seven-day window. That is how we stop assessment deadlines from living only in an inbox.”

> **TICK — User-Defined 6: Upcoming Interview Alerts**

---

## 4. Search and filter board

**Do:** Open **Applications**.

1. Filter status to **Interview**.  
2. Set it back to **All**.  
3. Search `MongoDB` (that word is inside the CRED notes).  
4. Search `Google`.

**Say:** “The search bar is backed by a MongoDB **text index** on company, role, recruiter name, and notes. Typing a keyword runs `$text: { $search }` with a text score sort — we are not filtering the array in React. The status dropdown is a separate filter that uses the compound index `{ userId: 1, status: 1 }`. Pagination loads eight documents at a time with `skip` and `limit`, so a long history stays fast.”

> **TICK — User-Defined 5: Search & Filter Board**  
> **TICK — NoSQL 6: Text Search (`$text` index)**  
> **TICK — NoSQL 4 (part A): Compound index used by status filter**

---

## 5. Low-friction data entry + schema validation + create

**Do:** Click **Add application**.

First, prove validation:

1. Fill company `DemoCorp`, role `SDE Intern`.  
2. In Job URL type `not-a-url` (no `https://`). Submit.  
3. Show the error from Mongoose: *Job URL must start with http:// or https://*.

Then create a valid record:

- Company: `NVIDIA`  
- Role: `CUDA Intern`  
- Status: `Applied`  
- Source: `LinkedIn`  
- Job URL: `https://nvidia.com/careers`  
- Interview date: tomorrow  
- Notes: `Prepare OS scheduling and CUDA memory model`

Submit.

**Say:** “This is low-friction data entry — one short form, not a spreadsheet row. Before MongoDB accepts the document, the Mongoose schema validates required fields, enum status, URL format, and email format. That is schema validation at the database model layer, not only an HTML `required` attribute. A successful submit is the **Create** of CRUD, and the new document is stored with a `userId` reference to the logged-in user.”

> **TICK — User-Defined 2: Low-Friction Data Entry**  
> **TICK — NoSQL 2: Schema Validation**  
> **TICK — NoSQL 3 (Create): CRUD**  
> **TICK — NoSQL 1 (part A): userId referencing**

---

## 6. Referencing, status update, read, update

**Do:** On the NVIDIA detail page, scroll to **Stored MongoDB document**. Point at `userId`. Change status from Applied → **Interview** using the dropdown.

**Say:** “Here is the data model. We keep two collections: `users` and `applications`. This application does not embed the whole user. It stores an ObjectId `userId` that references the Users collection. That is document referencing, and it lets us query one student’s pipeline quickly even with hundreds of applications.

Changing this dropdown issues `PATCH /applications/:id` with `runValidators: true`. That is the **Update** of CRUD, and it is also pipeline status movement — Applied to Interview — which is the second half of pipeline visibility.”

> **TICK — NoSQL 1: Data Modeling & Referencing**  
> **TICK — NoSQL 3 (Read + Update): CRUD**  
> **TICK — User-Defined 3 (part B): Status Updates**

---

## 7. GridFS file upload

**Do:** Still on NVIDIA (or Google). Under **Documents (GridFS)** upload `sample-resume.txt` as Resume. Click **Download from GridFS**. Optionally upload a second file as Cover letter.

**Say:** “Resumes are not saved on the Node.js filesystem. We stream the file into MongoDB **GridFS**, in the `documents` bucket. The application document stores `resumeFileId` and the original filename, so the file stays linked to the right entry. Download opens a GridFS download stream. If we later delete the application, those GridFS files are removed with it.”

> **TICK — User-Defined 7: File Upload Interface**  
> **TICK — NoSQL 7: GridFS File Storage**

---

## 8. Actionable analytics + aggregation pipeline + indexes

**Do:** Open **Analytics**. Point at conversion percentages, the status bar chart, and the monthly volume line. Scroll to **MongoDB evidence for examiners**.

**Say:** “A spreadsheet cannot easily compute interview conversion or monthly volume. These figures are produced **on the database** by an aggregation pipeline:

- `$match` restricts documents to this user  
- `$group` counts by status and by year-month  
- `$sum` / `$cond` compute applied, interviews, and offers  
- `$count` returns the total  

Interview conversion is interviews divided by applied, as a percentage. Offer conversion is offers divided by interviews. Monthly volume is grouped by `$year` and `$month` of `appliedDate`.

Below the charts is live metadata from MongoDB itself: the collections, the GridFS bucket name, and the actual indexes — including the single `userId` index, the compound `{ userId, status }` and `{ userId, appliedDate }` indexes, and the text index `application_text_search`. That is how filtering by status and sorting by date stay fast as the collection grows.”

> **TICK — User-Defined 4: Actionable Analytics UI**  
> **TICK — NoSQL 5: Aggregation Pipeline**  
> **TICK — NoSQL 4: Single & Compound Indexing**

---

## 9. Delete (CRUD) and close

**Do:** Go back to Applications. Delete one seed record you do not need (for example Infosys). Confirm the row disappears and the dashboard counts change.

**Say:** “That is the **Delete** of CRUD. Create, Read, Update, Delete are all live against the Applications collection. Optional extra: if a user deletes their account, a MongoDB multi-document transaction removes the user, their applications, and their GridFS files together — either all of it commits, or none of it does.

To summarise: the candidate now has one pipeline, fast search, validated data entry, interview alerts, analytics computed in MongoDB, and resumes stored in GridFS. That is the project.”

> **TICK — NoSQL 3 (Delete): CRUD complete**

---

## Examiner tick sheet (read if they want a recap)

| # | Functionality | Where you just saw it |
|---|---|---|
| U1 | Centralized Dashboard | Home workspace |
| U2 | Low-friction data entry | Add application form |
| U3 | Pipeline + status updates | Kanban + status dropdown |
| U4 | Actionable analytics UI | Analytics charts |
| U5 | Search & filter board | Applications page |
| U6 | Upcoming interview alerts | Upcoming page, 7-day window |
| U7 | File upload interface | Resume / cover letter controls |
| N1 | Modeling & referencing | `userId` on the stored document |
| N2 | Schema validation | Rejected `not-a-url` |
| N3 | CRUD | NVIDIA create, view, status patch, Infosys delete |
| N4 | Single & compound indexes | Analytics → MongoDB evidence |
| N5 | Aggregation pipeline | Conversion % and monthly volume |
| N6 | Text search | Search `MongoDB` / `Google` |
| N7 | GridFS | Upload + download resume |

**Bonus (mention if time remains):** pagination, date-range queries, JWT per-user isolation, ACID transaction on account delete, Atlas-ready `MONGO_URI`.
