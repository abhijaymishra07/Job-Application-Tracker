// Renders evidence.json as light mongosh-style panels and screenshots each one.
//   node --experimental-websocket report/review3/render_evidence.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets');
const HTML = path.join(__dirname, 'evidence.html');
const PORT = 9335;
const evidence = JSON.parse(fs.readFileSync(path.join(__dirname, 'evidence.json'), 'utf8'));

const PANELS = [
  ['mongo3_embedded_a', 'embedded', [0, 1, 2]],
  ['mongo3_embedded_b', 'embedded', [3]],
  ['mongo3_window', 'window', [0]],
  ['mongo3_unique_a', 'unique', [0]],
  ['mongo3_unique_b', 'unique', [1, 2, 3]],
  ['mongo3_flexible_a', 'flexible', [0, 3]],
  ['mongo3_flexible_b', 'flexible', [1, 2]],
  ['mongo3_changestream_a', 'changestream', [0, 1]],
  ['mongo3_changestream_b', 'changestream', [2]],
  ['mongo3_densify_a', 'densify', [0]],
  ['mongo3_densify_b', 'densify', [1]],
  ['mongo3_explain_a', 'explain', [0, 1]],
  ['mongo3_explain_b', 'explain', [2]],
  ['mongo3_stack', 'stack', [0, 1, 2]],
];

const csvLines = fs.readFileSync(path.join(__dirname, 'export_sample.csv'), 'utf8').trim().split('\n');
evidence.csv = {
  title: 'Export CSV — streamed from a MongoDB cursor',
  blocks: [
    [
      `curl -H "Authorization: Bearer <token>" "http://localhost:5000/api/applications/export?tag=fintech" -o applications.csv && cat applications.csv`,
      csvLines.join('\n'),
    ],
  ],
};
PANELS.push(['csv_export', 'csv', [0]]);

const WIDTH = 118;
const isPlain = (v) => v === null || typeof v !== 'object';

function scalar(v) {
  if (typeof v === 'string') {
    if (/^ObjectId\('[0-9a-f]+'\)$/.test(v)) return v;
    return JSON.stringify(v);
  }
  return String(v);
}

function key(k) {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
}

function inline(v) {
  if (isPlain(v)) return scalar(v);
  if (Array.isArray(v)) return v.length ? `[ ${v.map(inline).join(', ')} ]` : '[]';
  const entries = Object.entries(v);
  return entries.length ? `{ ${entries.map(([k, x]) => `${key(k)}: ${inline(x)}`).join(', ')} }` : '{}';
}

function shell(v, indent = 0) {
  const pad = ' '.repeat(indent);
  const flat = inline(v);
  if (isPlain(v) || pad.length + flat.length <= WIDTH) return flat;
  const inner = ' '.repeat(indent + 2);
  if (Array.isArray(v)) return `[\n${v.map((x) => inner + shell(x, indent + 2)).join(',\n')}\n${pad}]`;
  return `{\n${Object.entries(v).map(([k, x]) => `${inner}${key(k)}: ${shell(x, indent + 2)}`).join(',\n')}\n${pad}}`;
}

function formatOutput(text) {
  try {
    return { text: shell(JSON.parse(text)), error: false };
  } catch (_e) {
    const error = /Error/.test(text);
    const cleaned = text.replace(/collation: \{[^}]*\}/, 'collation: { locale: "en", strength: 2, … }');
    return { text: cleaned, error };
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function commandHtml(raw) {
  const cmd = raw.replace(/^GET (\S+)/, 'curl -s $1');
  const head = cmd.startsWith('curl') ? 'abhijay@dbms:~$' : 'testset [primary] job-tracker&gt;';
  return cmd
    .split('\n')
    .map((line, i) => {
      const prompt = i === 0 ? `<span class="prompt">${head}</span> ` : '<span class="prompt cont">...</span> ';
      if (line.trimStart().startsWith('//')) return `${prompt}<span class="comment">${esc(line)}</span>`;
      const [code, comment] = line.split(/(?=\s\/\/ )/);
      return prompt + esc(code) + (comment ? `<span class="comment">${esc(comment)}</span>` : '');
    })
    .join('\n');
}

const panels = PANELS.map(([name, section, idx]) => {
  const { title, blocks } = evidence[section];
  const body = idx
    .map((i) => {
      const [cmd, out] = blocks[i];
      const { text, error } = formatOutput(out);
      return `<pre class="cmd">${commandHtml(cmd)}</pre><pre class="out${error ? ' err' : ''}">${esc(text)}</pre>`;
    })
    .join('');
  return `<section class="term" id="${name}">
  <div class="bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="title">${section === 'csv' ? 'bash' : 'mongosh'} · ${esc(title)}</span></div>
  <div class="body">${body}</div>
</section>`;
});

fs.writeFileSync(
  HTML,
  `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@500;600&display=swap');
body { margin: 0; padding: 20px; background: #fff; width: 1000px; }
.term { border: 1px solid #D5DEE8; border-radius: 10px; overflow: hidden; margin-bottom: 30px; background: #FBFCFE; }
.bar { display: flex; align-items: center; gap: 7px; padding: 9px 14px; background: #EEF2F7; border-bottom: 1px solid #D5DEE8; }
.dot { width: 11px; height: 11px; border-radius: 50%; }
.r { background: #F87171; } .y { background: #FBBF24; } .g { background: #34D399; }
.title { margin-left: 10px; font: 600 13px Inter, sans-serif; color: #334155; }
.body { padding: 12px 16px 14px; }
pre { margin: 0; font: 13px/1.5 'JetBrains Mono', monospace; font-variant-ligatures: none; white-space: pre-wrap; word-break: break-word; }
.cmd { color: #0F172A; font-weight: 600; }
.cmd + .out { margin: 4px 0 14px; }
.out:last-child { margin-bottom: 0; }
.out { color: #334155; }
.err { color: #B91C1C; }
.prompt { color: #0F766E; font-weight: 600; }
.prompt.cont { color: #94A3B8; }
.comment { color: #64748B; font-weight: 400; font-style: italic; }
</style></head><body>${panels.join('\n')}</body></html>`
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(
  'google-chrome',
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/review3-evidence', 'about:blank'],
  { stdio: 'ignore' }
);

let ws;
let msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve) => {
    msgId += 1;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
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
  });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1040, height: 900, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: `file://${HTML}` });
  await sleep(2500);

  for (const [name] of PANELS) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => { const r = document.getElementById('${name}').getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height }; })()`,
      returnByValue: true,
    });
    const r = res.result.result.value;
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: r.x - 2, y: r.y - 2, width: r.w + 4, height: r.h + 4, scale: 1 },
    });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
    console.log('saved', name, Math.round(r.h), 'px tall');
  }
  ws.close();
  chrome.kill();
})().catch((err) => {
  console.error(err);
  chrome.kill();
  process.exit(1);
});
