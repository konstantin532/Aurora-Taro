// Dev-only: node tools/shoot.mjs — screenshots + console errors via Chrome DevTools Protocol.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const out = join(root, '_shots');
mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9333;
const base = process.env.AURORA_URL || pathToFileURL(join(root, 'index.html')).href;
const session = process.env.AURORA_SESSION || '';

const targets = (process.argv[2] || 'home').split(',');
const widths = (process.argv[3] || '390,768,1440').split(',').map(Number);
const reduced = process.argv.includes('--reduced');
const viewportOnly = process.argv.includes('--viewport');
const evalArg = process.argv.find((a) => a.startsWith('--eval='));
const evalSrc = evalArg ? (await import('node:fs')).readFileSync(evalArg.slice(7), 'utf8') : '';

const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'aurora-shoot-'))}`, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 150; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(200);
}
if (!ws) { proc.kill(); throw new Error('Chrome DevTools did not start'); }
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level !== 'verbose') logs.push('LOG ' + m.params.entry.level + ' ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
if (session) await send('Network.setCookie', { name: 'sessionid', value: session, url: base });
if (reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

const report = [];
for (const t of targets) {
  for (const w of widths) {
    const h = w < 500 ? 844 : w < 1000 ? 1024 : 900;
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
    logs.length = 0;
    const hash = t === 'home' ? '' : t.startsWith('/') ? t.slice(1) : '#/' + t.replace(/_/g, '/');
    await send('Page.navigate', { url: base + hash });
    await sleep(2000);
    await send('Runtime.evaluate', { awaitPromise: true, expression: `(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 800)); })()` });
    const ev = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
      const d = document.documentElement; const wide = [];
      for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.right > d.clientWidth + 1 && r.width > 0) wide.push(el.tagName.toLowerCase() + '.' + [...el.classList].join('.') + ' r=' + Math.round(r.right)); }
      const imgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.split('/').pop());
      const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style);
      return { scrollW: d.scrollWidth, clientW: d.clientWidth, height: d.scrollHeight, wide: wide.slice(0, 12), brokenImgs: imgs, fonts: [...new Set(fonts)] };
    })()` });
    const info = ev.result.result.value;
    if (evalSrc) {
      const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: evalSrc });
      info.eval = r.result.exceptionDetails ? 'EVAL ERROR ' + JSON.stringify(r.result.exceptionDetails) : r.result.result.value;
    }
    const shotH = Math.min(info.height, 16000);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 });
    const shot = await send('Page.captureScreenshot', { format: 'png', ...(viewportOnly ? {} : { captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: shotH, scale: 1 } }) });
    const name = `${t.replace(/[\/#]+/g, '_').replace(/^_|_$/g, '') || 'home'}-${w}${reduced ? '-rm' : ''}${process.env.SHOT_TAG || ''}.png`;
    await writeFile(join(out, name), Buffer.from(shot.result.data, 'base64'));
    report.push({ name, ...info, logs: [...logs] });
  }
}
console.log(JSON.stringify(report, null, 1));
ws.close(); proc.kill();
process.exit(0);
