// Run with the API (:5000) and Vite (:5173) running, on freshly seeded data:
//   node --experimental-websocket report/review3/capture_ui.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:5000/api';
const PORT = 9334;
const W = 1366;
const H = 860;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  'google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/review3-chrome',
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

let ws;
let msgId = 0;
const pending = new Map();
const errors = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    msgId += 1;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(`${expression.slice(0, 80)} -> ${res.result.exceptionDetails.exception?.description}`);
  return res.result?.result?.value;
}

const HELPERS = `
window.__set = (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
window.__q = (sel) => document.querySelector(sel);
window.__btn = (text) => [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === text);
window.__card = (heading) => [...document.querySelectorAll('.card')].find((c) => c.querySelector('h2')?.textContent.trim() === heading);
`;

async function go(route, wait = 2200) {
  await send('Page.navigate', { url: `${APP}${route}` });
  await sleep(wait);
  await evaluate(HELPERS);
}

async function capture(name, { selector, pad = 14, full = false, region } = {}) {
  let clip;
  if (selector) {
    const rect = await evaluate(`(() => { const el = ${selector}; el.scrollIntoView({ block: 'start' }); const r = el.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; })()`);
    await sleep(300);
    clip = { x: Math.max(0, rect.x - pad), y: Math.max(0, rect.y - pad), width: rect.w + pad * 2, height: rect.h + pad * 2, scale: 1 };
  } else if (region) {
    clip = { ...region, scale: 1 };
  } else if (full) {
    const h = await evaluate('Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)');
    clip = { x: 0, y: 0, width: W, height: h, scale: 1 };
  }
  await evaluate('window.scrollTo(0, 0); true');
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? { clip } : {}) });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(res.result.data, 'base64'));
  console.log('saved', name);
}

async function api(method, route, token, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

(async () => {
  let target;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(250);
    try {
      target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page');
    } catch (_e) { /* chrome starting */ }
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description);
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1.5, mobile: false });

  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'abhijaymishra07@gmail.com', password: 'Demo@123' }),
  })).json();
  const token = login.token;

  await go('/login', 1200);
  await evaluate(`localStorage.setItem('jobtrack_theme', 'light'); localStorage.removeItem('jobtrack_token'); true`);
  await go('/login', 1500);
  await capture('ui3_login_light');
  await evaluate(`localStorage.setItem('jobtrack_token', ${JSON.stringify(token)}); true`);

  const { applications } = await api('GET', '/applications?limit=50', token);
  const byCompany = (c) => applications.find((a) => a.company === c);
  const amazon = byCompany('Amazon');
  const google = byCompany('Google');
  const razorpay = byCompany('Razorpay');

  // 1.1 Interview rounds
  await go(`/applications/${amazon._id}`);
  await capture('ui3_rounds_initial');
  await evaluate(`__btn('Add round').click(); true`);
  await sleep(400);
  await evaluate(`(() => {
    const f = __q('.round-form');
    __set(f.querySelector('input'), 'Online assessment');
    __set(f.querySelectorAll('select')[0], 'OA');
    const d = new Date(Date.now() + 4 * 864e5); d.setHours(10, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    __set(f.querySelector('input[type=datetime-local]'), d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T10:00');
    __set(f.querySelector('textarea'), 'HackerRank: 2 DSA questions + 10 MCQs on OS and DBMS');
    return true; })()`);
  await sleep(300);
  await capture('ui3_rounds_form', { selector: `__card('Interview rounds')` });
  await evaluate(`__btn('Save round').click(); true`);
  await sleep(1200);
  await evaluate(`__btn('Add round').click(); true`);
  await sleep(300);
  await evaluate(`(() => {
    const f = __q('.round-form');
    __set(f.querySelector('input'), 'Recruiter screening call');
    __set(f.querySelectorAll('select')[0], 'HR');
    const d = new Date(Date.now() - 1 * 864e5);
    const pad = (n) => String(n).padStart(2, '0');
    __set(f.querySelector('input[type=datetime-local]'), d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T16:30');
    __set(f.querySelectorAll('select')[1], 'Passed');
    __set(f.querySelector('textarea'), 'Shortlisted for the OA');
    return true; })()`);
  await evaluate(`__btn('Save round').click(); true`);
  await sleep(1200);
  await evaluate(`(() => { const s = __card('Status').querySelector('select'); __set(s, 'OA'); return true; })()`);
  await sleep(1500);
  await capture('ui3_rounds_result');
  await go(`/applications/${google._id}`);
  await capture('ui3_rounds_google');

  // 1.2 Response tracker
  await go('/insights', 3500);
  await capture('ui3_insights_21');
  await evaluate(`__btn('14 days').click(); true`);
  await sleep(1500);
  await capture('ui3_insights_14', { selector: `__card('Still waiting')` });
  await capture('ui3_insights_charts', { selector: `__q('.charts')` });

  // 1.3 Duplicate guard
  await go('/applications/new');
  await evaluate(`__set(__q('input[name=company]'), 'google'); __set(__q('input[name=role]'), 'software engineer intern'); true`);
  await sleep(1500);
  await capture('ui3_dup_warning');
  await evaluate(`__btn('Create application').click(); true`);
  await sleep(1200);
  await capture('ui3_dup_blocked', { region: { x: 0, y: 0, width: W, height: 430 } });
  await go('/applications/new');
  await evaluate(`__set(__q('input[name=company]'), 'flipkart'); __set(__q('input[name=role]'), 'sde intern'); __set(__q('input[name=tags]'), 'retry'); true`);
  await sleep(1500);
  await evaluate(`__btn('Create application').click(); true`);
  await sleep(2000);
  await capture('ui3_dup_allowed');

  // 1.4 Custom fields & tags
  await go(`/applications/${razorpay._id}/edit`);
  await sleep(800);
  await evaluate(HELPERS);
  await evaluate(`__set(__q('input[name=tags]'), 'fintech, referral, dream'); true`);
  await evaluate(`__btn('Add custom field').click(); true`);
  await sleep(200);
  await evaluate(`__btn('Add custom field').click(); true`);
  await sleep(200);
  await evaluate(`(() => {
    const rows = document.querySelectorAll('.field-row');
    __set(rows[1].querySelectorAll('input')[0], 'CGPA cutoff'); __set(rows[1].querySelectorAll('input')[1], '7.5');
    __set(rows[2].querySelectorAll('input')[0], 'Work mode'); __set(rows[2].querySelectorAll('input')[1], 'Onsite');
    return true; })()`);
  await sleep(300);
  await capture('ui3_fields_form', { selector: `__q('.form')`, pad: 10 });
  await evaluate(`__btn('Save changes').click(); true`);
  await sleep(2000);
  await capture('ui3_fields_detail');
  await go('/applications');
  await evaluate(`__set(document.querySelectorAll('.toolbar select')[1], 'fintech'); true`);
  await sleep(1500);
  await capture('ui3_filter_tag');
  await evaluate(`__btn('Clear').click(); true`);
  await sleep(1200);
  await evaluate(`__set(document.querySelectorAll('.toolbar select')[2], 'CGPA cutoff'); true`);
  await sleep(300);
  await evaluate(`__set(__q('.toolbar input.narrow'), '8'); __btn('Search').click(); true`);
  await sleep(1500);
  await capture('ui3_filter_field');

  // 7 (MongoDB) Query plan UI
  await evaluate(`__btn('Query plan').click(); true`);
  await sleep(1500);
  await capture('ui3_plan_field');
  await evaluate(`__btn('Clear').click(); true`);
  await sleep(1000);
  await evaluate(`__set(document.querySelectorAll('.toolbar select')[1], 'fintech'); true`);
  await sleep(1800);
  await capture('ui3_plan_tag');

  // 1.5 Notifications + theme toggle
  await go('/');
  await evaluate(`__q('.bell').click(); true`);
  await sleep(1500);
  await capture('ui3_bell_panel', { region: { x: 0, y: 0, width: 760, height: 820 } });
  await go('/applications', 2500);
  const cred = byCompany('CRED');
  await api('PATCH', `/applications/${cred._id}`, token, { status: 'OA' });
  await sleep(1300);
  await capture('ui3_live_toast');
  await api('PATCH', `/applications/${cred._id}`, token, { status: 'Applied' });
  await sleep(500);
  await go('/', 2500);
  await capture('ui3_theme_light');
  await evaluate(`__q('.theme-toggle').click(); true`);
  await sleep(1200);
  await capture('ui3_theme_dark');
  await evaluate(`localStorage.setItem('jobtrack_theme', 'light'); true`);

  // 1.6 Offers
  await go('/offers', 2500);
  await capture('ui3_offers_cards', { selector: `__q('.offer-grid')` });
  await capture('ui3_offers_table', { selector: `__card('Side by side')` });
  await capture('ui3_offers_page');

  // 1.7 CSV import / export
  const csvPath = '/tmp/review3_import.csv';
  fs.writeFileSync(
    csvPath,
    [
      'Company,Role,Status,Source,Salary,Tags,Applied Date,Notes',
      'Notion,Product Engineer Intern,Applied,LinkedIn,60000,startup;remote,2026-10-14,Applied through careers page',
      '"Stripe, Inc",SDE Intern,Applied,Referral,,payments,2026-10-12,Referral from senior',
      'Postman,Backend Intern,OA,Campus,55000,campus,2026-10-05,OA next week',
      'Amazon,sde intern,Applied,Other,,,,Already tracked',
      'Freshworks,,Applied,LinkedIn,,,,Role missing',
    ].join('\n') + '\n'
  );
  await go('/applications');
  await evaluate(`__btn('Import CSV').click(); true`);
  await sleep(500);
  await capture('ui3_import_panel', { selector: `__q('.import-panel')` });
  const doc = await send('DOM.getDocument', { depth: -1 });
  const node = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '.import-panel input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: node.result.nodeId, files: [csvPath] });
  await sleep(2500);
  await capture('ui3_import_result');

  const exported = await (await fetch(`${API}/applications/export`, { headers: { Authorization: `Bearer ${token}` } })).text();
  fs.writeFileSync(path.join(__dirname, 'export_sample.csv'), exported);

  console.log('page errors:', JSON.stringify(errors));
  ws.close();
  chrome.kill();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
