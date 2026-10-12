/**
 * set-storage-cors.mjs
 * One-time helper: applies cors.json to the Firebase Storage bucket.
 *
 * Uses Firebase CLI's cached OAuth credentials — no extra packages needed.
 * Run: node set-storage-cors.mjs
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import https from 'https';

// ── Config ─────────────────────────────────────────────────────────────────
const BUCKET   = 'labelle-braids-bb.firebasestorage.app';
const CORS_JSON = JSON.parse(readFileSync('./cors.json', 'utf8'));

// ── Read Firebase CLI cached token ─────────────────────────────────────────
const configPath = join(
  process.env.APPDATA || join(homedir(), '.config'),
  'configstore',
  'firebase-tools.json'
);

// Firebase CLI v10+ stores config in ~/.config/configstore on Windows too
const altConfigPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');

let fbConfig;
try {
  const path = readFileSync(altConfigPath, 'utf8') ? altConfigPath : configPath;
  fbConfig = JSON.parse(readFileSync(path, 'utf8'));
} catch {
  try {
    fbConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    console.error('Cannot read Firebase CLI config. Run: firebase login');
    process.exit(1);
  }
}

const users = fbConfig.users || {};
const user  = Object.values(users)[0] || fbConfig;
if (!user?.tokens?.refresh_token) {
  console.error('No cached refresh token. Run: firebase login');
  process.exit(1);
}
const refreshToken = user.tokens.refresh_token;

// ── Exchange refresh token for access token ─────────────────────────────────
// Firebase CLI uses these public OAuth client credentials (open source in firebase-tools).
// Kept in sync with firebase-tools/lib/api.js — Google rotates the client secret
// periodically. If OAuth "invalid_client" starts failing again, grep that file
// for `clientSecret` and copy the new value.
const CLIENT_ID     = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsPatch(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Fetching access token…');
  const tokenBody = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token: refreshToken,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();

  const tokenRes = await httpsPost(
    {
      hostname: 'oauth2.googleapis.com',
      path:     '/token',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenBody),
      },
    },
    tokenBody
  );

  const tokenJson = JSON.parse(tokenRes.body);
  if (!tokenJson.access_token) {
    console.error('Failed to get access token:', tokenRes.body);
    process.exit(1);
  }
  const accessToken = tokenJson.access_token;
  console.log('Access token obtained.');

  // ── Patch bucket CORS via GCS JSON API ─────────────────────────────────────
  console.log(`Applying CORS to gs://${BUCKET}…`);
  const patchBody = JSON.stringify({ cors: CORS_JSON });

  const patchRes = await httpsPatch(
    {
      hostname: 'storage.googleapis.com',
      path:     `/storage/v1/b/${encodeURIComponent(BUCKET)}?fields=cors`,
      method:   'PATCH',
      headers:  {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(patchBody),
      },
    },
    patchBody
  );

  if (patchRes.status === 200) {
    const result = JSON.parse(patchRes.body);
    console.log('✓ CORS applied successfully!');
    console.log('Current CORS config:', JSON.stringify(result.cors, null, 2));
  } else {
    console.error(`Request failed (${patchRes.status}):`, patchRes.body);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
