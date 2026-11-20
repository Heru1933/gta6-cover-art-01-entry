# Neon Vice — cover art maker

An offline web app that turns your photos and a caption into cover art in the style of GTA 6's
posters: a multi-panel collage with cream keylines, a Vice City sunset / neon colour grade, bold
poster lettering, and a one-click PNG export in the common post sizes (1080 × 1080, 1080 × 1350,
1920 × 1080). Everything runs in the browser from static files — photos are read on your own
machine and never uploaded, and the export carries no watermark.

## Run it

```sh
node serve.ts          # serves app/ at http://localhost:8080
```

Open the page, drop in photos, pick a layout and a grade, type your title, export. Panels can be
filled by one photo or a different photo each; click any panel to select it, then drag to
reposition its photo, scroll to zoom, or switch it between Fill and Fit.

## Layout of this repository

- `app/` — the app itself: `index.html`, `style.css`, `src/` (the cover engine and the editor),
  `fonts/` (Anton and Bebas Neue, SIL Open Font License), `samples/` (four AI-made sample photos,
  free to use).
- `main.ts` — the entry program: copies `app/` and `screenshots/` to the output directory and
  writes `dossier.json` with the vendored library in `vendor/`.
- `screenshots/` — the maker's screenshots of the app and of covers it exported.
- `tools/take-shots.mjs` — re-takes the screenshots and verifies the export path end to end in
  headless Chromium.
- `shots.json` — the screenshot scenes the tool captures.

Neon Vice is an original, fan-made style tool. It is not affiliated with Rockstar Games or
Take-Two Interactive, and ships no artwork, logo or font from any game.

## License

MIT — see `LICENSE`.
