// Neon Vice cover engine: draws a multi-panel, GTA-poster-style cover onto any 2D canvas.
//
// A cover is a collage of photo panels on a cream frame, each panel colour-graded, with a bold
// display title lettered over the top (or foot) of the collage. Panels without a photo are filled
// with a drawn sunset scene (striped retro sun, skyline, palms), so a cover never looks broken.
// Everything is drawn from the state the editor hands in; the same function renders the on-screen
// preview and the exported PNG, so what you see is exactly what you save.

/** Panel layouts as normalised rectangles (x, y, w, h in 0..1), in reading order. */
export const LAYOUTS = {
  mosaic: {
    name: 'Mosaic',
    panels: [
      { x: 0, y: 0, w: 0.335, h: 0.46 }, { x: 0.335, y: 0, w: 0.33, h: 0.34 }, { x: 0.665, y: 0, w: 0.335, h: 0.46 },
      { x: 0.335, y: 0.34, w: 0.33, h: 0.3 },
      { x: 0, y: 0.46, w: 0.335, h: 0.54 }, { x: 0.335, y: 0.64, w: 0.33, h: 0.36 }, { x: 0.665, y: 0.46, w: 0.335, h: 0.54 },
    ],
  },
  poster: {
    name: 'Poster',
    panels: [
      { x: 0, y: 0, w: 0.58, h: 1 },
      { x: 0.58, y: 0, w: 0.42, h: 0.38 }, { x: 0.58, y: 0.38, w: 0.42, h: 0.3 }, { x: 0.58, y: 0.68, w: 0.42, h: 0.32 },
    ],
  },
  quad: {
    name: 'Quad',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  trio: {
    name: 'Trio',
    panels: [
      { x: 0, y: 0, w: 0.34, h: 1 }, { x: 0.34, y: 0, w: 0.33, h: 1 }, { x: 0.67, y: 0, w: 0.33, h: 1 },
    ],
  },
  duo: {
    name: 'Duo',
    panels: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }],
  },
  solo: {
    name: 'Solo',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
};

/** Colour grades: a canvas filter for the photo, then translucent overlays mixed over it. */
export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    filter: 'saturate(1.28) contrast(1.07) brightness(1.02)',
    overlays: [
      { mode: 'source-over', stops: [[0, 'rgba(24,8,54,0.14)'], [0.42, 'rgba(24,8,54,0)'], [0.78, 'rgba(255,94,58,0.16)'], [1, 'rgba(214,36,118,0.34)']] },
      { mode: 'screen', stops: [[0, 'rgba(255,176,84,0.13)'], [0.5, 'rgba(255,176,84,0)']] },
    ],
  },
  neon: {
    name: 'Neon Night',
    filter: 'saturate(1.45) contrast(1.16) brightness(0.96) hue-rotate(-6deg)',
    overlays: [
      { mode: 'multiply', stops: [[0, 'rgba(10,16,48,0)'], [1, 'rgba(2,32,54,0.42)']] },
      { mode: 'screen', stops: [[0, 'rgba(255,46,136,0.17)'], [0.55, 'rgba(255,46,136,0)']] },
      { mode: 'screen', stops: [[0.6, 'rgba(34,211,238,0)'], [1, 'rgba(34,211,238,0.13)']] },
    ],
  },
  golden: {
    name: 'Golden Hour',
    filter: 'saturate(1.18) contrast(1.05) brightness(1.05) sepia(0.22)',
    overlays: [
      { mode: 'screen', stops: [[0, 'rgba(255,170,60,0.20)'], [0.6, 'rgba(255,170,60,0)']] },
      { mode: 'multiply', stops: [[0.55, 'rgba(120,53,15,0)'], [1, 'rgba(120,53,15,0.18)']] },
    ],
  },
  noir: {
    name: 'Noir',
    filter: 'grayscale(1) contrast(1.22) brightness(1.02)',
    overlays: [
      { mode: 'source-over', stops: [[0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.28)']] },
    ],
  },
  clean: {
    name: 'Clean',
    filter: 'saturate(1.06) contrast(1.02)',
    overlays: [],
  },
};

/** Title fill styles: vertical colour stops, or a single flat colour. */
export const TITLE_FILLS = {
  sunset: ['#ffe259', '#ffa751', '#ff5e3a', '#ff2e88'],
  gold: ['#fff3ae', '#f6c453', '#dd8f1d', '#9a5b12'],
  pink: ['#ff7ac0'],
  white: ['#ffffff'],
};

/** Pixel rectangles for a layout on a W x H cover: a cream frame outside, gutters between panels. */
export function panelRects(layoutId, W, H) {
  const frame = Math.max(10, Math.round(Math.min(W, H) * 0.016));
  const gap = Math.max(6, Math.round(frame * 0.8));
  const iw = W - frame * 2;
  const ih = H - frame * 2;
  return LAYOUTS[layoutId].panels.map((p) => {
    const x = frame + p.x * iw;
    const y = frame + p.y * ih;
    const w = p.w * iw;
    const h = p.h * ih;
    return { x: x + gap / 2, y: y + gap / 2, w: w - gap, h: h - gap };
  });
}

/** A fresh slot (per-panel state) showing photo `photo` centred, filling its panel. */
export function makeSlot(photo) {
  return { photo, zoom: 1, ox: 0.5, oy: 0.5, mode: 'fill' };
}

/** Default photo assignment per layout, so a fresh cover already looks composed. */
export function defaultSlots(layoutId, photoCount) {
  const picks = {
    mosaic: [1, 3, 0, 2, 0, 3, 1],
    poster: [0, 1, 3, 2],
    quad: [0, 1, 3, 2],
    trio: [1, 0, 3],
    duo: [0, 3],
    solo: [0],
  }[layoutId] ?? [];
  return LAYOUTS[layoutId].panels.map((_, i) => {
    const slot = makeSlot(photoCount ? picks[i % picks.length] % photoCount : -1);
    if (i % 3 === 2) slot.oy = 0.32;
    if (i % 4 === 3) slot.ox = 0.34;
    return slot;
  });
}

const sunCache = new Map();

/** The striped retro sun as its own sprite, so its cut bands stay transparent over any backdrop. */
function sunSprite(radius) {
  const key = Math.round(radius);
  if (sunCache.has(key)) return sunCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(2, key * 2);
  const ctx = c.getContext('2d');
  const r = key;
  const grad = ctx.createLinearGradient(0, 0, 0, r * 2);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(0.55, '#ffa751');
  grad.addColorStop(1, '#ff2e88');
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  let y = r * 1.1;
  let band = r * 0.035;
  while (y < r * 2) {
    ctx.fillRect(0, y, r * 2, band);
    y += band + r * 0.1;
    band *= 1.55;
  }
  sunCache.set(key, c);
  return c;
}

/** One palm tree silhouette, drawn around an origin at the foot of its trunk, `s` pixels tall. */
function drawPalm(ctx, x, y, s, flip, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * s / 100, s / 100);
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.quadraticCurveTo(-3, -58, 13, -102);
  ctx.lineTo(22, -100);
  ctx.quadraticCurveTo(7, -56, 7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  const fronds = [[-60, -26], [-46, -42], [-18, -54], [14, -57], [42, -47], [60, -30]];
  for (const [dx, dy] of fronds) {
    ctx.beginPath();
    ctx.moveTo(17, -101);
    ctx.quadraticCurveTo(17 + dx * 0.5, -101 + dy - 13, 17 + dx, -101 + dy + 15);
    ctx.stroke();
  }
  ctx.restore();
}

/** A small deterministic PRNG, so the drawn sunset scene is the same on every render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The placeholder scene for a panel with no photo: sunset sky, striped sun, skyline, sea, palms. */
function drawSunsetScene(ctx, x, y, w, h) {
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.34, '#7b2d8b');
  sky.addColorStop(0.55, '#d6336c');
  sky.addColorStop(0.68, '#ff7e47');
  sky.addColorStop(0.78, '#ffd23f');
  sky.addColorStop(0.8, '#3d1a63');
  sky.addColorStop(1, '#170a33');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const rand = mulberry32(20261119);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 26; i++) {
    const sx = x + rand() * w;
    const sy = y + rand() * h * 0.3;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  const horizon = y + h * 0.79;
  const sunR = Math.min(w, h) * 0.27;
  ctx.drawImage(sunSprite(sunR), x + w / 2 - sunR, horizon - sunR * 1.55);
  ctx.fillStyle = '#1c0b38';
  let bx = x - 4;
  while (bx < x + w) {
    const bw = w * (0.05 + rand() * 0.09);
    const bh = h * (0.03 + rand() * 0.075);
    ctx.fillRect(bx, horizon - bh, bw, bh);
    bx += bw + w * 0.012;
  }
  ctx.fillStyle = 'rgba(255,210,63,0.5)';
  for (let i = 0; i < 7; i++) {
    const rw = sunR * (0.4 + rand() * 0.9);
    ctx.fillRect(x + w / 2 - rw / 2, horizon + 4 + i * h * 0.024, rw, Math.max(1.5, h * 0.006));
  }
  drawPalm(ctx, x + w * 0.07, y + h * 0.995, h * 0.34, 1, '#12061f');
  drawPalm(ctx, x + w * 0.95, y + h * 0.995, h * 0.27, -1, '#12061f');
}

/** Renders one panel's photo onto its own tile: crop/zoom from the slot, the grade over it. */
function renderPhotoTile(img, slot, gradeId, w, h) {
  const tile = document.createElement('canvas');
  tile.width = Math.max(1, Math.round(w));
  tile.height = Math.max(1, Math.round(h));
  const ctx = tile.getContext('2d');
  const grade = GRADES[gradeId] ?? GRADES.sunset;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  ctx.fillStyle = '#170a33';
  ctx.fillRect(0, 0, tile.width, tile.height);
  if (slot.mode === 'fit') {
    const backScale = Math.max(tile.width / iw, tile.height / ih) * 1.15;
    ctx.filter = `${grade.filter} blur(18px) brightness(0.62)`;
    ctx.drawImage(img, (tile.width - iw * backScale) / 2, (tile.height - ih * backScale) / 2, iw * backScale, ih * backScale);
    ctx.filter = grade.filter;
    const fitScale = Math.min(tile.width / iw, tile.height / ih) * slot.zoom;
    const fw = iw * fitScale;
    const fh = ih * fitScale;
    ctx.drawImage(img, (tile.width - fw) / 2 + (slot.ox - 0.5) * tile.width * 0.2, (tile.height - fh) / 2 + (slot.oy - 0.5) * tile.height * 0.2, fw, fh);
  } else {
    const scale = Math.max(tile.width / iw, tile.height / ih) * slot.zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.filter = grade.filter;
    ctx.drawImage(img, (tile.width - dw) * slot.ox, (tile.height - dh) * slot.oy, dw, dh);
  }
  ctx.filter = 'none';
  for (const overlay of grade.overlays) {
    const grad = ctx.createLinearGradient(0, 0, 0, tile.height);
    for (const [at, colour] of overlay.stops) grad.addColorStop(at, colour);
    ctx.globalCompositeOperation = overlay.mode;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, tile.width, tile.height);
  }
  ctx.globalCompositeOperation = 'source-over';
  return tile;
}

let grainCanvas = null;

/** A tile of film grain, made once and reused as a pattern. */
function getGrain() {
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 256;
  const ctx = grainCanvas.getContext('2d');
  const data = ctx.createImageData(256, 256);
  const rand = mulberry32(1123);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.floor(rand() * 96);
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return grainCanvas;
}

/** Shrinks the font until `text` fits `maxWidth`, returns the size used. */
function fitFontSize(ctx, text, family, maxWidth, startSize, spacingEm) {
  let size = startSize;
  while (size > 10) {
    ctx.font = `${size}px ${family}`;
    try { ctx.letterSpacing = `${(size * spacingEm).toFixed(1)}px`; } catch { /* older engines */ }
    if (ctx.measureText(text).width <= maxWidth) break;
    size *= 0.94;
  }
  return size;
}

/** The words: a letterspaced tagline, the big title with a dark outline, and a small foot line. */
function drawTitleBlock(ctx, W, H, state) {
  const title = (state.title || '').trim().toUpperCase();
  const tagline = (state.tagline || '').trim().toUpperCase();
  const bottom = (state.bottom || '').trim().toUpperCase();
  if (!title && !tagline && !bottom) return;
  const cx = W / 2;
  const margin = H * 0.032;
  const atTop = state.titlePos !== 'bottom';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  let titleSize = 0;
  const titleFamily = state.titleFont === 'bebas' ? '"Bebas Neue", sans-serif' : '"Anton", sans-serif';
  if (title) {
    titleSize = fitFontSize(ctx, title, titleFamily, W * 0.93, Math.min(W * 0.185, H * 0.17), 0.015);
  }
  const tagSize = Math.max(11, Math.min(W, H) * 0.021);
  const footSize = Math.max(10, Math.min(W, H) * 0.017);

  const drawTagline = (baseline) => {
    if (!tagline) return;
    ctx.font = `${tagSize}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${(tagSize * 0.34).toFixed(1)}px`; } catch { /* older engines */ }
    ctx.shadowColor = 'rgba(10,2,24,0.65)';
    ctx.shadowBlur = tagSize * 0.35;
    ctx.shadowOffsetY = tagSize * 0.08;
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText(tagline, cx, baseline);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };
  const drawTitle = (baseline) => {
    if (!title) return;
    ctx.font = `${titleSize}px ${titleFamily}`;
    try { ctx.letterSpacing = `${(titleSize * 0.015).toFixed(1)}px`; } catch { /* older engines */ }
    const stops = TITLE_FILLS[state.titleFill] ?? TITLE_FILLS.sunset;
    let fill = stops[0];
    if (stops.length > 1) {
      fill = ctx.createLinearGradient(0, baseline - titleSize, 0, baseline + titleSize * 0.12);
      stops.forEach((colour, i) => fill.addColorStop(i / (stops.length - 1), colour));
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#170b31';
    ctx.lineWidth = titleSize * 0.15;
    ctx.shadowColor = 'rgba(10,2,24,0.55)';
    ctx.shadowBlur = titleSize * 0.13;
    ctx.shadowOffsetY = titleSize * 0.05;
    ctx.strokeText(title, cx, baseline);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = fill;
    ctx.fillText(title, cx, baseline);
  };
  const drawFoot = (baseline) => {
    if (!bottom) return;
    ctx.font = `${footSize}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${(footSize * 0.3).toFixed(1)}px`; } catch { /* older engines */ }
    ctx.shadowColor = 'rgba(10,2,24,0.6)';
    ctx.shadowBlur = footSize * 0.4;
    ctx.fillStyle = 'rgba(255,240,214,0.92)';
    ctx.fillText(bottom, cx, baseline);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  };

  if (atTop) {
    let y = margin + tagSize;
    drawTagline(y);
    if (tagline) y += tagSize * 0.55;
    drawTitle(y + titleSize * 0.92);
    drawFoot(H - margin * 0.72);
  } else {
    drawFoot(margin + footSize);
    let y = H - margin * 0.72;
    drawTitle(y);
    drawTagline(y - titleSize * 1.04);
  }
  try { ctx.letterSpacing = '0px'; } catch { /* older engines */ }
}

/**
 * Draws the whole cover described by `state` onto `canvas` at the canvas's own size.
 * `state.photos` holds { img } entries; `state.slots` one slot per panel of `state.layout`.
 * `opts.highlight` is a panel index to outline (the editor's selection), or -1 for none.
 */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#f7ecd9';
  ctx.fillRect(0, 0, W, H);
  const rects = panelRects(state.layout, W, H);
  const highlight = opts.highlight ?? -1;

  rects.forEach((rect, i) => {
    const slot = state.slots[i] ?? makeSlot(-1);
    ctx.save();
    ctx.shadowColor = 'rgba(23,6,43,0.35)';
    ctx.shadowBlur = Math.max(6, W * 0.008);
    ctx.shadowOffsetY = Math.max(2, H * 0.004);
    ctx.fillStyle = '#1c0f33';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    const photo = slot.photo >= 0 ? state.photos[slot.photo] : null;
    if (photo) {
      ctx.drawImage(renderPhotoTile(photo.img, slot, state.grade, rect.w, rect.h), rect.x, rect.y, rect.w, rect.h);
    } else {
      drawSunsetScene(ctx, rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(18,6,36,0.35)';
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });

  if (state.sun) {
    const biggest = rects.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b), rects[0]);
    const r = Math.min(biggest.w, biggest.h) * 0.24;
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.drawImage(sunSprite(r), biggest.x + biggest.w / 2 - r, biggest.y + biggest.h * 0.06);
    ctx.restore();
  }

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(getGrain(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
  vignette.addColorStop(0, 'rgba(8,2,18,0)');
  vignette.addColorStop(1, 'rgba(8,2,18,0.30)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  drawTitleBlock(ctx, W, H, state);

  ctx.strokeStyle = 'rgba(23,6,43,0.85)';
  ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  if (highlight >= 0 && rects[highlight]) {
    const rect = rects[highlight];
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.shadowColor = 'rgba(34,211,238,0.8)';
    ctx.shadowBlur = 14;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
  return rects;
}
