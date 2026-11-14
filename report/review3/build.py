#!/usr/bin/env python3
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE / "index.html"
pages = []
n = 0
figures = {}

NAMES = "Abhijay Mishra 24BCE2016 · Naman Gupta 24BCE0768"
SHORT = "Job Application Tracker Using MongoDB"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def hdr():
    return f"""<div class="running"><span>{NAMES}</span><span>Review 3 · BCSE302L</span></div>"""


def ftr(num):
    return f"""<div class="foot"><span>{SHORT}</span><span>Page {num}</span></div>"""


def start_page():
    global n
    n += 1
    return n, ""


def close_page(body, num):
    pages.append(
        f'<div class="page">\n{hdr()}\n<div class="main">\n{body}\n</div>\n{ftr(num)}\n</div>'
    )


def code_block(filename, code):
    return f"""<div class="codewrap"><div class="fn">{esc(filename)}</div><pre>{esc(code)}</pre></div>"""


PAGE_MM = 259          # usable height of .main on an A4 page
WIDTH_MM = 186         # content width
SHOT_EXTRA_MM = 12     # label + caption + margins around one screenshot
MIN_SHOT_MM = 88       # never shrink a screenshot below this to squeeze another one in
TEXT_HEIGHTS = json.loads((HERE / "text_heights.json").read_text()) if (HERE / "text_heights.json").exists() else {}


def natural_mm(src):
    with Image.open(HERE / "assets" / src) as im:
        w, h = im.size
    return WIDTH_MM * h / w


def shot_card(i, part, label, src, cap, max_mm):
    figures[part] = figures.get(part, 0) + 1
    fig = f"Figure {part}.{figures[part]} – {cap}"
    return (
        f'<div class="shot avoid">'
        f'<p class="shot-label">{i}. {esc(label)}</p>'
        f'<img src="assets/{src}" alt="{esc(cap)}" style="max-height:{max_mm:.0f}mm" />'
        f'<p class="caption">{esc(fig)}</p></div>'
    )


def fill(items, budget):
    """Largest equal cap so every item fits in budget (items keep their own natural height if smaller)."""
    lo, hi = 20, 240
    for _ in range(40):
        mid = (lo + hi) / 2
        used = sum(min(natural_mm(it[1]), mid) + SHOT_EXTRA_MM for it in items)
        lo, hi = (mid, hi) if used <= budget else (lo, mid)
    return lo


def min_mm(src):
    # terminal panels are plain text and stay readable when smaller than UI screenshots
    return 75 if src.startswith(("mongo3_", "csv_")) else MIN_SHOT_MM


def fits(items, budget):
    return sum(min(natural_mm(it[1]), min_mm(it[1])) + SHOT_EXTRA_MM for it in items) <= budget


def splits(items):
    """Every way to cut items into consecutive, non-empty page groups."""
    if not items:
        yield []
        return
    for k in range(1, len(items) + 1):
        for tail in splits(items[k:]):
            yield [items[:k]] + tail


def free_space(group, budget):
    cap = fill(group, budget)
    return budget - sum(min(natural_mm(it[1]), cap) + SHOT_EXTRA_MM for it in group)


def plan_pages(items, text_budget):
    best = None
    for groups in splits(items):
        budgets = [text_budget] + [PAGE_MM - 3] * (len(groups) - 1)
        if not all(fits(g, b) or len(g) == 1 for g, b in zip(groups, budgets)):
            continue
        # space left on the last page can hold the next section; gaps before it cannot
        score = (len(groups), sum(free_space(g, b) for g, b in zip(groups[:-1], budgets[:-1])))
        if best is None or score < best[0]:
            best = (score, groups, budgets)
    return best[1], best[2]


SEP_MM = 5.5            # divider between two sections sharing a page


class Flow:
    """Pages fill top to bottom; a section starts mid-page when its text and first screenshot fit."""

    def __init__(self):
        self.body = None
        self.free = 0

    def flush(self):
        if self.body is not None:
            num, _ = start_page()
            close_page(self.body, num)
            self.body = None

    def new_page(self):
        self.flush()
        self.body = ""
        self.free = PAGE_MM - 3


flow = Flow()


def section(text_html, key, part, shots, new_part=False):
    shots = list(shots)
    text_mm = TEXT_HEIGHTS.get(key, 150)
    first_mm = min(natural_mm(shots[0][1]), min_mm(shots[0][1])) + SHOT_EXTRA_MM
    room = -1 if new_part or flow.body is None else flow.free - SEP_MM - text_mm
    if room < 0:
        flow.new_page()
        text_only = False
    else:
        flow.body += '<div class="feature-sep"></div>\n'
        flow.free -= SEP_MM
        text_only = room < first_mm
    heading = "<h3>Screenshots</h3>\n"
    flow.body += f'<section class="feat" data-key="{esc(key)}">\n{text_html}{"" if text_only else heading}</section>\n'
    flow.free -= text_mm
    if text_only:
        flow.new_page()
        flow.body += heading
        flow.free -= 8

    groups, budgets = plan_pages(shots, flow.free)
    idx = 1
    for page_i, (group, budget) in enumerate(zip(groups, budgets)):
        if page_i:
            flow.new_page()
        cap = fill(group, budget)
        flow.body += "\n".join(shot_card(idx + i, part, *it, cap) for i, it in enumerate(group))
        flow.free = budget - sum(min(natural_mm(it[1]), cap) + SHOT_EXTRA_MM for it in group)
        idx += len(group)


def feature(part_label, title, source, description, snippet_file, snippet, part, shots, intro=""):
    body = intro or f'<div class="part">{part_label}</div>\n'
    body += f"""<h2>{esc(title)}</h2>
<p class="source">{esc(source)}</p>
<h3>Description</h3>
<p>{description}</p>
<h3>Code Snippet</h3>
""" + code_block(snippet_file, snippet)
    section(body, title, part, shots, new_part=bool(intro))


# ---------- Cover ----------
n = 1
pages.append("""<div class="page cover">
  <img class="logo" src="assets/vit-logo.png" alt="Vellore Institute of Technology" />
  <h1>Job Application Tracker Using MongoDB</h1>
  <div class="sub">A MongoDB Based Full Stack Project for Application Pipeline Tracking</div>
  <div class="badges"><span class="badge">MongoDB</span><span class="badge">Express</span><span class="badge">React</span><span class="badge">Node.js</span></div>
  <div class="bar"></div>
  <div class="review">Review 3</div>
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

U = "Part 1 · User-Defined"
M = "Part 2 · MongoDB"

# ---------- Part 1 ----------
feature(
    U, "1.1. Interview Rounds Timeline",
    "React: client/src/pages/ApplicationDetail.jsx · Backend: POST / PATCH / DELETE /api/applications/:id/rounds[/:roundId]",
    "Every application now has its own timeline of interview rounds — online assessment, technical, managerial, HR, or group discussion — each with a date, a result (Pending, Passed, Failed) and free-text feedback. The student adds a round from the detail page, marks it Passed or Failed with one click, and sees how many rounds have been cleared. A status history card records every stage change with its timestamp, so the full journey of an application is visible in one place.",
    "client/src/pages/ApplicationDetail.jsx",
    """async function addRound(e) {
  e.preventDefault();
  const ok = await run(
    api.post(`/applications/${app._id}/rounds`, { ...draft, scheduledAt: draft.scheduledAt || null })
  );
  if (ok) { setDraft(emptyRound); setAdding(false); }
}
function setResult(round, result) {
  run(api.patch(`/applications/${app._id}/rounds/${round._id}`, { result }));
}
function removeRound(round) {
  if (!window.confirm(`Remove "${round.name}"?`)) return;
  run(api.delete(`/applications/${app._id}/rounds/${round._id}`));
}""",
    "1",
    [
        ("Initial State — No Rounds Yet", "ui3_rounds_initial.png", "Amazon application before any interview round is recorded."),
        ("Action — Add a Round", "ui3_rounds_form.png", "Round form filled with an Online assessment (OA) on 25 Oct with notes."),
        ("Result — Timeline and Status History", "ui3_rounds_result.png", "Recruiter call marked Passed, the OA pending, “1 of 2 cleared”, and the status history updated to OA."),
    ],
    intro='<div class="part">Part 1: User-Defined Application Features</div>\n<p class="source">New features added in Review 3 — React flows backed by new API endpoints</p>\n',
)

feature(
    U, "1.2. Response Tracker (Ghosting Detector)",
    "React: client/src/pages/Insights.jsx · Backend: GET /api/insights/ghosting?days=, GET /api/insights/trend",
    "Students rarely know which companies have silently dropped them. The Response tracker lists every application still waiting in Applied or OA, shows how many days it has been silent, ranks it within its source, and flags it as <b>ghosted</b> once it crosses a threshold the student picks (14, 21 or 30 days) — unless a round is already booked. It also ranks sources by how quickly they reply and plots applications per month, so the student learns where applying actually pays off.",
    "client/src/pages/Insights.jsx",
    """async function load(threshold = days) {
  const [g, t] = await Promise.all([
    api.get('/insights/ghosting', { params: { days: threshold } }),
    api.get('/insights/trend', { params: { months: 12 } }),
  ]);
  setGhost(g.data);
  setTrend(t.data);
}
useEffect(() => { load(days); }, [days]);   // THRESHOLDS = [14, 21, 30]
useLiveRefresh(() => load(days));""",
    "1",
    [
        ("Initial State — 21-Day Threshold", "ui3_insights_21.png", "Response tracker: 5 applications waiting, Razorpay ghosted after 34 silent days, LinkedIn the fastest source."),
        ("Action — Switch to 14 Days", "ui3_insights_14.png", "Threshold changed to 14 days; Zoho stays unflagged despite 47 silent days because a round is booked."),
        ("Result — Source Ranking and Monthly Trend", "ui3_insights_charts.png", "Reply speed ranked by source, and applications per month with empty months shown as zero."),
    ],
)

feature(
    U, "1.3. Duplicate Application Guard",
    "React: client/src/pages/ApplicationForm.jsx · Backend: GET /api/applications/duplicates, POST /api/applications (409 DUPLICATE_APPLICATION)",
    "While the student types a company and role, the form checks in the background whether an active application for the same pair already exists — ignoring letter case, so “google / software engineer intern” matches “Google / Software Engineer Intern”. A warning links straight to the existing record, and the server refuses to save the duplicate. Re-applying is still allowed once the earlier attempt is closed (for example a rejected Flipkart application).",
    "client/src/pages/ApplicationForm.jsx",
    """useEffect(() => {
  const company = form.company.trim();
  const role = form.role.trim();
  if (company.length < 2 || !role || form.status === 'Rejected') {
    setDuplicate(null);
    return undefined;
  }
  const timer = setTimeout(async () => {
    const { data } = await api.get('/applications/duplicates', {
      params: { company, role, excludeId: id },
    });
    setDuplicate(data.duplicate);
  }, 350);
  return () => clearTimeout(timer);
}, [form.company, form.role, form.status, id]);""",
    "1",
    [
        ("Action — Typing an Existing Company and Role", "ui3_dup_warning.png", "“google / software engineer intern” triggers “You already applied here” with a link to the Interview-stage record."),
        ("Result — Save Blocked", "ui3_dup_blocked.png", "Submitting anyway is rejected by the server: an active application for this company and role already exists."),
        ("Result — Re-applying After Rejection Is Allowed", "ui3_dup_allowed.png", "“flipkart / sde intern” is saved because the earlier Flipkart application is Rejected."),
    ],
)

feature(
    U, "1.4. Custom Fields and Tags",
    "React: client/src/pages/ApplicationForm.jsx, Applications.jsx · Backend: GET /api/applications?tag=&field=&value=, GET /api/applications/tags",
    "Every company asks for something different — a CGPA cutoff, a bond period, a tech stack, a work mode. Instead of fixed columns, the student adds any number of named custom fields and free tags to an application. Values are typed automatically (numbers, yes/no, text), shown as a grid on the detail page, and the Applications board can be filtered by a tag or by any custom field and value.",
    "client/src/pages/ApplicationForm.jsx",
    """function fromFieldRows(rows) {
  const out = {};
  rows.forEach(({ key, value }) => {
    const name = key.trim();
    if (!name) return;
    const text = value.trim();
    if (text === 'yes' || text === 'true') out[name] = true;
    else if (text === 'no' || text === 'false') out[name] = false;
    else if (text !== '' && !Number.isNaN(Number(text))) out[name] = Number(text);
    else out[name] = text;
  });
  return out;
}""",
    "1",
    [
        ("Action — Adding Custom Fields and Tags", "ui3_fields_form.png", "Razorpay edited with tags fintech, referral, dream and fields Stack, CGPA cutoff, Work mode."),
        ("Result — Fields on the Detail Page", "ui3_fields_detail.png", "Custom fields grid and tag chips on the Razorpay detail page."),
        ("Result — Filter by Custom Field", "ui3_filter_field.png", "Board filtered to CGPA cutoff = 8 returns only Google."),
    ],
)

feature(
    U, "1.5. Live Notifications, Reminders and Theme Toggle",
    "React: client/src/components/NotificationBell.jsx, ThemeToggle.jsx · Backend: GET /api/notifications, GET /api/notifications/stream (Server-Sent Events)",
    "A notification bell in the sidebar collects reminders the student would otherwise miss — overdue follow-ups, follow-ups and assessments due soon, and offer reply deadlines — together with a feed of recent activity. The feed is live: when an application changes in another tab or through the API, a toast appears and every open page refreshes without reloading. A light/dark switch in the sidebar and on the login page remembers the student’s choice.",
    "client/src/components/NotificationBell.jsx",
    """const source = new EventSource(liveStreamUrl());
source.addEventListener('activity', (e) => {
  const payload = JSON.parse(e.data);
  setData((prev) => ({ ...prev, unread: prev.unread + 1,
    activity: [payload.notification, ...prev.activity].slice(0, 30) }));
  setFlash(payload.notification.message);
  window.dispatchEvent(new CustomEvent('jobtrack:activity', { detail: payload }));
});
// ThemeContext: document.documentElement.dataset.theme = theme;
//               localStorage.setItem('jobtrack_theme', theme);""",
    "1",
    [
        ("Action — Open the Notification Bell", "ui3_bell_panel.png", "Reminders (overdue, follow-up, assessment, offer deadline) and the live activity feed."),
        ("Result — Live Update Toast", "ui3_live_toast.png", "CRED moved to OA elsewhere; the toast “Live · CRED moved to OA” appears and the list refreshes."),
        ("Result — Dark Mode", "ui3_theme_dark.png", "Dashboard after one click on the sidebar toggle (every other screenshot in this report is light mode); the choice is remembered."),
    ],
)

feature(
    U, "1.6. Offer Comparison",
    "React: client/src/pages/Offers.jsx · Backend: GET /api/insights/offers",
    "When more than one offer arrives, the student has to decide quickly. The Compare offers page ranks every offer by stipend, shows how far each one is below the best, counts down to the reply deadline, and lines the offers up side by side — including how long each took and how many rounds were cleared. Any custom fields added to the offers (bond months, PPO chance, work mode) automatically become extra rows in the comparison table.",
    "client/src/pages/Offers.jsx",
    """function load() {
  api.get('/insights/offers').then(({ data: res }) => setData(res));
}
useEffect(load, []);
useLiveRefresh(load);

const { offers, fieldNames } = data;
{offers.map((offer) => (
  <div className={`card offer-card ${offer.stipendRank === 1 ? 'best' : ''}`}>
    <span className="offer-rank">#{offer.stipendRank}</span> ...
))}""",
    "1",
    [
        ("Result — Compare Offers Page", "ui3_offers_page.png", "Atlassian ranked #1 by stipend; PhonePe ₹5,000 below the best offer with 8 days left."),
        ("Offer Cards", "ui3_offers_cards.png", "Rank, stipend, gap to the best offer, and a colour-coded reply deadline."),
        ("Side-by-Side Table", "ui3_offers_table.png", "Built-in rows plus the custom fields Bond months, PPO chance and Work mode."),
    ],
)

feature(
    U, "1.7. CSV Import and Export",
    "React: client/src/pages/Applications.jsx · Backend: POST /api/applications/import, GET /api/applications/export",
    "Most students already keep a spreadsheet of applications. Import CSV reads that sheet, validates each row, saves the good ones in one go, and reports exactly which rows were skipped as duplicates or rejected and why. Export CSV downloads the current board — respecting any status, tag or field filter — so the data can be shared or backed up in Excel or Google Sheets.",
    "client/src/pages/Applications.jsx",
    """async function importFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const csv = await file.text();
    const { data } = await api.post('/applications/import', { csv });
    setResult(data);   // { inserted, totalRows, duplicates[], rejected[] }
    onDone();
  } catch (err) {
    setError(err.response?.data?.message || 'Could not import this file.');
  }
}
// Export: downloadApplicationsCsv(filterParams()) -> GET /applications/export""",
    "1",
    [
        ("Initial State — Import Panel", "ui3_import_panel.png", "Import panel listing the required and optional CSV columns."),
        ("Result — Import Summary", "ui3_import_result.png", "3 of 5 rows imported; row 5 skipped as a duplicate of Amazon, row 6 rejected for a missing role."),
        ("Result — Exported CSV", "csv_export.png", "Export of the board filtered to #fintech: CRED, Razorpay and PhonePe."),
    ],
)

# ---------- Part 2 ----------
feature(
    M, "2.1. Embedded Sub-documents and Array Update Operators",
    "Backend: server/models/Application.js (roundSchema, statusEventSchema), server/controllers/applicationController.js",
    "Interview rounds and status history are stored as arrays of embedded sub-documents inside the application, because they are always read together with it and never queried alone. Rounds are added with <b>$push</b> using <b>$each</b> + <b>$sort</b> so the array stays in date order, a single round is edited in place with the positional filtered operator <b>$[round]</b> and <b>arrayFilters</b>, and removed with <b>$pull</b>. Status changes are appended to statusHistory with <b>$slice</b> to cap its size.",
    "server/controllers/applicationController.js",
    """// add, keeping rounds sorted by date
{ $push: { rounds: { $each: [round], $sort: { scheduledAt: 1 } } } }

// edit one round in place
Application.findOneAndUpdate(
  { _id: req.params.id, userId, 'rounds._id': req.params.roundId },
  { $set: { 'rounds.$[round].result': 'Passed' } },
  { new: true, arrayFilters: [{ 'round._id': new ObjectId(req.params.roundId) }] }
);

// remove
{ $pull: { rounds: { _id: req.params.roundId } } }""",
    "2",
    [
        ("MongoDB Shell — $push, arrayFilters, $slice", "mongo3_embedded_a.png", "Three updates on Amazon: push two rounds sorted by date, mark one Passed via arrayFilters, append to statusHistory."),
        ("MongoDB Shell — Resulting Document", "mongo3_embedded_b.png", "Amazon now embeds both rounds (Recruiter call Passed) and two status events."),
        ("UI — Rounds Rendered from the Array", "ui3_rounds_result.png", "The same embedded arrays drive the rounds timeline and status history."),
    ],
    intro='<div class="part">Part 2: Advanced NoSQL / MongoDB DBMS Features</div>\n<p class="source">New MongoDB features added in Review 3 — verified in the MongoDB shell on a replica set</p>\n',
)

feature(
    M, "2.2. Window Functions — $setWindowFields and $dateDiff",
    "Backend: server/controllers/insightsController.js · GET /api/insights/ghosting, GET /api/insights/offers",
    "The Response tracker and Offer comparison are computed entirely in the aggregation pipeline. <b>$dateDiff</b> turns the last status change into “days waiting”. <b>$setWindowFields</b> then partitions by source and computes, for every document, its <b>$rank</b> inside that source and the source’s <b>$avg</b> wait over the whole partition — without collapsing documents like $group would. The same operator ranks sources with <b>$denseRank</b> and ranks offers by stipend.",
    "server/controllers/insightsController.js",
    """{ $addFields: { daysWaiting: {
    $dateDiff: { startDate: '$lastMove', endDate: '$$NOW', unit: 'day' } } } },
{ $setWindowFields: {
    partitionBy: '$source',
    sortBy: { daysWaiting: -1 },
    output: {
      rankInSource: { $rank: {} },
      sourceAvgWait: { $avg: '$daysWaiting',
                       window: { documents: ['unbounded', 'unbounded'] } },
    } } },""",
    "2",
    [
        ("MongoDB Shell — $dateDiff + $setWindowFields", "mongo3_window.png", "Each waiting application keeps its own row with daysWaiting, rankInSource and sourceAvgWait."),
        ("UI — $denseRank over Sources", "ui3_insights_charts.png", "Reply-speed ranking by source and the monthly trend computed in the pipeline."),
        ("UI — $rank over Offers", "ui3_offers_cards.png", "Offers ranked by stipend with the gap to the best offer from a window $max."),
    ],
)

feature(
    M, "2.3. Collation-Aware Partial Unique Index",
    "Backend: server/models/Application.js · Index: unique_active_company_role",
    "Duplicates are blocked by the database itself. A unique index on { userId, company, role } uses a case-insensitive <b>collation</b> (strength 2) and a <b>partialFilterExpression</b> so only active applications take part: “Google” and “GOOGLE” collide with E11000, yet re-applying after a rejection is allowed.",
    "server/models/Application.js",
    """applicationSchema.index(
  { userId: 1, company: 1, role: 1 },
  {
    name: 'unique_active_company_role',
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },  // Saved … Offer
  }
);""",
    "2",
    [
        ("MongoDB Shell — Index Definition", "mongo3_unique_a.png", "unique: true, collation strength 2 and the partial filter on active statuses."),
        ("MongoDB Shell — E11000 vs Allowed Insert", "mongo3_unique_b.png", "“GOOGLE” is rejected with E11000; “flipkart” is accepted because the earlier one is Rejected."),
        ("UI — Duplicate Blocked", "ui3_dup_blocked.png", "The 409 from the index is shown to the student as a clear message."),
    ],
)

feature(
    M, "2.4. Multikey Index on Tags and Compound Wildcard Index",
    "Backend: server/models/Application.js · Indexes: user_tags_multikey, user_custom_fields_wildcard",
    "Tags are an array, so an index on { userId, tags } becomes a <b>multikey index</b> with one entry per tag, and a filter like tags: \"fintech\" is an index scan. Custom fields have names the developer never knows in advance; a <b>compound wildcard index</b> on { userId, \"customFields.$**\" } (MongoDB 7.0+) indexes every sub-field, so a query on any field — CGPA cutoff, Bond months — still uses an index while staying scoped to the user.",
    "server/models/Application.js",
    """tags: { type: [String], default: [],
  set: (values) => [...new Set((values || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))] },
customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

applicationSchema.index({ userId: 1, tags: 1 }, { name: 'user_tags_multikey' });
applicationSchema.index(
  { userId: 1, 'customFields.$**': 1 },
  { name: 'user_custom_fields_wildcard' }
);""",
    "2",
    [
        ("MongoDB Shell — Indexes and Chosen Plans", "mongo3_flexible_a.png", "Both indexes exist; the tag query and custom-field query each use IXSCAN on their index."),
        ("MongoDB Shell — Queries", "mongo3_flexible_b.png", "tags: \"fintech\" returns CRED, Razorpay, PhonePe; CGPA cutoff ≥ 8 returns Google and Goldman Sachs."),
        ("UI — Tag Filter", "ui3_filter_tag.png", "The board filtered by #fintech runs the same multikey query."),
    ],
)

feature(
    M, "2.5. Change Streams with Pre-Images",
    "Backend: server/config/realtime.js, server/config/db.js (single-node replica set) · GET /api/notifications/stream",
    "The API opens a <b>change stream</b> on the applications collection — a feed of every insert, update and delete read from the replica set’s oplog. Each event is turned into a stored notification and pushed to that user’s open tabs over Server-Sent Events. <b>changeStreamPreAndPostImages</b> is enabled with collMod so that <b>fullDocumentBeforeChange</b> is available: a delete event can still say which company was removed. Change streams need a replica set, so the embedded database now starts as a single-node replica set.",
    "server/config/realtime.js",
    """await db.command({
  collMod: 'applications',
  changeStreamPreAndPostImages: { enabled: true },
});
stream = Application.watch(
  [{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }],
  { fullDocument: 'updateLookup', fullDocumentBeforeChange: 'whenAvailable' }
);
stream.on('change', (change) => handleChange(change));
// handleChange -> Notification.create(...) -> publish(userId, 'activity', ...)""",
    "2",
    [
        ("MongoDB Shell — Replica Set and Pre-Images", "mongo3_changestream_a.png", "db.hello() shows replica set testset; collMod enables pre- and post-images."),
        ("MongoDB Shell — Captured Events", "mongo3_changestream_b.png", "update (CRED Applied → OA with before/after), insert and delete (Notion, with pre-image)."),
        ("UI — Event Delivered Live", "ui3_live_toast.png", "The CRED update arrives in the browser as a toast within a second."),
    ],
)

feature(
    M, "2.6. Gap Filling with $densify and $fill",
    "Backend: server/controllers/insightsController.js · GET /api/insights/trend",
    "A plain <b>$group</b> by month silently skips months with no applications, which makes a monthly chart look continuous when it is not. After grouping with <b>$dateTrunc</b>, <b>$densify</b> inserts the missing months across the last 12 months and <b>$fill</b> sets their count to 0. A final <b>$setWindowFields</b> computes a 3-month rolling average and a running total over the now-complete series, and the UI reports how many months were empty.",
    "server/controllers/insightsController.js",
    """{ $group: { _id: { $dateTrunc: { date: '$appliedDate', unit: 'month' } },
            count: { $sum: 1 } } },
{ $project: { _id: 0, month: '$_id', count: 1 } },
{ $densify: { field: 'month', range: { step: 1, unit: 'month', bounds: [lower, upper] } } },
{ $fill: { output: { count: { value: 0 } } } },
{ $setWindowFields: { sortBy: { month: 1 }, output: {
    rollingAvg: { $avg: '$count', window: { documents: [-2, 'current'] } },
    cumulative: { $sum: '$count', window: { documents: ['unbounded', 'current'] } } } } }""",
    "2",
    [
        ("MongoDB Shell — $group Alone", "mongo3_densify_a.png", "Only 6 months appear; February, April, May and June are missing."),
        ("MongoDB Shell — With $densify + $fill", "mongo3_densify_b.png", "All 12 months present; filled months have count 0 and the rolling average stays honest."),
        ("UI — Applications per Month", "ui3_insights_charts.png", "Empty months drawn as zero bars with the 3-month average line."),
    ],
)

feature(
    M, "2.7. Query Plan Inspection with explain()",
    "Backend: server/controllers/applicationController.js · GET /api/applications/explain",
    "The Query plan button on the Applications board runs <b>explain(\"executionStats\")</b> on exactly the query the board is showing, and runs it again with <b>hint({ $natural: 1 })</b> to force a collection scan. Both plans are shown side by side — winning stages, index used, keys and documents examined — so the student can see that the tag filter and custom-field filter are served by the multikey and wildcard indexes and examine only the matching documents instead of the whole collection.",
    "server/controllers/applicationController.js",
    """async function explainQuery(req, res) {
  const filter = buildListFilter(req);   // same filter as the board
  const indexed = await Application.find(filter).explain('executionStats');
  const plan = summarizePlan(indexed);

  const scanned = await Application.find(filter)
    .hint({ $natural: 1 })
    .explain('executionStats');
  res.json({ filter, plan, collectionScan: summarizePlan(scanned) });
}""",
    "2",
    [
        ("MongoDB Shell — IXSCAN vs COLLSCAN", "mongo3_explain_a.png", "The fintech tag query examines 3 documents with the index and 16 with a forced collection scan."),
        ("UI — Tag Filter Plan", "ui3_plan_tag.png", "FETCH → IXSCAN on user_tags_multikey: 3 keys, 3 documents; the collection scan reads all 17."),
        ("UI — Custom Field Plan", "ui3_plan_field.png", "CGPA cutoff = 8 uses user_custom_fields_wildcard and examines 1 document instead of 17."),
    ],
)

# ---------- Part 3 ----------
body = """<div class="part">Part 3: Tools &amp; Verification</div>
<p class="source">Local running stack used for this review</p>
<p>The system was demonstrated on a local MERN stack. MongoDB 7.0 ran on this machine as an embedded <b>single-node replica set</b> (required for change streams), the Express API at <b>http://localhost:5000</b>, and the React client at <b>http://localhost:5173</b>. Screenshots were taken from the running application in light mode, and every MongoDB output in Part 2 is real output captured from the same database.</p>
<h3>Tools Used</h3>
<p><b>Database:</b> MongoDB 7.0 (replica set, change streams, wildcard indexes) · <b>Backend:</b> Node.js, Express, Mongoose, Server-Sent Events · <b>Frontend:</b> React, Vite, Recharts · <b>Verification:</b> MongoDB shell commands, explain(\"executionStats\"), browser testing.</p>
"""
section(body, "Part 3: Tools & Verification", "3", [
    ("Running Frontend — Light Mode", "ui3_login_light.png", "Application running locally at http://localhost:5173 with the theme toggle."),
    ("Database and API Health", "mongo3_stack.png", "Collections applications, notifications and users on replica set testset; /api/health reports changeStreams: true."),
])
flow.flush()

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Job Application Tracker Using MongoDB — Review 3</title>
  <link rel="stylesheet" href="report.css" />
</head>
<body>
{''.join(pages)}
</body>
</html>
"""

OUT.write_text(html)
print(f"Wrote {OUT} with {len(pages)} page divs")
