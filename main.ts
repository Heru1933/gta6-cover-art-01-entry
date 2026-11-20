// Neon Vice — entry program for make.fun's gta6-cover-art-01 bounty (Node 22, standard library only).
//
// The entry itself is the static web app in app/: plain files a desktop browser runs offline, with
// no build step and no network request. This program hands the app in — it copies app/ and
// screenshots/ into the output directory and writes dossier.json there with the kit's vendored
// library (vendor/makefun-app.ts, unchanged), which is the summary the judge reads.
//
// Run it the way the grader does, or locally with an output directory of your choice:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this bounty (its reference/gate.json): at most 4 screenshots of at most
// 256 KiB each, at most 993 entries and 48 MiB under app/, no app path over 1000 bytes, and the
// dossier's source text capped at 160 KiB. Handing buildDossier the same caps makes this program
// refuse anything the scorer would refuse, instead of handing in an invalid entry.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outDir, 'app'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, GATE_CAPS));
