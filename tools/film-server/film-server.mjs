#!/usr/bin/env node
// Mahopac film server: streams the team film folder (an external drive on this computer) to the app on any device,
// the way Google Drive does, without copying anything. Each clip plays as it streams, and the player can jump
// anywhere in it (range requests).
//
//   node film-server.mjs "E:\Mahopac Film"            (port 8787)
//   node film-server.mjs "E:\Mahopac Film" 8800
//
// It only answers with the film folder's contents, read-only, and only to a request carrying its key (printed when
// it starts, kept in film-server.key next to this file). Reach it from the iPad through Tailscale's https address
// (see README.md): Safari won't play film from a plain http address inside the app.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.argv[2] || '');
const PORT = Number(process.argv[3] || process.env.PORT || 8787);
if (!process.argv[2] || !fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
  console.error('Usage: node film-server.mjs "<film folder>" [port]\nThe film folder (like "E:\\Mahopac Film") was not found.');
  process.exit(1);
}

// The key: made once, kept beside this file (so the app's saved address keeps working after a restart).
const here = path.dirname(fileURLToPath(import.meta.url));
const keyFile = path.join(here, 'film-server.key');
let KEY = process.env.FILM_KEY || '';
if (!KEY) {
  try {
    KEY = fs.readFileSync(keyFile, 'utf8').trim();
  } catch {
    /* first run */
  }
}
if (!KEY) {
  KEY = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(keyFile, KEY);
}

const TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mts': 'video/mp2t',
  '.m2ts': 'video/mp2t',
  '.ts': 'video/mp2t',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
};

/** A path inside the film folder (never outside it), from the request's "path" ("10U/Week 2 - Yorktown"). */
function inside(rel) {
  const full = path.resolve(ROOT, String(rel || '').replace(/^[/\\]+/, ''));
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  // Any web page may ask (the app lives on another address); the key is what lets it in.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Read only.' });
  const url = new URL(req.url || '/', 'http://x');
  if (url.searchParams.get('key') !== KEY) return send(res, 403, { error: 'Wrong or missing key.' });

  if (url.pathname === '/ping') return send(res, 200, { ok: true, name: path.basename(ROOT) });

  if (url.pathname === '/list') {
    const dir = inside(url.searchParams.get('path'));
    if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return send(res, 404, { error: 'No such folder.' });
    const dirs = [];
    const files = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name.startsWith('~$') || e.name === 'System Volume Information' || e.name === '$RECYCLE.BIN') continue;
      if (e.isDirectory()) dirs.push(e.name);
      else if (e.isFile()) {
        try {
          files.push({ name: e.name, size: fs.statSync(path.join(dir, e.name)).size });
        } catch {
          /* gone while listing */
        }
      }
    }
    return send(res, 200, { dirs, files });
  }

  if (url.pathname === '/file') {
    const file = inside(url.searchParams.get('path'));
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'No such file.' });
    const size = fs.statSync(file).size;
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      if (!range[1] && !range[2]) {
        start = 0;
        end = size - 1;
      }
      if (start >= size || start < 0 || end < start) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        return res.end();
      }
      end = Math.min(end, size - 1);
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  }

  return send(res, 404, { error: 'Not here.' });
});

server.listen(PORT, () => {
  console.log(`Mahopac film server: streaming "${ROOT}"`);
  console.log(`  On this computer: http://localhost:${PORT}`);
  console.log(`  Key (paste in the app with the address): ${KEY}`);
  console.log('  For the iPad: run  tailscale serve --bg ' + PORT + '  and use the https address it shows.');
});
