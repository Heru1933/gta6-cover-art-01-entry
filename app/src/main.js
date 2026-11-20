// Neon Vice editor: wires the page to the cover engine (./cover.js).
//
// Photos are read with object URLs and drawn on the machine only — nothing is uploaded.
// The preview canvas is kept at the real export resolution of the chosen post size, so the
// PNG you export is the preview you see, pixel for pixel.
import { drawCover, panelRects, defaultSlots, makeSlot, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const SIZES = { '1080x1080': [1080, 1080], '1080x1350': [1080, 1350], '1920x1080': [1920, 1080] };
const SAMPLES = [
  { src: 'samples/boulevard.jpg', name: 'Boulevard' },
  { src: 'samples/neon.jpg', name: 'Neon' },
  { src: 'samples/pier.jpg', name: 'Pier' },
  { src: 'samples/boat.jpg', name: 'Boat' },
];

const canvas = document.getElementById('stage');
const status = document.getElementById('status');
const shotKind = new URLSearchParams(location.search).get('shot');

export const state = {
  layout: 'mosaic',
  grade: 'sunset',
  spread: 'each',
  mainPhoto: 0,
  title: 'NEON VICE',
  tagline: 'SUNSET · NEON · TROUBLE',
  bottom: 'NEON SHORES · EST. 2026',
  titleFont: 'anton',
  titleFill: 'sunset',
  titlePos: 'top',
  sun: false,
  grain: true,
  photos: [],
  slots: defaultSlots('mosaic', 0),
  selected: 0,
  size: '1080x1350',
};

let rects = panelRects(state.layout, canvas.width, canvas.height);
let queued = false;

/** Schedules one redraw on the next frame; the selection outline is drawn only in the editor. */
export function redraw() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    rects = drawCover(canvas, state, { highlight: shotKind === 'cover' ? -1 : state.selected });
    syncPanelCard();
  });
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Adds a photo and returns its index. */
export async function addPhoto(url, name) {
  const img = await loadImage(url);
  state.photos.push({ img, name });
  return state.photos.length - 1;
}

/** Points every slot at the layout's default photos, keeping each slot's crop where possible. */
function assignDefaults() {
  const fresh = defaultSlots(state.layout, state.photos.length);
  state.slots = state.slots.map((slot, i) => ({ ...slot, photo: fresh[i] ? fresh[i].photo : slot.photo }));
  while (state.slots.length < fresh.length) state.slots.push(fresh[state.slots.length]);
  state.slots.length = fresh.length;
  if (state.selected >= state.slots.length) state.selected = 0;
}

function setLayout(id) {
  state.layout = id;
  assignDefaults();
  document.querySelectorAll('#layoutRow .layout-btn').forEach((b) => b.classList.toggle('on', b.dataset.layout === id));
  redraw();
}

function setGrade(id) {
  state.grade = id;
  document.querySelectorAll('#gradeRow .grade-btn').forEach((b) => b.classList.toggle('on', b.dataset.grade === id));
  redraw();
}

function setSpread(mode) {
  state.spread = mode;
  document.getElementById('spreadEach').classList.toggle('on', mode === 'each');
  document.getElementById('spreadOne').classList.toggle('on', mode === 'one');
  if (mode === 'one') state.slots.forEach((slot) => { slot.photo = state.mainPhoto; });
  else assignDefaults();
  buildTray();
  redraw();
}

/** Applies a photo choice: to the selected panel, or everywhere in one-photo spread. */
function choosePhoto(index) {
  if (state.spread === 'one') {
    state.mainPhoto = index;
    state.slots.forEach((slot) => { slot.photo = index; });
  } else {
    state.slots[state.selected].photo = index;
  }
  buildTray();
  redraw();
}

function removePhoto(index) {
  state.photos.splice(index, 1);
  state.slots.forEach((slot) => {
    if (slot.photo === index) slot.photo = -1;
    else if (slot.photo > index) slot.photo -= 1;
  });
  if (state.mainPhoto >= state.photos.length) state.mainPhoto = Math.max(0, state.photos.length - 1);
  buildTray();
  redraw();
}

/** Rebuilds the photo tray thumbnails. */
function buildTray() {
  const tray = document.getElementById('photoTray');
  tray.replaceChildren();
  if (!state.photos.length) {
    const p = document.createElement('p');
    p.className = 'tray-empty';
    p.textContent = 'No photos yet — panels show the drawn sunset scene.';
    tray.append(p);
    return;
  }
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb';
    const shown = state.spread === 'one' ? state.mainPhoto : (state.slots[state.selected] || {}).photo;
    if (shown === i) btn.classList.add('on');
    btn.title = `${photo.name} — click to place it`;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    const rm = document.createElement('span');
    rm.className = 'rm';
    rm.textContent = '×';
    rm.title = 'Remove this photo';
    rm.addEventListener('click', (e) => { e.stopPropagation(); removePhoto(i); });
    btn.append(img, rm);
    btn.addEventListener('click', () => choosePhoto(i));
    tray.append(btn);
  });
}

/** Keeps the selected-panel card in step with the selection. */
function syncPanelCard() {
  const slot = state.slots[state.selected];
  document.getElementById('panelName').textContent = `Panel ${state.selected + 1} of ${state.slots.length}`;
  if (!slot) return;
  const zoom = document.getElementById('zoomRange');
  if (document.activeElement !== zoom) zoom.value = Math.round(slot.zoom * 100);
  document.getElementById('modeBtn').textContent = slot.mode === 'fit' ? 'Mode: Fit' : 'Mode: Fill';
}

/** Builds the layout picker, its glyphs drawn from the layouts' own rectangles. */
function buildLayouts() {
  const row = document.getElementById('layoutRow');
  for (const [id, layout] of Object.entries(LAYOUTS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn' + (id === state.layout ? ' on' : '');
    btn.dataset.layout = id;
    const rectsSvg = layout.panels.map((p) =>
      `<rect x="${(p.x * 40 + 1).toFixed(1)}" y="${(p.y * 40 + 1).toFixed(1)}" width="${(p.w * 40 - 2).toFixed(1)}" height="${(p.h * 40 - 2).toFixed(1)}" rx="1.5"/>`).join('');
    btn.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">${rectsSvg}</svg><span>${layout.name}</span>`;
    btn.addEventListener('click', () => setLayout(id));
    row.append(btn);
  }
}

/** Builds the colour-grade picker. */
function buildGrades() {
  const row = document.getElementById('gradeRow');
  const short = { sunset: 'SUNSET', neon: 'NEON', golden: 'GOLDEN', noir: 'NOIR', clean: 'CLEAN' };
  for (const id of Object.keys(GRADES)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `grade-btn grade-${id}` + (id === state.grade ? ' on' : '');
    btn.dataset.grade = id;
    btn.textContent = short[id];
    btn.title = GRADES[id].name;
    btn.addEventListener('click', () => setGrade(id));
    row.append(btn);
  }
}

function setSize(key) {
  const [w, h] = SIZES[key];
  state.size = key;
  canvas.width = w;
  canvas.height = h;
  document.querySelectorAll('.size-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.size === key));
  document.getElementById('exportBtn').textContent = `Export PNG — ${w} × ${h}`;
  redraw();
}

/** Renders the cover at an exact size onto a fresh canvas (the export path). */
export function renderToCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawCover(c, state, { highlight: -1 });
  return c;
}

/** Exports the cover as a PNG download at w x h. */
export function exportPNG(w, h) {
  renderToCanvas(w, h).toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-vice-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved neon-vice-${w}x${h}.png — post it anywhere.`;
  }, 'image/png');
}

async function addFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  let slotAt = state.selected;
  for (const file of images) {
    const index = await addPhoto(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ''));
    if (state.spread === 'one') state.mainPhoto = index;
    else if (state.slots[slotAt]) { state.slots[slotAt].photo = index; slotAt = (slotAt + 1) % state.slots.length; }
  }
  if (state.spread === 'one') state.slots.forEach((slot) => { slot.photo = state.mainPhoto; });
  status.textContent = `${images.length} photo${images.length > 1 ? 's' : ''} added — drag panels to compose, then export.`;
  buildTray();
  redraw();
}

/** Applies a full scene at once (used by the screenshot scenes and handy for testing). */
export async function applyScene(scene) {
  if (scene.size && SIZES[scene.size]) setSize(scene.size);
  if (scene.layout && LAYOUTS[scene.layout]) { state.layout = scene.layout; }
  if (scene.grade && GRADES[scene.grade]) state.grade = scene.grade;
  if (scene.photos) {
    state.photos = [];
    for (const name of scene.photos) {
      const sample = SAMPLES.find((s) => s.src.endsWith(`/${name}.jpg`));
      if (sample) await addPhoto(sample.src, sample.name);
    }
  }
  assignDefaults();
  if (scene.assign) scene.assign.forEach((photo, i) => { if (state.slots[i]) state.slots[i].photo = photo; });
  if (scene.oyList) scene.oyList.forEach((oy, i) => { if (state.slots[i] && Number.isFinite(oy)) state.slots[i].oy = oy; });
  if (scene.title !== undefined) { state.title = scene.title; document.getElementById('titleInput').value = scene.title; }
  if (scene.tagline !== undefined) { state.tagline = scene.tagline; document.getElementById('taglineInput').value = scene.tagline; }
  if (scene.bottom !== undefined) { state.bottom = scene.bottom; document.getElementById('bottomInput').value = scene.bottom; }
  if (scene.font) { state.titleFont = scene.font; document.getElementById('fontSelect').value = scene.font; }
  if (scene.fill) { state.titleFill = scene.fill; document.getElementById('fillSelect').value = scene.fill; }
  if (scene.pos) { state.titlePos = scene.pos; document.getElementById('posSelect').value = scene.pos; }
  if (scene.sun !== undefined) { state.sun = scene.sun; document.getElementById('sunToggle').checked = scene.sun; }
  if (scene.grain !== undefined) { state.grain = scene.grain; document.getElementById('grainToggle').checked = scene.grain; }
  if (scene.selected !== undefined) state.selected = Math.min(scene.selected, state.slots.length - 1);
  document.querySelectorAll('#layoutRow .layout-btn').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('#gradeRow .grade-btn').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  buildTray();
  redraw();
}

function wireControls() {
  document.getElementById('fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  document.getElementById('spreadEach').addEventListener('click', () => setSpread('each'));
  document.getElementById('spreadOne').addEventListener('click', () => setSpread('one'));
  document.getElementById('sunToggle').addEventListener('change', (e) => { state.sun = e.target.checked; redraw(); });
  document.getElementById('grainToggle').addEventListener('change', (e) => { state.grain = e.target.checked; redraw(); });
  const words = [
    ['titleInput', 'title'], ['taglineInput', 'tagline'], ['bottomInput', 'bottom'],
  ];
  for (const [id, key] of words) {
    document.getElementById(id).addEventListener('input', (e) => { state[key] = e.target.value; redraw(); });
  }
  document.getElementById('fontSelect').addEventListener('change', (e) => { state.titleFont = e.target.value; redraw(); });
  document.getElementById('fillSelect').addEventListener('change', (e) => { state.titleFill = e.target.value; redraw(); });
  document.getElementById('posSelect').addEventListener('change', (e) => { state.titlePos = e.target.value; redraw(); });
  document.querySelectorAll('.size-tabs button').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));
  document.getElementById('exportBtn').addEventListener('click', () => { const [w, h] = SIZES[state.size]; exportPNG(w, h); });
  document.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => { const [w, h] = SIZES[b.dataset.export]; exportPNG(w, h); }));

  document.getElementById('zoomRange').addEventListener('input', (e) => {
    const slot = state.slots[state.selected];
    if (slot) { slot.zoom = Number(e.target.value) / 100; redraw(); }
  });
  document.getElementById('modeBtn').addEventListener('click', () => {
    const slot = state.slots[state.selected];
    if (slot) { slot.mode = slot.mode === 'fit' ? 'fill' : 'fit'; redraw(); }
  });
  document.getElementById('centerBtn').addEventListener('click', () => {
    const slot = state.slots[state.selected];
    if (slot) { slot.ox = 0.5; slot.oy = 0.5; redraw(); }
  });
  const cycle = (dir) => {
    const slot = state.slots[state.selected];
    if (!slot || !state.photos.length) return;
    slot.photo = (((slot.photo + dir) % state.photos.length) + state.photos.length) % state.photos.length;
    buildTray();
    redraw();
  };
  document.getElementById('prevPhotoBtn').addEventListener('click', () => cycle(-1));
  document.getElementById('nextPhotoBtn').addEventListener('click', () => cycle(1));
  document.getElementById('sceneBtn').addEventListener('click', () => {
    const slot = state.slots[state.selected];
    if (slot) { slot.photo = -1; buildTray(); redraw(); }
  });

  const zone = document.getElementById('dropZone');
  window.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragging'); });
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) zone.classList.remove('dragging'); });
  window.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('dragging'); addFiles(e.dataTransfer.files); });

  let drag = null;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  };
  canvas.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    const hit = rects.findIndex((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
    if (hit === -1) return;
    state.selected = hit;
    const slot = state.slots[hit];
    drag = { x: p.x, y: p.y, ox: slot.ox, oy: slot.oy };
    canvas.setPointerCapture(e.pointerId);
    buildTray();
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pos(e);
    const slot = state.slots[state.selected];
    const photo = slot.photo >= 0 ? state.photos[slot.photo] : null;
    if (!photo) return;
    const rect = rects[state.selected];
    const iw = photo.img.naturalWidth || photo.img.width;
    const ih = photo.img.naturalHeight || photo.img.height;
    const scale = Math.max(rect.w / iw, rect.h / ih) * slot.zoom;
    const overflowX = iw * scale - rect.w;
    const overflowY = ih * scale - rect.h;
    if (overflowX > 0) slot.ox = Math.min(1, Math.max(0, drag.ox - (p.x - drag.x) / overflowX));
    if (overflowY > 0) slot.oy = Math.min(1, Math.max(0, drag.oy - (p.y - drag.y) / overflowY));
    redraw();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.slots[state.selected];
    if (!slot) return;
    slot.zoom = Math.min(4, Math.max(0.4, slot.zoom * Math.exp(-e.deltaY * 0.0012)));
    redraw();
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const slot = state.slots[state.selected];
    if (!slot) return;
    const step = 0.03;
    if (e.key === 'ArrowLeft') slot.ox = Math.max(0, slot.ox - step);
    else if (e.key === 'ArrowRight') slot.ox = Math.min(1, slot.ox + step);
    else if (e.key === 'ArrowUp') slot.oy = Math.max(0, slot.oy - step);
    else if (e.key === 'ArrowDown') slot.oy = Math.min(1, slot.oy + step);
    else if (e.key === '+' || e.key === '=') slot.zoom = Math.min(4, slot.zoom * 1.08);
    else if (e.key === '-') slot.zoom = Math.max(0.4, slot.zoom / 1.08);
    else return;
    e.preventDefault();
    redraw();
  });
}

buildLayouts();
buildGrades();
wireControls();
window.__neonVice = { state, drawCover, exportPNG, renderToCanvas, applyScene, addPhoto };

if (shotKind) {
  runShot(shotKind, new URLSearchParams(location.search), applyScene);
} else {
  (async () => {
    for (const sample of SAMPLES) {
      try { await addPhoto(sample.src, sample.name); } catch { /* a missing sample never blocks the editor */ }
    }
    assignDefaults();
    buildTray();
    redraw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redraw());
  })();
}
