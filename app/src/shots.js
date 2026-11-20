// Fixed scenes for screenshots: ?shot=cover shows one exported cover alone, ?shot=editor the editor
// with a scene loaded. Query parameters pick the size, layout, grade, sample photos and words, e.g.
// ?shot=cover&size=1080x1350&layout=mosaic&grade=sunset&photos=neon,boulevard,boat,pier&title=Neon%20Vice
// window.__shotReady is set once the scene is painted with fonts and photos in place.
export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photos = (query.get('photos') ?? 'boulevard,neon,pier,boat').split(',').map((s) => s.trim()).filter(Boolean);
  const scene = {
    size: query.get('size') ?? '1080x1350',
    layout: query.get('layout') ?? 'mosaic',
    grade: query.get('grade') ?? 'sunset',
    photos,
    title: query.get('title') ?? 'NEON VICE',
    tagline: query.get('tagline') ?? 'SUNSET · NEON · TROUBLE',
    bottom: query.get('bottom') ?? 'NEON SHORES · EST. 2026',
    font: query.get('font') ?? 'anton',
    fill: query.get('fill') ?? 'sunset',
    pos: query.get('pos') ?? 'top',
    sun: query.get('sun') === '1',
    grain: query.get('grain') !== '0',
    selected: Number(query.get('selected') ?? 0),
  };
  if (query.get('assign')) scene.assign = query.get('assign').split(',').map((n) => Number(n));
  if (query.get('oy')) scene.oyList = query.get('oy').split(',').map((n) => Number(n));
  await applyScene(scene);
  if (document.fonts && document.fonts.load) {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
    ]).catch(() => {});
  }
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const { redraw } = await import('./main.js');
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
