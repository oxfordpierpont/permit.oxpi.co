import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const expectedTitles = {
  stop: 'File:MUTCD R1-1.svg',
  yield: 'File:MUTCD R1-2.svg',
  donotenter: 'File:MUTCD R5-1.svg',
  wrongway: 'File:MUTCD R5-1a.svg',
  oneway: 'File:MUTCD R6-1L.svg',
  speedlimit: 'File:Speed Limit 55 sign.svg',
  schoolspeed: 'File:MUTCD S5-1.svg',
  nouturn: 'File:MUTCD R3-4.svg',
  norightturn: 'File:MUTCD R3-1.svg',
  noturnonred: 'File:MUTCD R10-11.svg',
  keepright: 'File:MUTCD R4-7.svg',
  slowerkeepright: 'File:MUTCD R4-3.svg',
  notrucks: 'File:MUTCD R5-2.svg',
  nobicycles: 'File:MUTCD R5-6.svg',
  noparking: 'File:MUTCD R7-1.svg',
  leftturnonly: 'File:MUTCD R3-5L.svg',
  curveright: 'File:MUTCD W1-2R.svg',
  sharpright: 'File:MUTCD W1-1R.svg',
  windingroad: 'File:MUTCD W1-5R.svg',
  crossroad: 'File:MUTCD W2-1.svg',
  sideroad: 'File:MUTCD W2-2R.svg',
  merge: 'File:MUTCD W4-1R.svg',
  lanesreduced: 'File:MUTCD W4-2R.svg',
  dividedbegins: 'File:MUTCD W6-1.svg',
  dividedends: 'File:MUTCD W6-2.svg',
  twoway: 'File:MUTCD W6-3.svg',
  signalahead: 'File:MUTCD W3-3.svg',
  stopahead: 'File:MUTCD W3-1.svg',
  yieldahead: 'File:MUTCD W3-2.svg',
  slippery: 'File:MUTCD W8-5.svg',
  hill: 'File:MUTCD W7-1.svg',
  bump: 'File:MUTCD W8-1.svg',
  dip: 'File:MUTCD W8-2.svg',
  narrowbridge: 'File:MUTCD W5-2.svg',
  softshoulder: 'File:MUTCD W8-4.svg',
  lowclearance: 'File:MUTCD W12-2.svg',
  roadends: 'File:MUTCD W8-26.svg',
  deer: 'File:MUTCD W11-3.svg',
  pedcross: 'File:MUTCD W11-2.svg',
  schoolzone: 'File:MUTCD S1-1.svg',
  rradvance: 'File:MUTCD W10-1.svg',
  nopassing: 'File:MUTCD W14-3.svg',
  roadwork: 'File:MUTCD CW20-1.svg',
  flagger: 'File:MUTCD CW20-7a.svg',
  detour: 'File:MUTCD M4-8P.svg',
  slowmoving: 'File:Slow moving vehicle.svg',
  crossbuck: 'File:MUTCD R15-1.svg',
  exit: 'File:MUTCD E5-1.svg',
  milemarker: 'File:MUTCD D10-1.svg',
  hospital: 'File:MUTCD D9-2.svg',
  bikeroute: 'File:MUTCD M1-8.svg',
  parking: 'File:MUTCD D4-1.svg'
};

const root = new URL('../', import.meta.url);
const assets = new URL('public/assets/official-sign-catalog/', root);
const proofDir = new URL('proof/sign-catalog-audit/', root);
const tilesDir = new URL('tiles/', proofDir);
await mkdir(tilesDir, { recursive: true });

const html = await readFile(new URL('index.html', root), 'utf8');
const start = html.indexOf('const K=');
const end = html.indexOf('/* ---------- multiple choice');
const signs = new Function(html.slice(start, end) + ';return SIGNS;')();
const manifest = JSON.parse(await readFile(new URL('manifest.json', assets), 'utf8'));
const recordsById = new Map(manifest.signs.map((record) => [record.id, record]));

const report = [];
for (const sign of signs) {
  const source = recordsById.get(sign.id);
  const image = new URL(sign.id + '.png', assets);
  const imagePath = fileURLToPath(image);
  const imageStat = await stat(imagePath);
  const geometry = execFileSync('identify', ['-format', '%w×%h', imagePath], { encoding: 'utf8' });
  const tile = new URL(sign.id + '.png', tilesDir);
  execFileSync('magick', [
    imagePath,
    '-trim', '+repage',
    '-resize', '190x180',
    '-background', 'none',
    '-gravity', 'center',
    '-extent', '200x190',
    '(',
    '-size', '200x48',
    '-background', '#111513',
    '-fill', '#f5f6f2',
    '-gravity', 'center',
    '-font', 'Arial',
    '-pointsize', '14',
    'label:' + sign.n + '\n' + (source?.sourceTitle || 'missing'),
    ')',
    '-append',
    '-bordercolor', '#53605b',
    '-border', '2',
    fileURLToPath(tile)
  ]);
  report.push({
    id: sign.id,
    name: sign.n,
    category: sign.c,
    expectedSourceTitle: expectedTitles[sign.id],
    sourceTitle: source?.sourceTitle || null,
    canonicalSourceMatch: source?.sourceTitle === expectedTitles[sign.id],
    status: source?.status || 'missing',
    geometry,
    bytes: imageStat.size,
    output: 'public/assets/official-sign-catalog/' + sign.id + '.png'
  });
}

for (const [index, group] of Array.from({ length: Math.ceil(signs.length / 13) }, (_, groupIndex) =>
  signs.slice(groupIndex * 13, groupIndex * 13 + 13)
).entries()) {
  execFileSync('montage', [
    ...group.map((sign) => fileURLToPath(new URL(sign.id + '.png', tilesDir))),
    '-tile', '4x',
    '-geometry', '+14+14',
    '-background', '#090b0b',
    fileURLToPath(new URL('sheet-' + String(index + 1).padStart(2, '0') + '.png', proofDir))
  ]);
}

const failures = report.filter((record) =>
  record.status !== 'official-mutcd' ||
  !record.canonicalSourceMatch ||
  record.geometry !== '1000×1000'
);
await writeFile(
  new URL('validation.json', proofDir),
  JSON.stringify({ reviewedAt: new Date().toISOString(), total: report.length, failures, records: report }, null, 2)
);
console.log(JSON.stringify({ total: report.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
