// Reports how full each report page is (print layout, A4 content box).
//   node --experimental-websocket report/review3/measure.js
const { spawn } = require('child_process');
const path = require('path');

const PORT = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(
  'google-chrome',
  ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/review3-measure', 'about:blank'],
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
  const mm = 96 / 25.4;
  await send('Emulation.setDeviceMetricsOverride', { width: Math.round(186 * mm), height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await send('Runtime.enable');
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.consoleAPICalled') console.log('PAGE', msg.params.args.map((a) => a.value).join(' '));
  });
  await send('Page.navigate', { url: `file://${path.join(__dirname, 'index.html')}` });
  await sleep(3000);
  const res = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `[...document.querySelectorAll('.page')].map((p, i) => {
      const main = p.querySelector('.main') || p;
      const leaves = [...main.querySelectorAll('img, p, pre, h1, h2, h3, .codewrap, .part')];
      const used = Math.max(0, ...leaves.map((el) => el.getBoundingClientRect().bottom)) - main.getBoundingClientRect().top;
      const avail = main.getBoundingClientRect().height;
      const title = (p.querySelector('h2') || p.querySelector('.shot-label') || p.querySelector('h1'))?.textContent.slice(0, 40);
      return [i + 1, Math.round(used / ${mm}), Math.round(avail / ${mm}), title];
    })`,
  });
  res.result.result.value.forEach(([page, used, avail, title]) =>
    console.log(`p${String(page).padStart(2)}  used ${String(used).padStart(3)}mm / ${avail}mm  free ${String(avail - used).padStart(4)}mm  ${title}${used > avail ? '  <-- OVERFLOW' : ''}`)
  );

  const heights = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `Object.fromEntries([...document.querySelectorAll('section.feat')].map((s) =>
      [s.dataset.key, Math.ceil(s.getBoundingClientRect().height / ${mm})]))`,
  });
  if (process.argv.includes('--write')) {
    require('fs').writeFileSync(path.join(__dirname, 'text_heights.json'), JSON.stringify(heights.result.result.value, null, 2));
    console.log('wrote text_heights.json');
  }
  ws.close();
  chrome.kill();
})();
