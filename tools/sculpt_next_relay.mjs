/* sculpt_next_relay.mjs: the room relay for Sculpt together (lib/sculpt_next_collab.js). Plain Node, nothing to install:  node tools/sculpt_next_relay.mjs [port]   (default 8787)
   Headsets connect to ws://<this computer>:8787/?room=atelier. The relay does three things and nothing else: it gives each headset an id, it NUMBERS every message and sends it to everyone in the
   room (the sender too), and it says when someone leaves. It never looks inside the work, so any number of rooms can share one relay. Same protocol as tools/sculpt_next_relay.py.
   A page served over https needs wss:// (put the relay behind the same TLS proxy as the page); over http, ws:// is fine. */
import http from 'node:http';
import crypto from 'node:crypto';

const port = +(process.argv[2] || process.env.PORT || 8787), rooms = new Map(), MAX = 64 * 1024 * 1024;
const log = (...a) => { if (!process.env.QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };

function frame(text) {   /* one unmasked text frame (server to client) */
  const body = Buffer.from(text, 'utf8'), n = body.length; let head;
  if (n < 126) head = Buffer.from([0x81, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, body]);
}
function control(op, payload) { const p = payload || Buffer.alloc(0); return Buffer.concat([Buffer.from([0x80 | op, p.length]), p]); }

function peer(sock, roomName) {
  let room = rooms.get(roomName); if (!room) { room = { n: 0, id: 0, peers: new Map() }; rooms.set(roomName, room); }
  const id = 'p' + (++room.id), me = { id, sock, alive: true };
  const send = (p, text) => { if (p.alive) try { p.sock.write(frame(text)); } catch (e) { /* closing */ } };
  const others = [...room.peers.keys()]; room.peers.set(id, me);
  send(me, JSON.stringify({ t: 'welcome', id, peers: others, n: room.n })); log('room', roomName, '+', id, '(' + room.peers.size + ')');
  function onText(text) {
    let m; try { m = JSON.parse(text); } catch (e) { return; } if (!m || typeof m !== 'object' || !m.t) return;
    m.from = id; m.n = ++room.n; const out = JSON.stringify(m);
    if (m.t === 'snap' && m.for && m.for !== '*') { const p = room.peers.get(m.for); if (p) send(p, out); return; }   /* a newcomer's snapshot goes only to the newcomer */
    room.peers.forEach(p => send(p, out));
  }
  function gone() {
    if (!me.alive) return; me.alive = false; room.peers.delete(id); log('room', roomName, '-', id, '(' + room.peers.size + ')');
    const out = JSON.stringify({ t: 'bye', from: id, n: ++room.n }); room.peers.forEach(p => send(p, out)); if (!room.peers.size) rooms.delete(roomName);
    try { sock.destroy(); } catch (e) { /* gone */ }
  }
  /* reading frames: masked (client to server), possibly in pieces */
  let buf = Buffer.alloc(0), parts = [], partsLen = 0;
  sock.on('data', chunk => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    for (;;) {
      if (buf.length < 2) return; const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80; let len = buf[1] & 0x7f, at = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); at = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); at = 10; }
      if (len > MAX) { gone(); return; } const need = at + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let data = buf.subarray(at + (masked ? 4 : 0), need); if (masked) { const k = buf.subarray(at, at + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= k[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { try { sock.write(control(8)); } catch (e) { /* closing */ } gone(); return; }
      if (op === 9) { try { sock.write(control(10, data)); } catch (e) { /* closing */ } continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2 || op === 0) { parts.push(data); partsLen += data.length; if (partsLen > MAX) { gone(); return; } if (fin) { const whole = Buffer.concat(parts); parts = []; partsLen = 0; onText(whole.toString('utf8')); } }
    }
  });
  sock.on('close', gone); sock.on('error', gone); sock.on('end', gone);
}

const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('Sculpt together relay. Rooms: ' + ([...rooms].map(([k, r]) => k + ' (' + r.peers.size + ')').join(', ') || 'none') + '\n'); });
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key']; if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n'); sock.setNoDelay(true);
  const room = (new URL(req.url, 'http://x').searchParams.get('room') || 'atelier').slice(0, 64); peer(sock, room);
});
server.listen(port, () => log('Sculpt together relay on ws://0.0.0.0:' + port + '/?room=atelier'));
