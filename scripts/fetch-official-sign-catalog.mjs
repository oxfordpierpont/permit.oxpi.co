import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const signCodes = {
  stop: 'R1-1', yield: 'R1-2', donotenter: 'R5-1', wrongway: 'R5-1a',
  oneway: 'R6-1', speedlimit: 'R2-1', schoolspeed: 'S5-1', nouturn: 'R3-4',
  norightturn: 'R3-1', noturnonred: 'R10-11', keepright: 'R4-7',
  slowerkeepright: 'R4-3', notrucks: 'R5-2', nobicycles: 'R5-6',
  noparking: 'R7-1', leftturnonly: 'R3-5', curveright: 'W1-2R',
  sharpright: 'W1-1R', windingroad: 'W1-5', crossroad: 'W2-1',
  sideroad: 'W2-2', merge: 'W4-1R', lanesreduced: 'W4-2',
  dividedbegins: 'W6-1', dividedends: 'W6-2', twoway: 'W6-3',
  signalahead: 'W3-3', stopahead: 'W3-1', yieldahead: 'W3-2',
  slippery: 'W8-5', hill: 'W7-1', bump: 'W8-1', dip: 'W8-2',
  narrowbridge: 'W5-2', softshoulder: 'W8-4', lowclearance: 'W12-2',
  roadends: 'W8-26', deer: 'W11-3', pedcross: 'W11-2', schoolzone: 'S1-1',
  rradvance: 'W10-1', nopassing: 'W14-3', roadwork: 'W20-1',
  flagger: 'W20-7a', detour: 'M4-8', crossbuck: 'R15-1', exit: 'E5-1',
  milemarker: 'D10-1', hospital: 'D9-2', bikeroute: 'M1-8', parking: 'D4-1'
};

// The slow-moving vehicle emblem is not assigned a MUTCD sign code.
const titleOverrides = {
  oneway: ['MUTCD R6-1.svg'],
  speedlimit: ['Speed Limit 55 sign.svg'],
  leftturnonly: ['MUTCD R3-5L.svg'],
  flagger: ['MUTCD CW20-7a.svg'],
  slowmoving: ['Slow moving vehicle.svg']
};

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('const K=');
const end = html.indexOf('/* ---------- multiple choice');
const signs = new Function(html.slice(start, end) + ';return SIGNS;')();
const assetsRoot = new URL('../public/assets/', import.meta.url);
const sourceDir = new URL('official-mutcd-source/', assetsRoot);
const outDir = new URL('official-sign-catalog/', assetsRoot);

await mkdir(sourceDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const titleFor = (sign) => (titleOverrides[sign.id] || ['MUTCD ' + signCodes[sign.id] + '.svg'])
  .map((title) => 'File:' + title);

const chunks = (items, size) => Array.from(
  { length: Math.ceil(items.length / size) },
  (_, index) => items.slice(index * size, index * size + size)
);
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const aliases = (query) => {
  const map = new Map();
  for (const entry of [...(query.normalized || []), ...(query.redirects || [])]) {
    map.set(entry.from, entry.to);
  }
  return (title) => {
    const visited = new Set();
    let value = title;
    while (map.has(value) && !visited.has(value)) {
      visited.add(value);
      value = map.get(value);
    }
    return value;
  };
};

async function findOfficialImages() {
  const requests = signs.flatMap((sign) => titleFor(sign).map((title) => ({ sign, title })));
  const images = new Map();

  for (const batch of chunks(requests, 40)) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    const params = {
      action: 'query',
      titles: batch.map((item) => item.title).join('|'),
      redirects: '1',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: '1280',
      format: 'json',
      origin: '*'
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    const response = await fetch(url, {
      headers: { 'user-agent': 'GA-Permit-Trainer/1.0 asset-refresh' }
    });
    if (!response.ok) throw new Error('Commons metadata request failed: ' + response.status);
    const json = await response.json();
    const resolve = aliases(json.query || {});
    const pages = new Map(Object.values(json.query?.pages || {}).map((page) => [page.title, page]));

    for (const { sign, title } of batch) {
      if (images.has(sign.id)) continue;
      const page = pages.get(resolve(title)) || pages.get(title);
      const info = page?.imageinfo?.[0];
      if (info?.url) {
        const source = new URL(
          'https://commons.wikimedia.org/wiki/Special:FilePath/' +
          encodeURIComponent(page.title.replace(/^File:/, ''))
        );
        source.searchParams.set('width', '1280');
        images.set(sign.id, { source: source.toString(), sourceTitle: page.title, sourceExtension: 'png' });
      }
    }
  }
  return images;
}

async function downloadImage(sign, image) {
  const sourceExtension = image.sourceExtension || 'png';
  const source = fileURLToPath(new URL(sign.id + '.' + sourceExtension, sourceDir));
  const target = fileURLToPath(new URL(sign.id + '.png', outDir));
  execFileSync('curl', [
    '--fail',
    '--location',
    '--retry', '3',
    '--retry-delay', '1',
    '--user-agent', 'Mozilla/5.0 (GA Permit Trainer asset compiler)',
    '--output', source,
    image.source
  ], { stdio: 'pipe' });
  execFileSync('magick', [
    source,
    '-alpha', 'on',
    '-trim', '+repage',
    '-resize', '1000x1000',
    '-gravity', 'center',
    '-background', 'none',
    '-extent', '1000x1000',
    target
  ], { stdio: 'pipe' });

  return {
    id: sign.id,
    name: sign.n,
    status: 'official-mutcd',
    sourceTitle: image.sourceTitle,
    source: image.source,
    output: 'official-sign-catalog/' + sign.id + '.png'
  };
}

const images = await findOfficialImages();
const results = [];
for (const sign of signs) {
  const image = images.get(sign.id);
  if (!image) {
    results.push({ id: sign.id, name: sign.n, status: 'unresolved' });
    continue;
  }
  try {
    results.push(await downloadImage(sign, image));
  } catch (error) {
    results.push({ id: sign.id, name: sign.n, status: 'download-failed', error: error.message });
  }
  await pause(100);
}

await writeFile(
  new URL('manifest.json', outDir),
  JSON.stringify({ source: 'Wikimedia Commons MUTCD artwork', generatedAt: new Date().toISOString(), signs: results }, null, 2)
);

const unresolved = results.filter((item) => item.status !== 'official-mutcd');
console.log(JSON.stringify({
  total: results.length,
  official: results.length - unresolved.length,
  unresolved
}, null, 2));
if (unresolved.length) process.exitCode = 1;
