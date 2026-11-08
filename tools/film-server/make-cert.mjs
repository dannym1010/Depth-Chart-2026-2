#!/usr/bin/env node
// Local mode (no internet, no Tailscale): makes the film server's https certificate for this network.
//   node make-cert.mjs              (this computer's network addresses)
//   node make-cert.mjs 192.168.4.1  (an extra address, like a NAS's own Wi-Fi)
//
// It makes, in ./cert:
//   ca.crt / ca.key           "Mahopac Film Server" certificate authority: install ca.crt on the iPad once and trust it
//   server.crt / server.key   the film server's certificate, for this computer's addresses, signed by it
// Needs OpenSSL (it comes with Git for Windows). Run it again if this computer's network address changes.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'cert');
fs.mkdirSync(dir, { recursive: true });

function findOpenssl() {
  const tries = ['openssl', 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe', 'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe', 'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe'];
  for (const t of tries) {
    try {
      execFileSync(t, ['version'], { stdio: 'ignore' });
      return t;
    } catch {
      /* next */
    }
  }
  console.error('OpenSSL not found. Install Git for Windows (https://git-scm.com), then run this again.');
  process.exit(1);
}
const openssl = findOpenssl();
const run = (...args) => execFileSync(openssl, args, { cwd: dir, stdio: 'inherit' });

// This computer's addresses on the network (IPv4), its name, and any given.
const ips = new Set(['127.0.0.1', ...process.argv.slice(2)]);
for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) ips.add(a.address);
const names = new Set(['localhost', os.hostname(), `${os.hostname()}.local`]);
const san = [...[...names].map((n) => `DNS:${n}`), ...[...ips].map((ip) => `IP:${ip}`)].join(',');

// The authority: made once (re-used after, so the iPad only installs it once).
if (!fs.existsSync(path.join(dir, 'ca.crt'))) {
  run('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '3650', '-keyout', 'ca.key', '-out', 'ca.crt', '-subj', '/CN=Mahopac Film Server', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
}
// The film server's certificate (an iPad takes one for 825 days at most).
fs.writeFileSync(
  path.join(dir, 'server.ext'),
  `basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`
);
run('req', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-keyout', 'server.key', '-out', 'server.csr', '-subj', `/CN=${os.hostname()}`);
run('x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '820', '-sha256', '-extfile', 'server.ext');
for (const f of ['server.csr', 'server.ext']) fs.rmSync(path.join(dir, f), { force: true });

console.log('\nMade cert/server.crt for:', [...names, ...ips].join(', '));
console.log('Start the film server; it now answers on https. On the iPad, install cert/ca.crt once (the film server shows how).');
