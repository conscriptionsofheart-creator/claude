/* Test server for the sculpt engine (dev only, not shipped): serves scripts/ as the app's flat /pe_lib/ folder, plus three.js r128 and r186.1 from a local npm install,
   and a pretend library (POST /pe_assets/item/<id>) so Save can be tested without the app.
   node tools/sculpt_next_serve.mjs <port> <vendorDir>   (vendorDir holds t128/node_modules/three and t186/node_modules/three) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..'), lib = path.join(root, 'scripts');
const port = +(process.argv[2] || 8188), vendor = path.resolve(process.argv[3] || path.join(root, 'vendor'));
const t128 = path.join(vendor, 't128/node_modules/three'), t186 = path.join(vendor, 't186/node_modules/three');
const MAP = {
  'three.min.js': path.join(t128, 'build/three.min.js'),
  'GLTFLoader.js': path.join(t128, 'examples/js/loaders/GLTFLoader.js'),
  'GLTFExporter.js': path.join(t128, 'examples/js/exporters/GLTFExporter.js'),
  'bst_three_0.186.1.module.js': path.join(t186, 'build/three.module.js'),
  'three.core.js': path.join(t186, 'build/three.core.js'),
  'bst_three_gltfloader_0.186.1.js': path.join(t186, 'examples/jsm/loaders/GLTFLoader.js'),
  'bst_three_gltfexporter_0.186.1.js': path.join(t186, 'examples/jsm/exporters/GLTFExporter.js'),
};
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.glb': 'model/gltf-binary', '.md': 'text/markdown' };
const saved = [];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  if (req.method === 'POST' && p.startsWith('/pe_assets/item/')) {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => { const id = p.split('/').pop(); saved.push({ id, bytes: Buffer.concat(chunks).length }); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, id })); });
    return;
  }
  if (p === '/__saved') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(saved)); return; }
  let file = null;
  if (p.startsWith('/pe_lib/')) { const n = p.slice(8); if (!n.includes('/') && fs.existsSync(path.join(lib, n))) file = path.join(lib, n); else if (MAP[n]) file = MAP[n]; }
  else if (p.startsWith('/utils/')) file = path.join(t186, 'examples/jsm/utils', p.slice(7));
  else if (p.startsWith('/tools/')) file = path.join(root, 'tools', p.slice(7));
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end('not found ' + p); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('serving on http://127.0.0.1:' + port));
