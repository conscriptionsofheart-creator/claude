/* sculpt_next_collab.js: SCULPT TOGETHER (Ruth 2026-10-14: "if the tools can make that with me in headset with at least one collaborator (ideally four, but let's get it solid with 2 first)").
   How it stays the same on every headset: nobody sends clay or triangles while sculpting. Each headset sends what its hands did this frame (fingertip, pinch, grip, pointing way) and every menu tap, to a small
   RELAY, which numbers every message and sends it back to EVERYONE, the sender too. Each headset then works the messages in that one order, each as a job in the clay queue (sculpt_next_clay.js), so every dab
   a message makes is done before the next message is worked. Same start, same messages, same order: the same clay, rods, shapes and keys everywhere, at a few hundred bytes per hand per frame.
   Joining late: the newcomer's hello is numbered like anything else; at that point everyone ends the strokes in progress, the longest-standing person sends a snapshot of the work (clay bricks, rods, the
   emblem, the pieces brushed so far, everyone's settings), and the newcomer picks up from exactly there. Undo starts fresh at a join (the newcomer cannot hold the others' undo steps).
   Every few seconds each headset sends a short checksum of its work; if one ever differs from the first person's, the first person sends a snapshot and everyone takes it (a mismatch heals itself).
   makeCollab(E): E is the engine's side (sculpt_next_engine.js): newCtx, frame, action, endAllPeers, endPeer, clearUndo, snapshot, restore, checksum, enqueue, presence, say, liveCfg.
   connectWs(url) and makeLocalRelay() give a transport { send(obj), onmessage, onclose, close() }. The relays for a room are tools/sculpt_next_relay.mjs (Node) and tools/sculpt_next_relay.py (Python). */
export const SUM_EVERY = 480;   /* a checksum every 480 numbered messages: about every 3 s with two people sculpting */
const CFG_SKIP = new Set(['on']);

export function makeCollab(E) {
  const C = { on: false, me: null, name: '', state: 'off', t: null, lastN: 0, peers: new Map(), order: [], holdAfter: null, buffer: [], sums: new Map(), sentCfg: {}, lastResync: -1e9, joinedAt: 0, waitT: 0 };
  const say = t => { try { E.say(t); } catch (e) { /* optional */ } };
  const send = m => { if (C.t) try { C.t.send(m); } catch (e) { say('Sculpt together: the link dropped (' + (e && e.message || e) + ').'); } };
  const nameOf = id => { const c = C.peers.get(id); return c ? c.name : null; };
  const senior = exclude => C.order.find(id => id !== exclude && C.peers.has(id) && !C.peers.get(id).gone) || null;

  function start(transport, opts) {
    if (C.on) stop(true);
    opts = opts || {}; C.on = true; C.state = 'connecting'; C.name = opts.name || ''; C.t = transport; C.lastN = 0; C.peers.clear(); C.order = []; C.holdAfter = null; C.buffer = []; C.sums.clear(); C.sentCfg = {}; C.waitT = 0;
    transport.onmessage = onMessage; transport.onclose = () => { if (C.on) { say('Sculpt together: the relay closed the link. You carry on alone; your work stays.'); stop(true); } };
    return true;
  }
  function stop(quiet) {
    if (!C.on) return false; const t = C.t; C.t = null; C.on = false; C.state = 'off';
    try { E.endAllPeers(id => id !== C.me); } catch (e) { /* best effort */ }
    C.peers.forEach(c => { try { E.presence(c.id, null); } catch (e) { /* gone */ } });
    try { E.stopped(); } catch (e) { /* engine back to solo */ }
    try { t && t.close(); } catch (e) { /* closed */ }
    if (!quiet) say('You are sculpting alone again. Everything made together stays here.');
    return true;
  }
  /* ---------- arriving messages ---------- */
  function onMessage(m) {
    if (!C.on || !m || !m.t) return;
    if (m.t === 'welcome') { C.me = m.id; C.state = m.peers && m.peers.length ? 'joining' : 'alone'; C.joinedAt = Date.now(); send({ t: 'hello', name: C.name, cfg: E.liveCfg() }); return; }
    if (m.t === 'f' && m.from && m.from !== C.me) { try { E.presence(m.from, m.h || [], m.col); } catch (e) { /* drawing only */ } }   /* the collaborator's hands show at once; their work follows in order */
    if (m.n == null || m.n <= C.lastN) return; C.lastN = m.n;
    if (C.state === 'joining') {
      if (C.holdAfter == null) { if (m.t === 'hello' && m.from === C.me) { C.holdAfter = m.n; C.waitT = Date.now(); } return; }   /* everything before my hello is in the snapshot I am about to get */
    }
    E.enqueue(() => handle(m), m.t === 'a' ? 'a:' + m.fn : m.t === 'f' ? 'f' + (m.h && m.h.some(h => h.pi) ? ' pinch' : '') : m.t);
  }
  /* ---------- the ordered part: runs as a clay-queue job, the same on every headset ---------- */
  function handle(m) {
    if (!C.on) return;
    if (C.holdAfter != null && m.n > C.holdAfter) {
      if (m.t === 'snap' && m.at === C.holdAfter && (m.for === C.me || m.for === '*')) return applySnap(m);
      C.buffer.push(m); if (Date.now() - C.waitT > 15000) { C.waitT = Date.now(); say('Still waiting for the work from your collaborator…'); }
      return;
    }
    if (m.n % SUM_EVERY === 0 && C.state !== 'joining') { const v = E.checksum(); C.sums.set(m.n, v); send({ t: 'sum', at: m.n, v }); if (C.sums.size > 64) C.sums.delete(C.sums.keys().next().value); }
    const ctx = C.peers.get(m.from);
    switch (m.t) {
      case 'hello': {
        const c = E.newCtx(m.from, m.name || '', m.cfg || {}, m.from === C.me); c.joinN = m.n; C.peers.set(m.from, c); if (!C.order.includes(m.from)) C.order.push(m.from);
        E.enqueueGen(E.warmGen(), 'warm');   /* the lookup tables for the figure and objects, a piece per slice, before the next message */
        if (m.from === C.me) { C.state = 'synced'; say(C.order.length > 1 ? 'Joined: sculpting together.' : 'Sculpt together is on. When someone joins, they see your work and you see their hands.'); return; }
        E.endAllPeers(); E.enqueue(() => { E.clearUndo(); say((nameOf(m.from) || 'Someone') + ' joined. Undo starts fresh from here.'); if (senior(m.from) === C.me) sendSnap(m.from, m.n); });
        return;
      }
      case 'bye': { if (!ctx) return; E.endPeer(ctx); ctx.gone = true; C.order = C.order.filter(id => id !== m.from); try { E.presence(m.from, null); } catch (e) { /* gone */ } say(ctx.name + ' left. Their work stays.'); return; }
      case 'f': if (ctx && !ctx.gone) E.frame(ctx, m, C.order[0] === m.from); return;
      case 'a': if (ctx && !ctx.gone) E.action(ctx, m.fn, m.a || [], m.c || null); return;
      case 'sum': {
        const mine = C.sums.get(m.at); if (mine == null || mine === m.v || senior() !== C.me || m.from === C.me) return;
        if (m.n - C.lastResync < SUM_EVERY * 2) return; C.lastResync = m.n; send({ t: 'resync', at: m.at }); return;
      }
      case 'resync': {
        E.endAllPeers(); const r = m.n, sen = senior();
        E.enqueue(() => { E.clearUndo(); if (sen === C.me) sendSnap('*', r); else { C.holdAfter = r; C.waitT = Date.now(); } });
        return;
      }
      default: return;
    }
  }
  /* the snapshot is built a slice at a time right here in the order (every later message waits), then sent */
  function sendSnap(to, at) { const order = C.order.filter(id => C.peers.has(id) && !C.peers.get(id).gone); E.enqueueGen((function* () { const data = yield* E.snapshotGen(order); send({ t: 'snap', for: to, at, data }); })(), 'snapshot'); }
  function applySnap(m) { E.enqueueGen((function* () { yield* E.restoreGen(m.data); yield* E.warmGen(); afterSnap(m); })(), 'restore'); }   /* taken in a slice at a time; the messages that waited follow it in order */
  function afterSnap(m) {
    const ids = true; C.peers.clear(); C.order = [];
    (m.data.ctxs || []).forEach(s => { const c = E.ctxFromSnap(s, s.id === C.me); C.peers.set(s.id, c); C.order.push(s.id); });
    const was = C.state; if (was !== 'joining') C.resyncs = (C.resyncs || 0) + 1; C.state = 'synced'; C.holdAfter = null; const buf = C.buffer; C.buffer = [];
    buf.forEach(b => E.enqueue(() => handle(b)));   /* each goes right after this job, in order, so its dabs come before the next one */
    say(was === 'joining' ? 'You are in: ' + C.order.filter(id => id !== C.me).map(nameOf).join(', ') + ' ' + (C.order.length > 2 ? 'are' : 'is') + ' sculpting with you.' : 'Your work was matched to ' + (nameOf(senior()) || 'the room') + '\'s.');
    void ids;
  }
  /* ---------- what this headset sends ---------- */
  const q = v => Math.round(v * 1e5) / 1e5;   /* 0.01 mm: plenty for a fingertip, and short on the wire */
  function serHand(h) {
    const o = { id: String(h.id), p: [q(h.tip.x), q(h.tip.y), q(h.tip.z)] }; if (h.pinch) o.pi = 1; if (h.grip) o.g = 1; if (h.alt) o.a = 1; if (h.palmUp) o.u = 1;
    if (h.dir) o.d = [q(h.dir.x), q(h.dir.y), q(h.dir.z)]; if (h.quat) o.q = [q(h.quat.x), q(h.quat.y), q(h.quat.z), q(h.quat.w)]; if (h.press != null) o.pr = q(h.press); return o;
  }
  function cfgDiff() {
    const live = E.liveCfg(), d = {}; let any = false;
    for (const k of Object.keys(live)) { if (CFG_SKIP.has(k)) continue; if (C.sentCfg[k] !== live[k]) { d[k] = live[k]; C.sentCfg[k] = live[k]; any = true; } }
    return any ? d : null;
  }
  function localFrame(hands, dt) {
    if (!C.on || !C.me || C.state === 'connecting') return;
    const m = { t: 'f', h: (hands || []).map(serHand), dt: q(Math.min(0.1, dt || 0.016)) }, c = cfgDiff(); if (c) m.c = c; send(m);
  }
  function act(fn, args) { if (!C.on || !C.me) return false; const m = { t: 'a', fn, a: args || [] }, c = cfgDiff(); if (c) m.c = c; send(m); return true; }   /* the settings travel with the tap, so it runs with them */
  return {
    start, stop, localFrame, act, nameOf, C,
    get on() { return C.on; }, get me() { return C.me; }, get state() { return C.state; }, get ordered() { return C.on && C.state !== 'off'; },
    people: () => C.order.filter(id => C.peers.has(id) && !C.peers.get(id).gone).map(id => ({ id, name: nameOf(id), me: id === C.me })),
  };
}

/* ---------- transports ---------- */
/* the browser's WebSocket to a relay (tools/sculpt_next_relay.mjs or .py): ws://host:8787/?room=atelier */
export function connectWs(url) {
  const tr = { onmessage: null, onclose: null, queue: [], open: false };
  const ws = new WebSocket(url); tr.ws = ws;
  ws.onopen = () => { tr.open = true; tr.queue.splice(0).forEach(s => ws.send(s)); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (tr.onmessage) tr.onmessage(m); };
  ws.onclose = () => { tr.open = false; if (tr.onclose) tr.onclose(); };
  ws.onerror = () => { /* onclose follows */ };
  tr.send = m => { const s = JSON.stringify(m); if (tr.open) ws.send(s); else tr.queue.push(s); };
  tr.close = () => { tr.onclose = null; try { ws.close(); } catch (e) { /* closed */ } };
  return tr;
}
/* a relay inside one page (tests, and two engines side by side): the same numbering and the same echo as the real relay, delivered a moment later like a network would */
export function makeLocalRelay(opts) {
  opts = opts || {}; const R = { n: 0, peers: new Map(), id: 0, sent: 0, bytes: 0, pending: 0 };
  const later = fn => { R.pending++; setTimeout(() => { R.pending--; fn(); }, opts.delay || 0); };
  function deliver(to, m) { const s = JSON.stringify(m); R.sent++; R.bytes += s.length; later(() => { const p = R.peers.get(to); if (p && p.onmessage) p.onmessage(JSON.parse(s)); }); }
  R.connect = () => {
    const id = 'p' + (++R.id), tr = { onmessage: null, onclose: null };
    tr.send = m => { const s = JSON.parse(JSON.stringify(m)); if (!R.peers.has(id)) return; s.from = id; s.n = ++R.n; if (s.t === 'snap' && s.for && s.for !== '*') { deliver(s.for, s); return; } R.peers.forEach((_, pid) => deliver(pid, s)); };
    tr.close = () => { if (!R.peers.delete(id)) return; const m = { t: 'bye', from: id, n: ++R.n }; R.peers.forEach((_, pid) => deliver(pid, m)); };
    const others = [...R.peers.keys()]; R.peers.set(id, tr); later(() => tr.onmessage && tr.onmessage({ t: 'welcome', id, peers: others, n: R.n }));
    return tr;
  };
  R.idle = () => R.pending === 0;
  return R;
}

/* ---------- snapshot helpers: typed arrays as base64, geometry and objects as plain data ---------- */
export function b64(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
const TYPES = { f32: Float32Array, f64: Float64Array, u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i8: Int8Array, i16: Int16Array, i32: Int32Array };
const typeName = a => Object.keys(TYPES).find(k => a instanceof TYPES[k]) || 'f32';
export function unb64(s, type) {
  const bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const T = TYPES[type] || Float32Array; return new T(u8.buffer, 0, u8.byteLength / T.BYTES_PER_ELEMENT);
}
const packArr = a => ({ t: typeName(a), b: b64(a) }), unpackArr = p => unb64(p.b, p.t);
export function encodeGeometry(g) {
  const attr = a => ({ ...packArr(a.array), s: a.itemSize, n: !!a.normalized }), out = { a: {}, m: {}, rel: !!g.morphTargetsRelative, groups: (g.groups || []).map(x => [x.start, x.count, x.materialIndex || 0]) };
  Object.keys(g.attributes).forEach(k => { out.a[k] = attr(g.attributes[k]); });
  Object.keys(g.morphAttributes || {}).forEach(k => { out.m[k] = g.morphAttributes[k].map(a => ({ ...attr(a), name: a.name || '' })); });
  if (g.index) out.i = packArr(g.index.array); return out;
}
export function decodeGeometry(THREE, o) {
  const g = new THREE.BufferGeometry(), mk = p => new THREE.BufferAttribute(unpackArr(p), p.s, p.n);
  Object.keys(o.a).forEach(k => g.setAttribute(k, mk(o.a[k])));
  Object.keys(o.m || {}).forEach(k => { g.morphAttributes[k] = o.m[k].map(p => { const a = mk(p); a.name = p.name; return a; }); });
  g.morphTargetsRelative = !!o.rel; if (o.i) g.setIndex(new THREE.BufferAttribute(unpackArr(o.i), 1)); (o.groups || []).forEach(x => g.addGroup(x[0], x[1], x[2]));
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
/* place, turn and size exactly as they are (a matrix taken apart again can come back a hair different, and the checksum would see it) */
export const trs = o => [o.position.toArray(), o.quaternion.toArray(), o.scale.toArray()];
export const setTrs = (o, t) => { o.position.fromArray(t[0]); o.quaternion.fromArray(t[1]); o.scale.fromArray(t[2]); o.updateMatrix(); o.updateMatrixWorld(true); };
/* an object made by the engine (a rod, the emblem): groups and meshes with standard materials, as data */
export function encodeObject(o) {
  const out = { k: o.isMesh ? 'mesh' : 'group', name: o.name, t: trs(o), ud: { noMerge: !!(o.userData && o.userData.noMerge) }, c: [] };
  if (o.isMesh) { const mt = Array.isArray(o.material) ? o.material[0] : o.material; out.g = encodeGeometry(o.geometry); out.mat = { r: mt.roughness == null ? 0.5 : mt.roughness, mt: mt.metalness || 0, vc: !!mt.vertexColors, col: mt.color ? mt.color.getHex() : 0xffffff }; }
  o.children.forEach(ch => { if (!/^vr/.test(ch.name || '')) out.c.push(encodeObject(ch)); }); return out;
}
export function decodeObject(THREE, d) {
  const o = d.k === 'mesh' ? new THREE.Mesh(decodeGeometry(THREE, d.g), new THREE.MeshStandardMaterial({ roughness: d.mat.r, metalness: d.mat.mt, vertexColors: d.mat.vc, color: d.mat.col })) : new THREE.Group();
  o.name = d.name; setTrs(o, d.t); Object.assign(o.userData, d.ud || {}); (d.c || []).forEach(c => o.add(decodeObject(THREE, c))); o.updateMatrixWorld(true); return o;
}
/* a clay field as data: the bricks that hold distances (keys, 512 distances, 512 colours each) and the solid ones (keys only) */
export function encodeField(f, INSIDE) {
  const full = [], solid = []; f.bricks.forEach((br, k) => { if (br === INSIDE) solid.push(k); else full.push([k, br]); });
  const keys = new Float64Array(full.length), d = new Float32Array(full.length * 512), c = new Uint8Array(full.length * 1536);
  full.forEach(([k, br], i) => { keys[i] = k; d.set(br.d, i * 512); c.set(br.c, i * 1536); });
  return { h: f.h, band: f.band, base: f.base.slice(), keys: b64(keys), d: b64(d), c: b64(c), solid: b64(new Float64Array(solid)), version: f.version };
}
export function decodeFieldInto(f, o, INSIDE) {
  const keys = unb64(o.keys, 'f64'), d = unb64(o.d, 'f32'), c = unb64(o.c, 'u8'), solid = unb64(o.solid, 'f64'); f.bricks.clear();
  for (let i = 0; i < keys.length; i++) f.bricks.set(keys[i], { d: d.slice(i * 512, i * 512 + 512), c: c.slice(i * 1536, i * 1536 + 1536) });
  for (let i = 0; i < solid.length; i++) f.bricks.set(solid[i], INSIDE); f.version = o.version || 0; return f;
}
/* a short fingerprint of numbers, the same on every headset that holds the same work */
export function makeHash() {
  let h = 0x811c9dc5 | 0; const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  return { num(v) { f[0] = v; h = Math.imul(h ^ u[0], 16777619); h = Math.imul(h ^ u[1], 16777619); }, str(s) { s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); }, get value() { return h >>> 0; } };
}
