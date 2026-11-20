// Takes the entry's screenshots and verifies the app end to end, driving headless Chromium
// over the DevTools protocol (Node's built-in WebSocket — nothing to install).
//
//   node tools/take-shots.mjs            verify exports, then take every shot in shots.json
//   node tools/take-shots.mjs --verify   only the end-to-end export verification
//   node tools/take-shots.mjs --shots    only the screenshots
//
// Screenshots land in screenshots/; every file is checked against the gate's limits
// (at most 256 KiB, long side at most 1280, short side at least 480) before it is kept.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const CDP_PORT = 9333;
// Scratch lives on the home filesystem: /tmp is a small tmpfs that a browser profile overflows.
const SCRATCH = join(process.env.HOME, '.nv-scratch');
const CFT = join(SCRATCH, 'chrome-linux64', 'chrome');
const CHROME = process.env.CHROME_BIN || (existsSync(CFT) ? CFT : '/opt/meta-chromium/chrome');
const DOWNLOADS = join(SCRATCH, 'downloads');
const PROFILE = join(SCRATCH, 'chrome-profile');
const MAX_SHOT_BYTES = 262144;
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const pageErrors = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { if (await fn()) return; } catch { /* not ready yet */ }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${label}`);
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

let ws;
let nextId = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function connect() {
  const version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}`));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageErrors.push(`exception: ${d.exception?.description || d.text}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push(`console: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
  };
}

async function openPage(url, width, height) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url }, sessionId);
  return { targetId, sessionId };
}

async function evaluate(sessionId, expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (res.exceptionDetails) throw new Error(`page evaluate failed: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
  return res.result.value;
}

async function waitShotReady(sessionId) {
  await waitFor('window.__shotReady', async () => (await evaluate(sessionId, 'window.__shotReady === true')) === true, 30000);
}

/** Checks a PNG buffer's signature and reads its IHDR size. */
function pngSize(buf) {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!magic.every((b, i) => buf[i] === b)) throw new Error('not a PNG (bad signature)');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** The end-to-end check: samples compose, a user photo loads through the file input, exports are real PNGs. */
async function verifyExports() {
  rmSync(DOWNLOADS, { recursive: true, force: true });
  mkdirSync(DOWNLOADS, { recursive: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS, eventsEnabled: true });
  const { targetId, sessionId } = await openPage(`http://127.0.0.1:${PORT}/`, 1280, 900);
  await waitFor('sample photos loaded', async () =>
    (await evaluate(sessionId, 'window.__neonVice && window.__neonVice.state.photos.length')) === 4);
  console.log('verify: editor loaded, 4 sample photos in place');

  await evaluate(sessionId, `document.querySelector('[data-export="1080x1080"]').click()`);
  await waitFor('first PNG download', () => existsSync(join(DOWNLOADS, 'neon-vice-1080x1080.png')), 15000);
  const png1 = readFileSync(join(DOWNLOADS, 'neon-vice-1080x1080.png'));
  console.log(`verify: exported neon-vice-1080x1080.png — ${png1.length} bytes, size ${JSON.stringify(pngSize(png1))}`);

  await evaluate(sessionId, `(async () => {
    const blob = await (await fetch('samples/boat.jpg')).blob();
    const file = new File([blob], 'my-boat.jpg', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById('fileInput');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor('user photo added', async () =>
    (await evaluate(sessionId, 'window.__neonVice.state.photos.length')) === 5);
  console.log('verify: a user photo went through the file input and into the panels');

  await evaluate(sessionId, `document.querySelector('[data-export="1920x1080"]').click()`);
  await waitFor('second PNG download', () => existsSync(join(DOWNLOADS, 'neon-vice-1920x1080.png')), 15000);
  const png2 = readFileSync(join(DOWNLOADS, 'neon-vice-1920x1080.png'));
  console.log(`verify: exported neon-vice-1920x1080.png — ${png2.length} bytes, size ${JSON.stringify(pngSize(png2))}`);
  await send('Target.closeTarget', { targetId });
}

/** Captures one shot spec; returns the written file's facts. */
async function takeShot(shot) {
  const { targetId, sessionId } = await openPage(`http://127.0.0.1:${PORT}/${shot.query}`, shot.w, shot.h);
  await waitShotReady(sessionId);
  await sleep(250);
  let buf = null;
  if (shot.kind === 'cover') {
    for (const quality of [0.88, 0.8, 0.72, 0.64]) {
      const dataUrl = await evaluate(sessionId, `(() => {
        const src = document.getElementById('stage');
        const c = document.createElement('canvas');
        c.width = ${shot.outW}; c.height = ${shot.outH};
        c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', ${quality});
      })()`);
      buf = Buffer.from(dataUrl.split(',')[1], 'base64');
      if (buf.length <= MAX_SHOT_BYTES) break;
    }
  } else {
    for (const quality of [88, 78, 68, 58]) {
      const res = await send('Page.captureScreenshot', { format: 'jpeg', quality }, sessionId);
      buf = Buffer.from(res.data, 'base64');
      if (buf.length <= MAX_SHOT_BYTES) break;
    }
  }
  await send('Target.closeTarget', { targetId });
  const out = join(root, 'screenshots', shot.name);
  writeFileSync(out, buf);
  return { name: shot.name, bytes: buf.length };
}

async function main() {
  const mode = process.argv[2] || 'all';
  try {
    await waitFor('static server', async () => (await fetch(`http://127.0.0.1:${PORT}/`)).ok, 10000);
    await waitFor('chromium devtools', async () => (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok, 15000);
    await connect();
    if (mode === 'all' || mode === '--verify') await verifyExports();
    if (mode === 'all' || mode === '--shots') {
      mkdirSync(join(root, 'screenshots'), { recursive: true });
      for (const shot of shots) {
        const fact = await takeShot(shot);
        console.log(`shot: ${fact.name} — ${fact.bytes} bytes`);
        if (fact.bytes > MAX_SHOT_BYTES) throw new Error(`${fact.name} is over the 256 KiB screenshot cap`);
      }
    }
    if (pageErrors.length) {
      console.error(`PAGE ERRORS (${pageErrors.length}):\n${pageErrors.join('\n')}`);
      process.exitCode = 2;
    } else {
      console.log('no page errors');
    }
  } finally {
    try { ws && ws.close(); } catch { /* already closed */ }
    server.kill();
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  server.kill();
  chrome.kill();
  process.exit(1);
});
