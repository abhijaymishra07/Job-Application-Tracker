#!/usr/bin/env python3
from pathlib import Path

OUT = Path("/home/abhijay-mishra/Desktop/DBMS/report/review2/index.html")
pages = []
toc = []
n = 0

NAMES = "Abhijay Mishra 24BCE2016 · Naman Gupta 24BCE0768"
SHORT = "Job Application Tracker Using MongoDB"


def esc(s):
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def hdr(cover=False):
    if cover:
        return ""
    return f"""<div class="running"><span>{NAMES}</span><span>Review 2 · BCSE302L</span></div>"""


def ftr(num):
    return f"""<div class="foot"><span>{SHORT}</span><span>Page {num}</span></div>"""


def start_page(title=None, level=None):
    global n
    n += 1
    if title:
        toc.append((level or 1, title, n))
    return n, ""


def close_page(body, num):
    pages.append(
        f'<div class="page">\n{hdr()}\n<div class="main">\n{body}\n</div>\n{ftr(num)}\n</div>'
    )


def code_block(filename, code):
    return f"""<div class="codewrap"><div class="fn">{esc(filename)}</div><pre>{esc(code)}</pre></div>"""


def shot_card(i, label, src, cap, size="hero"):
    return (
        f'<div class="shot {size} avoid">'
        f'<p class="shot-label">{i}. {esc(label)}</p>'
        f'<img src="assets/{src}" alt="{esc(cap)}" />'
        f'<p class="caption">{esc(cap)}</p></div>'
    )


def close_feature(body, num, items):
    items = list(items)
    if not items:
        close_page(body, num)
        return
    first, rest = items[0], items[1:]
    body += "<h3>Screenshots</h3>\n" + shot_card(1, *first, size="hero")
    close_page(body, num)
    idx = 2
    while rest:
        chunk = rest[:2]
        rest = rest[2:]
        size = "pair" if len(chunk) == 2 else "full"
        n2, b = start_page()
        b += "\n".join(shot_card(idx + i, *item, size=size) for i, item in enumerate(chunk))
        close_page(b, n2)
        idx += len(chunk)


# ---------- Cover ----------
n = 1
toc.append((0, "Cover Page", 1))
pages.append(f"""<div class="page cover">
  <img class="logo" src="assets/vit-logo.png" alt="Vellore Institute of Technology" />
  <h1>Job Application Tracker Using MongoDB</h1>
  <div class="sub">A MongoDB Based Full Stack Project for Application Pipeline Tracking</div>
  <div class="badges"><span class="badge">MongoDB</span><span class="badge">Express</span><span class="badge">React</span><span class="badge">Node.js</span></div>
  <div class="bar"></div>
  <div class="review">Review 2</div>
  <div class="meta">
    <p>Submitted by</p>
    <p><b>Abhijay Mishra</b><br/>Registration No: 24BCE2016</p>
    <p style="margin-top:10px"><b>Naman Gupta</b><br/>Registration No: 24BCE0768</p>
    <div class="bar"></div>
    <p><b>School of Computer Science and Engineering (Core)</b><br/>SCOPE</p>
    <p><b>Subject: Database Systems (BCSE302L)</b><br/>Professor: Dr. Rajeshkannan R</p>
  </div>
  <div class="footline">Vellore Institute of Technology</div>
</div>""")

# Part 1 header + 1.1 text page
num, body = start_page("Part 1: User-Defined Application Features", 0)
body += """<div class="part">Part 1: User-Defined Application Features</div>
<p class="source">React app flows and backend logic</p>
<h2>1.1. Centralized Dashboard</h2>
<p class="source">React: client/src/pages/Dashboard.jsx · Backend: GET /api/analytics, GET /api/applications/pipeline, GET /api/applications/upcoming?days=7</p>
<h3>Description</h3>
<p>The dashboard summarizes the entire application pipeline in one screen — total applications, interview conversion rate, offer count, and interviews due in the next 7 days. It loads analytics, pipeline, and upcoming-interview data in parallel on mount, so the user gets a single at-a-glance view instead of checking spreadsheets or tabs.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/Dashboard.jsx", """useEffect(() => {
  Promise.all([
    api.get('/analytics'),
    api.get('/applications/pipeline'),
    api.get('/applications/upcoming?days=7'),
  ]).then(([a, p, u]) => { setAnalytics(a.data); setPipeline(p.data); });
}, []);""")
close_feature(body, num, [
    ("Dashboard Loaded", "ui_dashboard.png", "Figure 1.1 – Dashboard with application counts, conversion rate, pipeline columns, and upcoming interviews."),
])

# 1.2
num, body = start_page("1.2 Low-Friction Data Entry Form", 1)
body += """<div class="part">Part 1 · User-Defined</div>
<h2>1.2. Low-Friction Data Entry Form</h2>
<p class="source">React: client/src/pages/ApplicationForm.jsx · Backend: POST /api/applications</p>
<h3>Description</h3>
<p>A single React form lets the user add a new application in seconds, with only Company and Role marked required. On submit it posts the payload to the API and immediately navigates to the newly created application, keeping data entry fast and low-friction.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/ApplicationForm.jsx", """async function onSubmit(e) {
  e.preventDefault();
  const payload = { ...form, salary: form.salary === "" ? null : Number(form.salary) };
  const { data } = await api.post('/applications', payload);
  navigate(`/applications/${data.application._id}`);
}""")
close_feature(body, num, [
    ("Initial State — Empty Form", "ui_form_empty.png", "Figure 1.3 – New Application form before any fields are filled."),
    ("Form Input", "ui_form_filled.png", "Figure 1.4 – Form filled with Company (Stripe), Role (SDE Intern), and Location (Remote)."),


    ("Successful Submission", "ui_form_created.png", "Figure 1.5 – Created Stripe application detail page after POST /api/applications."),
])

# 1.3
num, body = start_page("1.3 Pipeline Visibility & Status Updates", 1)
body += """<div class="part">Part 1 · User-Defined</div>
<h2>1.3. Pipeline Visibility &amp; Status Updates</h2>
<p class="source">React: client/src/pages/Applications.jsx, client/src/pages/ApplicationDetail.jsx · Backend: PATCH /api/applications/:id</p>
<h3>Description</h3>
<p>A dropdown on the application detail page lets the user move an application across pipeline stages (Applied, OA, Interview, Offer, Rejected) with a single selection. Changing the value fires a PATCH request and updates the UI with the server's response, keeping the pipeline state in sync.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/ApplicationDetail.jsx", """async function changeStatus(status) {
  const { data } = await api.patch(`/applications/${id}`, { status });
  setApp(data.application);
}
// <select value={app.status} onChange={(e) => changeStatus(e.target.value)}>""")
close_feature(body, num, [
    ("Initial State — Pipeline Board", "ui_applications.png", "Figure 1.6 – Applications board with current statuses before a change."),
    ("Action — Status Menu", "ui_status_dropdown.png", "Figure 1.7 – Status dropdown opened on a row, listing Saved, Applied, OA, Interview, Offer, Rejected."),
])

# 1.4
num, body = start_page("1.4 Actionable Analytics UI", 1)
body += """<div class="part">Part 1 · User-Defined</div>
<h2>1.4. Actionable Analytics UI</h2>
<p class="source">React: client/src/pages/Analytics.jsx · Backend: GET /api/analytics</p>
<h3>Description</h3>
<p>The Analytics page renders MongoDB-computed metrics using Recharts: a bar chart of status distribution and a line chart of monthly application volume. The UI performs no calculation itself — it only visualizes the aggregation results returned by the API, keeping charts and business logic decoupled.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/Analytics.jsx", """<BarChart data={statusDistribution}>
  <XAxis dataKey="status" /><YAxis allowDecimals={false} />
  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
    {statusDistribution.map((e) => <Cell key={e.status} fill={COLORS[e.status]} />)}
  </Bar>
</BarChart>""")
close_feature(body, num, [
    ("Initial / Result — Analytics Page", "ui_analytics.png", "Figure 1.8 – Analytics page showing conversion cards, status-distribution bar chart, and monthly volume line chart computed by MongoDB."),
])

# 1.5
num, body = start_page("1.5 Search & Filter Board", 1)
body += """<div class="part">Part 1 · User-Defined</div>
<h2>1.5. Search &amp; Filter Board</h2>
<p class="source">React: client/src/pages/Applications.jsx · Backend: GET /api/applications?q=&amp;status=</p>
<h3>Description</h3>
<p>A search bar and status dropdown let the user narrow the application list by company, role, recruiter, or notes text, or by pipeline stage. Submitting the search calls the API with both the query string and the selected status, which are combined server-side into a single filtered, paginated request.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/Applications.jsx", """async function search(e) {
  e.preventDefault();
  setPage(1);
  await load(1, q, status);
}
// api.get('/applications', { params: { page, limit: 8, q, status } })""")
close_feature(body, num, [
    ("Initial State — Full List", "ui_status_open.png", "Figure 1.9 – Unfiltered applications list (14 records) before search."),
    ("Result — Text Search", "ui_search_amazon.png", "Figure 1.10 – Search for “Amazon” returning a single matching application via the weighted $text index."),
])

# 1.6
num, body = start_page("1.6 Upcoming Interview Alerts", 1)
body += """<div class="part">Part 1 · User-Defined</div>
<h2>1.6. Upcoming Interview Alerts</h2>
<p class="source">React: client/src/pages/Upcoming.jsx · Backend: GET /api/applications/upcoming?days=</p>
<h3>Description</h3>
<p>A dedicated view highlights applications with an OA or Interview scheduled in the next N days (3, 7, or 14, selectable via toggle buttons). It re-queries the API whenever the window changes, surfacing only what the user needs to act on soon instead of the full application list.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/Upcoming.jsx", """const [days, setDays] = useState(7);
useEffect(() => {
  api.get(`/applications/upcoming?days=${days}`).then((res) => setPayload(res.data));
}, [days]);
// {[3, 7, 14].map((n) => <button onClick={() => setDays(n)}>Next {n} days</button>)}""")
close_feature(body, num, [
    ("Initial State — Next 7 Days", "ui_upcoming_7.png", "Figure 1.11 – Upcoming view with the 7-day window selected."),
    ("Action / Result — Next 3 Days", "ui_upcoming_3.png", "Figure 1.12 – Same view after selecting the 3-day toggle; the list is re-queried from MongoDB."),


    ("Result — Next 14 Days", "ui_upcoming_14.png", "Figure 1.13 – 14-day window listing every OA and Interview in the wider horizon."),
])

# 1.7
num, body = start_page("1.7 File Upload Interface", 1)
body += """<div class="part">Part 1 · User-Defined</div>
<h2>1.7. File Upload Interface</h2>
<p class="source">React: client/src/pages/ApplicationDetail.jsx · Backend: POST /api/applications/:id/files/:kind</p>
<h3>Description</h3>
<p>Each application detail page includes a file slot for a resume and a cover letter. Selecting a file wraps it in FormData and uploads it via a multipart POST request; the user can later download it back from GridFS or remove it, all without leaving the page.</p>
<h3>Code Snippet</h3>
""" + code_block("client/src/pages/ApplicationDetail.jsx", """async function upload(e) {
  const file = e.target.files?.[0];
  const form = new FormData();
  form.append('file', file);
  await api.post(`/applications/${app._id}/files/${kind}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' } });
}""")
close_feature(body, num, [
    ("Initial State — Empty Slots", "ui_form_created.png", "Figure 1.14 – Document slots on a newly created application with no files attached."),
    ("Result — Files Stored", "ui_amazon_files.png", "Figure 1.15 – Amazon application after resume and cover letter were uploaded; Download/Remove are available."),
])

# Part 2
num, body = start_page("Part 2: Advanced NoSQL / MongoDB Features", 0)
body += """<div class="part">Part 2: Advanced NoSQL / MongoDB DBMS Features</div>
<p class="source">Mongoose schemas, indexes, aggregation, $text search, and GridFS — verified in the MongoDB shell</p>
<h2>2.1. Data Modeling &amp; Referencing</h2>
<p class="source">Backend: server/models/Application.js · Collection: applications (userId → users._id)</p>
<h3>Description</h3>
<p>Each Application document stores a userId field typed as a Mongoose ObjectId that references the Users collection. This models a one-to-many relationship (one user, many applications) using MongoDB's referencing pattern instead of embedding, and the field is indexed since every query is scoped to the owning user.</p>
<h3>Code Snippet</h3>
""" + code_block("server/models/Application.js", """userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: [true, 'Every application must belong to a user'],
  index: true,
},""")
close_feature(body, num, [
    ("Schema — ObjectId Reference", "shot_01.png", "Figure 2.1 – Application.js: userId typed as ObjectId with ref: 'User' and index: true."),
    ("MongoDB Shell — Stored Document", "mongo_collections.png", "Figure 2.2 – users and applications collections; the application document stores userId as an ObjectId reference."),
])

# 2.2
num, body = start_page("2.2 Schema Validation", 1)
body += """<div class="part">Part 2 · MongoDB / Mongoose</div>
<h2>2.2. Schema Validation</h2>
<p class="source">Backend: server/models/Application.js · Enforced on POST /api/applications and PATCH /api/applications/:id</p>
<h3>Description</h3>
<p>Mongoose enforces data integrity at the schema level before anything reaches the database: required fields, string length limits, an enum restricting status to valid pipeline stages, and a custom regex validator on the job URL. Invalid writes are rejected with a descriptive ValidationError before they touch MongoDB.</p>
<h3>Code Snippet</h3>
""" + code_block("server/models/Application.js", """status: {
  type: String,
  enum: { values: STATUSES, message: 'Status must be one of: ...' },
  default: 'Applied',
},
jobUrl: { type: String, validate: { validator: (v) => !v || /^https?:\\/\\/.+/i.test(v) } },""")
close_feature(body, num, [
    ("Result — ValidationError in UI", "ui_validation_error.png", "Figure 2.3 – Job URL “google.com” is rejected before the write: “Job URL must start with http:// or https://”."),
])

# 2.3
num, body = start_page("2.3 CRUD Operations", 1)
body += """<div class="part">Part 2 · MongoDB / Mongoose</div>
<h2>2.3. CRUD Operations</h2>
<p class="source">Backend: server/controllers/applicationController.js · POST/GET/PATCH/DELETE /api/applications[/:id]</p>
<h3>Description</h3>
<p>Express routes backed by controller functions handle the full lifecycle of an application document: create, read (single and paginated list), update, and delete. Each operation is scoped to the authenticated user via an ownerFilter, and update/delete return 404 for records the user does not own.</p>
<h3>Code Snippet</h3>
""" + code_block("server/controllers/applicationController.js", """async function updateApplication(req, res) {
  const application = await Application.findOneAndUpdate(
    { _id: req.params.id, ...ownerFilter(req.user._id) },
    req.body,
    { new: true, runValidators: true }
  );
}""")
close_feature(body, num, [
    ("Create — New Document", "ui_form_created.png", "Figure 2.5 – CREATE: Stripe document after POST /api/applications."),
    ("Update — Edit Form", "ui_edit_form.png", "Figure 2.6 – UPDATE: Edit application form for Razorpay before PATCH /api/applications/:id."),


    ("Read — Application Detail", "ui_detail_razorpay.png", "Figure 2.7 – READ: Razorpay detail returned by GET /api/applications/:id, scoped to the signed-in user."),
])

# 2.4
num, body = start_page("2.4 Single & Compound Indexing", 1)
body += """<div class="part">Part 2 · MongoDB / Mongoose</div>
<h2>2.4. Single &amp; Compound Indexing</h2>
<p class="source">Backend: server/models/Application.js · Verified with db.applications.getIndexes()</p>
<h3>Description</h3>
<p>Compound indexes on { userId, status } and { userId, appliedDate } speed up the two most common query patterns — filtering the pipeline by stage and sorting the list by application date — without scanning every document a user owns. A separate index supports fast lookups of upcoming interviews by date.</p>
<h3>Code Snippet</h3>
""" + code_block("server/models/Application.js", """applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ userId: 1, appliedDate: -1 });
applicationSchema.index({ userId: 1, interviewDate: 1 });""")
close_feature(body, num, [
    ("Index Definitions in Source", "shot_02.png", "Figure 2.8 – Compound indexes and the weighted text index declared on the Application schema."),
    ("MongoDB Shell — getIndexes()", "mongo_indexes.png", "Figure 2.9 – Live indexes on the applications collection, including userId_1_status_1, userId_1_appliedDate_-1, userId_1_interviewDate_1, and application_text_search."),
])

# 2.5
num, body = start_page("2.5 Aggregation Pipeline", 1)
body += """<div class="part">Part 2 · MongoDB / Mongoose</div>
<h2>2.5. Aggregation Pipeline</h2>
<p class="source">Backend: server/controllers/analyticsController.js · GET /api/analytics</p>
<h3>Description</h3>
<p>Dashboard and analytics metrics are computed entirely inside MongoDB using an aggregation pipeline — $match scopes results to the current user, $group buckets applications by status or month, and further stages compute derived fields like interview and offer conversion rates. No metric is calculated in Node after a full document scan.</p>
<h3>Code Snippet</h3>
""" + code_block("server/controllers/analyticsController.js", """Application.aggregate([
  { $match: { userId } },
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $project: { _id: 0, status: '$_id', count: 1 } },
]);""")
close_feature(body, num, [
    ("Pipeline in Source", "shot_03.png", "Figure 2.10 – $match / $group aggregation inside analyticsController.js."),
    ("MongoDB Shell — $group by status", "mongo_aggregate.png", "Figure 2.11 – Aggregation output: document counts per pipeline status computed in the database engine."),


    ("UI Consuming Aggregates", "ui_analytics.png", "Figure 2.12 – Analytics UI rendering the aggregation results (no client-side metric math)."),
])

# 2.6
num, body = start_page("2.6 Text Search", 1)
body += """<div class="part">Part 2 · MongoDB / Mongoose</div>
<h2>2.6. Text Search</h2>
<p class="source">Backend: server/models/Application.js + server/controllers/applicationController.js · GET /api/applications?q=</p>
<h3>Description</h3>
<p>A weighted MongoDB text index spans the company, role, recruiter name, and notes fields, with company weighted highest. When the user searches, the query uses $text with $search and sorts by textScore, so the most relevant matches surface first without a separate search engine.</p>
<h3>Code Snippet</h3>
""" + code_block("server/models/Application.js + server/controllers/applicationController.js", """applicationSchema.index(
  { company: 'text', role: 'text', notes: 'text', recruiterName: 'text' },
  { weights: { company: 10, role: 5, recruiterName: 3, notes: 1 } }
);
// filter.$text = { $search: q.trim() };
// query = Application.find(filter, { score: { $meta: 'textScore' } });""")
close_feature(body, num, [
    ("MongoDB Shell — $text + textScore", "mongo_text.png", "Figure 2.13 – $text search for “Amazon” uses index application_text_search (score 11)."),
    ("UI Result", "ui_search_amazon.png", "Figure 2.14 – Applications board showing the same $text query from the React search bar."),
])

# 2.7
num, body = start_page("2.7 GridFS File Storage", 1)
body += """<div class="part">Part 2 · MongoDB / Mongoose</div>
<h2>2.7. GridFS File Storage</h2>
<p class="source">Backend: server/config/gridfs.js · POST/GET/DELETE /api/applications/:id/files/:kind</p>
<h3>Description</h3>
<p>Uploaded resumes and cover letters are streamed directly into MongoDB using GridFS rather than the local filesystem, via a GridFSBucket on the 'documents' bucket. The returned file id is stored on the Application document, and files are streamed back out (or deleted) on demand, keeping documents co-located with the data they belong to.</p>
<h3>Code Snippet</h3>
""" + code_block("server/config/gridfs.js", """function uploadBuffer({ buffer, filename, contentType, metadata }) {
  const bucket = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { contentType, metadata });
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}""")
close_feature(body, num, [
    ("UI — Files Attached", "ui_amazon_files.png", "Figure 2.15 – Resume and cover letter stored against the Amazon application."),
    ("MongoDB Shell — documents.files / chunks", "mongo_gridfs.png", "Figure 2.16 – GridFS bucket documents.files listing uploaded files and documents.chunks count."),
])

# Part 3
num, body = start_page("Part 3: Tools & Verification", 0)
body += """<div class="part">Part 3: Tools &amp; Verification</div>
<p class="source">Local running stack used for this review (embedded MongoDB + localhost API and React app)</p>
<p>The system was demonstrated on a local MERN stack. MongoDB ran as an embedded server on this machine. The React client was served at <b>http://localhost:5173</b> and the Express API at <b>http://localhost:5000</b>. There is no public Vercel deployment for this review, so verification is from the running local application and the MongoDB shell.</p>
"""
close_feature(body, num, [
    ("Running Frontend", "ui_login.png", "Figure 3.1 – Application running locally at http://localhost:5173."),
    ("API Health", "api_health.png", "Figure 3.2 – GET /api/health returns mongodb: connected."),
    ("MongoDB Collections", "mongo_collections.png", "Figure 3.3 – users, applications, documents.files, documents.chunks."),
    ("Local Source Tree", "local_stack.png", "Figure 3.4 – Project layout and running endpoints."),
])

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Job Application Tracker Using MongoDB — Review 2</title>
  <link rel="stylesheet" href="report.css" />
</head>
<body>
{''.join(pages)}
</body>
</html>
"""

OUT.write_text(html)
print(f"Wrote {OUT} with {len(pages)} page divs")
