/**
 * fix-addon-links.mjs
 *
 * One-shot Firestore updater that:
 *   1. Flips 10 previously-"global" add-ons to appliesToAll:false
 *      (so they no longer show on every service).
 *   2. Re-parses the raw source dump and, for each service in the raw source,
 *      writes an explicit addonIds array — matching precisely what the source
 *      listed under each service (no more, no less).
 *
 * Uses Firebase CLI's cached OAuth credentials — no extra packages needed.
 * Reads raw dump from %TEMP%\raw-service-dump.txt (already extracted last session).
 *
 * Run:  node import-data/fix-addon-links.mjs
 * Add --dry to preview without writing:
 *       node import-data/fix-addon-links.mjs --dry
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import https from 'https';

const DRY = process.argv.includes('--dry');
const PROJECT = 'labelle-braids-bb';
const RAW_PATH = join(process.env.TEMP || '/tmp', 'raw-service-dump.txt');

// ── OAuth token from Firebase CLI cache ────────────────────────────────────
const altPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const winPath = join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json');
let fbConfig;
try { fbConfig = JSON.parse(readFileSync(altPath, 'utf8')); }
catch { fbConfig = JSON.parse(readFileSync(winPath, 'utf8')); }
const user = Object.values(fbConfig.users || {})[0] || fbConfig;
const refreshToken = user.tokens.refresh_token;
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();
  const r = await req(
    {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body,
  );
  return JSON.parse(r.body).access_token;
}
async function fsGet(path, token) {
  const r = await req({
    hostname: 'firestore.googleapis.com',
    path,
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token },
  });
  return JSON.parse(r.body);
}
async function fsPatch(path, token, fields, updateMaskFields) {
  const mask = updateMaskFields.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await req(
    {
      hostname: 'firestore.googleapis.com',
      path: `${path}?${mask}`,
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    },
    JSON.stringify({ fields }),
  );
  if (r.status >= 300) throw new Error(`PATCH ${path} → ${r.status} ${r.body}`);
  return JSON.parse(r.body);
}

// ── Canonical name normalizer for add-ons ──────────────────────────────────
// Maps a (rawName, priceUSD) pair to the canonical add-on name that lives
// in Firestore (see admin-addons UI). Returns null for unknown add-ons.
function canonAddonName(rawName, price) {
  const n = rawName.trim().replace(/\s+/g, ' ');
  const lower = n.toLowerCase();

  // Duplicate-name add-ons disambiguated by price (I appended " — $NN" when
  // building batch1).
  if (/^armpit length\s*\(14"\)$/i.test(n)) {
    if (price === 30) return 'Armpit Length (14") — $30';
    if (price === 40) return 'Armpit Length (14") — $40';
  }
  if (/^butt-length$/i.test(n)) {
    if (price === 130) return 'Butt-Length';
    if (price === 85) return 'Butt-Length — $85';
  }
  if (/^goddess\/boh?oo? effect \(curly ends\) \/ human hair$/i.test(n)) {
    if (price === 60) return 'Goddess/Boho Effect (Curly Ends) / Human Hair — $60';
    if (price === 25) return 'Goddess/Boho Effect (Curly Ends) / Human Hair — $25';
  }
  if (/^mid-back length \(18-20"\)$/i.test(n)) {
    if (price === 60) return 'Mid-Back Length (18–20") — $60';
    if (price === 25) return 'Mid-Back Length (18–20") — $25';
    if (price === 80) return 'Mid-Back Length (18–20") — $80';
  }

  // 1-to-1 fixed maps.
  const table = new Map([
    ['ana\'s hair deep treatment - thinning hair and alopecia related (between shoulder and armpits)',
      'Ana\'s Hair Deep Treatment (Thinning Hair & Alopecia, Between Shoulder & Armpits)'],
    ['blow dry', 'Blow Dry'],
    ['bohoo effect (curly ends) / synthetic hair 1 to 4 cornrows',
      'Boho Effect (Curly Ends) / Synthetic Hair, 1–4 Cornrows'],
    ['conditional treatment', 'Conditioning Treatment'],
    ['conditioning treatment', 'Conditioning Treatment'],
    ['deluxe shampoo', 'Deluxe Shampoo'],
    ['deluxe steam treatment', 'Deluxe Steam Treatment'],
    ['detangle hair', 'Detangle Hair'],
    ['goddess/bohoo effect (curly ends) / synthetic hair',
      'Goddess/Boho Effect (Curly Ends) / Synthetic Hair'],
    ['microlocs detox', 'Microlocs Detox'],
    ['microlocs afro kinky human hair up to 16 inches', 'Microlocs Hair Extension (Up to 16 Inches)'],
    ['microlocs hair 16\u2019\u2019 inches human hair', 'Microlocs Hair Extension (Up to 16 Inches)'],
    ['microlocs hair 16\'\' inches human hair', 'Microlocs Hair Extension (Up to 16 Inches)'],
    // Mojibake (U+2019 encoded as UTF-8 bytes reinterpreted via Windows-1252):
    ['microlocs hair 16\u00e2\u20ac\u2122\u00e2\u20ac\u2122 inches human hair',
      'Microlocs Hair Extension (Up to 16 Inches)'],
    ['microlocs repair $75 per hours for 1 person/ $140 per hours for 2 people',
      'Microlocs Repair ($75/hr for 1 Person, $140/hr for 2 People)'],
    ['microlocs style', 'Microlocs Style'],
    ['mini twist extention msmall size', 'Mini Twist Extension (Small Size)'],
    ['mini twist extension (small size)', 'Mini Twist Extension (Small Size)'],
    ['mixed more than 3 hair colors', 'Mixed More Than 3 Hair Colors'],
    ['ombre\' or mixed colors extensions', 'Ombré or Mixed Color Extensions'],
    ['ombre and mixed hair color', 'Ombré or Mixed Color Extensions'],
    ['request two people at the same time', 'Request Two People at the Same Time'],
    ['requested two people at the same time (style up to 5 hours)',
      'Request Two People at the Same Time (Style Up to 5 Hours)'],
    ['shampoo', 'Shampoo'],
    ['shampoo & blow dry', 'Shampoo & Blow Dry'],
    ['take down starts at $60 (2-3 hours)', 'Take Down (Starts at $60, 2–3 Hours)'],
    ['take down starts at $60 (2hours-3hours', 'Take Down (Starts at $60, 2–3 Hours)'],
    ['take down starts at $60 (2hours-3hours)', 'Take Down (Starts at $60, 2–3 Hours)'],
    ['take down starts at $35 (1 - 2hours)', 'Take Down (Starts at $35, 1–2 Hours)'],
    ['take down starts from $35 (1hours-2hours', 'Take Down (Starts at $35, 1–2 Hours)'],
    ['take down starts from $35 (1hours-2hours)', 'Take Down (Starts at $35, 1–2 Hours)'],
    ['waist-length (22")', 'Waist-Length (22")'],
  ]);
  if (table.has(lower)) return table.get(lower);

  return null; // unknown → parser will warn
}

// ── Parse the raw dump ─────────────────────────────────────────────────────
// Each service starts with a numbered line like "1)" or "2)" inside a category.
// After some prose, a line "Add to appointment" is followed by an alternating
// pattern:  <addonName>\n(blank)\n<+/- duration @ $price>\n(blank)\n ...
function parseRawDump(text) {
  const lines = text.split(/\r?\n/);
  const services = [];
  let curCategory = null;
  let cur = null;
  let addonMode = false;
  let pendingName = null;

  const flush = () => {
    if (cur) services.push(cur);
    cur = null;
    addonMode = false;
    pendingName = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (/^Category:\s*/i.test(t)) {
      flush();
      curCategory = t.replace(/^Category:\s*/i, '').trim();
      continue;
    }
    // Numbered service header: "1) Some Service"
    const svcMatch = t.match(/^(\d+)\)\s*(.+?)\s*$/);
    if (svcMatch) {
      flush();
      cur = { category: curCategory, index: +svcMatch[1], name: svcMatch[2], addons: [] };
      continue;
    }
    if (!cur) continue;

    if (/^Add to appointment$/i.test(t)) {
      addonMode = true;
      pendingName = null;
      continue;
    }
    if (!addonMode) continue;

    if (!t) {
      // blank line
      continue;
    }
    // A "+/- duration @ $price" line — pair with pending name.
    const dpMatch = t.match(/^[+\-]\s*(?:(\d+)\s*hours?)?\s*(?:(\d+)\s*minutes?)?\s*@\s*\$?([\d.]+)/i);
    if (dpMatch && pendingName) {
      const price = Math.round(parseFloat(dpMatch[3]));
      cur.addons.push({ rawName: pendingName, price });
      pendingName = null;
      continue;
    }
    // Any other non-blank line is an add-on name.
    pendingName = t;
  }
  flush();
  return services;
}

// ── Fuzzy service-name matching between raw source and Firestore ───────────
function slug(s) {
  return s
    .toLowerCase()
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7')
    .replace(/\beight\b/g, '8')
    .replace(/\bnine\b/g, '9')
    .replace(/\bten\b/g, '10')
    .replace(/\bfeeding\b/g, 'feed')
    .replace(/\bfeed[- ]?in\b/g, 'feed')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function tokens(s) {
  // Keep 1-char tokens (digits especially matter for disambiguation).
  return new Set(slug(s).split(' ').filter((w) => w.length >= 1));
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const token = await getAccessToken();

  // Pull all serviceAddons and services from Firestore.
  const addonsRes = await fsGet(
    `/v1/projects/${PROJECT}/databases/(default)/documents/serviceAddons?pageSize=300`,
    token,
  );
  const svcRes = await fsGet(
    `/v1/projects/${PROJECT}/databases/(default)/documents/services?pageSize=300`,
    token,
  );

  const dbAddons = (addonsRes.documents || []).map((d) => ({
    id: d.name.split('/').pop(),
    name: d.fields?.name?.stringValue || '',
    appliesToAll: d.fields?.appliesToAll?.booleanValue || false,
  }));
  const dbServices = (svcRes.documents || []).map((d) => ({
    id: d.name.split('/').pop(),
    name: d.fields?.name?.stringValue || '',
    category: d.fields?.category?.stringValue || '',
  }));

  console.log(`DB add-ons: ${dbAddons.length}, DB services: ${dbServices.length}`);

  const addonIdByCanon = new Map();
  for (const a of dbAddons) {
    addonIdByCanon.set(a.name.trim().toLowerCase(), a.id);
  }

  // Parse raw source.
  const raw = readFileSync(RAW_PATH, 'utf8');
  const rawServices = parseRawDump(raw);
  console.log(`Raw source services: ${rawServices.length}`);

  // Match raw entries to Firestore service docs (best token overlap).
  const matches = []; // {rawService, dbService, score, canonAddonIds}
  const usedDbIds = new Set();
  // Pre-index dbServices by category for faster matching.
  const byCat = new Map();
  for (const s of dbServices) {
    const arr = byCat.get(s.category) || [];
    arr.push(s);
    byCat.set(s.category, arr);
  }
  // We need a raw-category → slug-category map (batch1/2/3 slug conventions).
  const catMap = new Map([
    ['microlocs retie maintenance', 'microlocs-retie-maintenance'],
    ['microlocs specials', 'microlocs-specials'],
    ['ana\'s hair treatments', 'anas-hair-treatments'],
    ['consultation', 'consultation'],
    ['corn rows', 'corn-rows'],
    ['corn rows + individuals', 'corn-rows-individuals'],
    ['cornrow ponytail', 'cornrow-ponytail'],
    ['crochet braids', 'crochet-braids'],
    ['dread/faux locs', 'dread-faux-locs'],
    ['feed-in/stich braids', 'feed-in-stitch-braids'],
    ['head spa', 'head-spa'],
    ['kids braids', 'kids-braids'],
    ['kids microlocs', 'kids-microlocs'],
    ['knotless braids', 'knotless-braids'],
    ['layers/ tribals braids', 'layers-tribal-braids'],
    ['lemonade braids', 'lemonade-braids'],
    ['men\u2019s braids', 'mens-braids'],
    ['men\'s braids', 'mens-braids'],
    // Mojibake variant of U+2019 apostrophe:
    ['men\u00e2\u20ac\u2122s braids', 'mens-braids'],
    ['micro hair', 'micro-hair'],
    ['microlocs hair extension', 'microlocs-hair-extension'],
    ['mini twist ( faux labellelocs )', 'mini-twist'],
    ['sew in', 'sew-in'],
    ['shampoo service', 'shampoo'],
    ['starter locs', 'starter-locs'],
    ['take down', 'take-down'],
    ['touch up', 'touch-up'],
    ['tree braid', 'tree-braid'],
    ['twist', 'twist'],
  ]);
  const unknownAddonReports = [];

  // Build every plausible (raw, db) pairing scored, then pick highest-scoring
  // pairs first (global-greedy). Prevents earlier low-score matches from
  // stealing DB rows that later raw entries need more.
  const allPairs = [];
  for (const r of rawServices) {
    const catKey = (r.category || '').trim().toLowerCase();
    const catSlug = catMap.get(catKey);
    if (!catSlug) {
      console.warn(`⚠ Unknown category: "${r.category}" (service "${r.name}")`);
      continue;
    }
    const candidates = byCat.get(catSlug) || [];
    for (const c of candidates) {
      allPairs.push({ raw: r, db: c, score: jaccard(r.name, c.name) });
    }
  }
  allPairs.sort((a, b) => b.score - a.score);

  const usedRawIdx = new Set();
  const rawIdxMap = new Map();
  rawServices.forEach((r, i) => rawIdxMap.set(r, i));

  for (const p of allPairs) {
    const ri = rawIdxMap.get(p.raw);
    if (usedRawIdx.has(ri)) continue;
    if (usedDbIds.has(p.db.id)) continue;
    if (p.score < 0.2) continue;

    // Resolve each raw add-on → canonical → Firestore id.
    const ids = [];
    for (const a of p.raw.addons) {
      const canon = canonAddonName(a.rawName, a.price);
      if (!canon) {
        unknownAddonReports.push(`  in "${p.raw.name}": "${a.rawName}" ($${a.price})`);
        continue;
      }
      const id = addonIdByCanon.get(canon.toLowerCase());
      if (!id) {
        unknownAddonReports.push(`  in "${p.raw.name}": canonical "${canon}" not in DB`);
        continue;
      }
      if (!ids.includes(id)) ids.push(id);
    }
    matches.push({ rawService: p.raw, dbService: p.db, canonAddonIds: ids, score: p.score });
    usedRawIdx.add(ri);
    usedDbIds.add(p.db.id);
  }

  // Report raw entries that never got matched.
  rawServices.forEach((r, i) => {
    if (!usedRawIdx.has(i)) {
      const catKey = (r.category || '').trim().toLowerCase();
      const catSlug = catMap.get(catKey) || '(unknown)';
      console.warn(`⚠ No DB match for raw "${r.name}" [${catSlug}]`);
    }
  });

  console.log(`Matched ${matches.length}/${rawServices.length} raw services to DB.`);
  if (unknownAddonReports.length) {
    console.log(`\nUnresolved add-ons (${unknownAddonReports.length}):`);
    for (const u of unknownAddonReports) console.log(u);
  }

  // Report unmatched DB services (in raw-source categories only — leave
  // box-braids / microlocs alone).
  const rawCatSlugs = new Set([...catMap.values()]);
  const unmatched = dbServices.filter((s) => rawCatSlugs.has(s.category) && !usedDbIds.has(s.id));
  if (unmatched.length) {
    console.log(`\nDB services in source categories with no raw match (${unmatched.length}):`);
    for (const s of unmatched) console.log(`  - "${s.name}" [${s.category}]`);
  }

  // ── Dry-run preview ──────────────────────────────────────────────────────
  console.log('\nSample matches (first 5):');
  for (const m of matches.slice(0, 5)) {
    console.log(`  "${m.rawService.name}" → "${m.dbService.name}" [${m.dbService.category}] (score ${m.score.toFixed(2)}, ${m.canonAddonIds.length} add-ons)`);
  }

  // Show lowest-confidence matches so we can eyeball misalignment.
  const sorted = [...matches].sort((a, b) => a.score - b.score);
  console.log('\nLowest-confidence matches (bottom 15):');
  for (const m of sorted.slice(0, 15)) {
    console.log(`  score ${m.score.toFixed(2)}  "${m.rawService.name}" [${m.rawService.category}]  →  "${m.dbService.name}" [${m.dbService.category}]`);
  }

  if (DRY) {
    console.log('\n[DRY RUN] No writes performed.');
    return;
  }

  // ── Step 1: Flip the 10 currently-global add-ons to non-global ───────────
  const globals = dbAddons.filter((a) => a.appliesToAll);
  console.log(`\nStep 1: setting appliesToAll=false on ${globals.length} add-ons...`);
  for (const a of globals) {
    await fsPatch(
      `/v1/projects/${PROJECT}/databases/(default)/documents/serviceAddons/${a.id}`,
      token,
      { appliesToAll: { booleanValue: false } },
      ['appliesToAll'],
    );
    console.log(`  ✓ ${a.name}`);
  }

  // ── Step 2: Update each matched service's addonIds array ─────────────────
  console.log(`\nStep 2: updating addonIds on ${matches.length} services...`);
  for (const m of matches) {
    const arrayValues = m.canonAddonIds.map((id) => ({ stringValue: id }));
    await fsPatch(
      `/v1/projects/${PROJECT}/databases/(default)/documents/services/${m.dbService.id}`,
      token,
      { addonIds: { arrayValue: { values: arrayValues } } },
      ['addonIds'],
    );
    console.log(`  ✓ ${m.dbService.name}  (${m.canonAddonIds.length} add-ons)`);
  }

  console.log('\nDone.');
}

main().catch((e) => { console.error(e); process.exit(1); });
