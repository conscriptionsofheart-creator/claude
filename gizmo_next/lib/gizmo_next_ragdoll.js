/* gizmo_next_ragdoll.js: stage H4, record a rag doll fall and play it back as a clip.
   It records the RESULT of the fall, not the simulation. While Gravity is on, "Record fall" samples the doll's joint turns and its hips every 1/30 s into a clip. Playing it
   goes through the page's clip player (ctx.clips), so there is no physics at playback, a friend sees the same fall, and the cost is small. A ragdoll beat (H2) plays a clip by id.
   Host adapters: ctx.ragdoll {joints(slot) -> {root:{p:[x,y,z], q:[x,y,z,w]}, q:{<clip joint index>:[x,y,z,w]} or q:[...] with ctx.ragdoll.map}, isFalling(slot)},
   ctx.clips {play(slot, clipObject, {loop:false, speed}), stop(slot), setTime?(t)}, ctx.floorAt(x, z).
   A clip is kept as 16 bit whole numbers in text (about 7 KB a second for 20 joints), saved under its own storage key, never more than 1 MB. Too long is refused with a plain message.
   The clip format is clip_player.js's own: {fps, frames:[{q:[22 slots: a turn [x,y,z,w] or nothing], root:[x,y,z]}]}. Slot 0 is the hips' turn; slots 1 to 21 are body joints. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') require('./gizmo_next_actions.js');

  var FPS = 30, QS = 16383, PS = 1000, DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  var LIMITS = { maxBytes: 1000000, hardSeconds: 150, maxClips: 24 };
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function quat(a) { if (!Array.isArray(a) || a.length < 4 || !a.slice(0, 4).every(isNum)) return null; var n = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]); if (n < 1e-6) return null; var s = a[3] < 0 ? -1 / n : 1 / n; return [a[0] * s, a[1] * s, a[2] * s, a[3] * s]; }
  function slerp(a, b, t) {
    var d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], sg = d < 0 ? -1 : 1; d = Math.abs(d);
    var b2 = [b[0] * sg, b[1] * sg, b[2] * sg, b[3] * sg], s0, s1;
    if (d > 0.9995) { s0 = 1 - t; s1 = t; } else { var th = Math.acos(Math.min(1, d)), sn = Math.sin(th); s0 = Math.sin((1 - t) * th) / sn; s1 = Math.sin(t * th) / sn; }
    var o = [a[0] * s0 + b2[0] * s1, a[1] * s0 + b2[1] * s1, a[2] * s0 + b2[2] * s1, a[3] * s0 + b2[3] * s1], n = Math.sqrt(o[0] * o[0] + o[1] * o[1] + o[2] * o[2] + o[3] * o[3]) || 1;
    return [o[0] / n, o[1] / n, o[2] / n, o[3] / n];
  }
  /* 16 bit whole numbers <-> base64 text */
  function b64(i16) {
    var bytes = new Uint8Array(i16.buffer, i16.byteOffset, i16.byteLength);
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var s = '', i; for (i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  function unb64(text, count) {
    if (typeof text !== 'string' || text.length > 4000000) return null;
    var bytes;
    try {
      if (typeof Buffer !== 'undefined') bytes = new Uint8Array(Buffer.from(text, 'base64'));
      else { var s = atob(text); bytes = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); }
    } catch (e) { return null; }
    if (bytes.length !== count * 2) return null;
    var out = new Int16Array(count), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (var k = 0; k < count; k++) out[k] = dv.getInt16(k * 2, true);
    return out;
  }
  function packI16(arr) { var o = new Int16Array(arr.length), dv = new DataView(o.buffer); for (var i = 0; i < arr.length; i++) dv.setInt16(i * 2, arr[i], true); return o; }

  function register() {
    GN.register('ragdoll', { needs: ['actions'], version: 1 }, function (g) {
      var B = g.modules.beats, A = g.modules.actions;
      var API = {}, recs = {}, meta = [], nid = 1, cur = null, playing = {}, told = {};
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'ragdoll', what: t }); else g.say(t); };
      var once = function (k, t) { if (told[k]) return; told[k] = 1; msg(t); };
      var adapter = function () { var o = g.ctx && g.ctx.ragdoll; return o && typeof o === 'object' ? o : null; };
      var clipsA = function () { var o = g.ctx && g.ctx.clips; return o && typeof o === 'object' ? o : null; };
      var slotNow = function () { var s = g.call('selectedSlots', null); if (Array.isArray(s) && s.length) return s[0]; var f = g.figures(); return f.length && f[0] ? f[0].slot : null; };

      /* ---------- reading the doll ---------- */
      function read(slot) {
        var a = adapter(); if (!a || typeof a.joints !== 'function') return null;
        var j; try { j = a.joints(slot); } catch (e) { return null; }
        if (!isObj(j) || !isObj(j.root)) return null;
        var rp = Array.isArray(j.root.p) && j.root.p.length >= 3 && j.root.p.slice(0, 3).every(isNum) ? j.root.p.slice(0, 3) : null, rq = quat(j.root.q);
        if (!rp || !rq) return null;
        var q = {}, n = 0, map = Array.isArray(a.map) ? a.map : null;
        if (Array.isArray(j.q)) j.q.forEach(function (x, i) { var idx = map ? map[i] : i + 1, qq = quat(x); if (qq && isNum(idx) && idx >= 1 && idx <= 21) { q[idx] = qq; n++; } });
        else if (isObj(j.q)) Object.keys(j.q).forEach(function (k) { var idx = Number(k), qq = quat(j.q[k]); if (qq && idx >= 1 && idx <= 21 && Math.floor(idx) === idx) { q[idx] = qq; n++; } });
        if (!n) return null;
        return { rp: rp, rq: rq, q: q };
      }

      /* ---------- recording ---------- */
      API.record = function (slot) {
        if (g.isGuest()) { msg('Only the host can record a fall.'); return false; }
        if (cur) { msg('A fall is already being recorded. Stop it first.'); return false; }
        var a = adapter(); if (!a) { once('adapter', 'The rag doll is not connected yet, so a fall cannot be recorded.'); return false; }
        if (slot === undefined || slot === null) slot = slotNow();
        if (slot === null) { msg('Select a figure first.'); return false; }
        if (meta.length >= LIMITS.maxClips) { msg('That is as many recorded falls as one scene holds. Delete one first.'); return false; }
        if (typeof a.isFalling === 'function') { var f = false; try { f = !!a.isFalling(slot); } catch (e) { f = false; } if (!f) { msg('Turn Gravity on and let the figure go first, then press Record fall.'); return false; } }
        var first = read(slot); if (!first) { msg('The figure could not be read, so nothing was recorded.'); return false; }
        g.pushUndo();
        cur = { slot: slot, t0: g.now(), frames: [], joints: Object.keys(first.q).map(Number).sort(function (x, y) { return x - y; }), p0: first.rp.slice() };
        addFrame(first);
        g.emit('ragdoll-record', { slot: slot });
        g.log({ who: 'ragdoll', what: 'Recording a fall' });
        return true;
      };
      function floorY(x, z) { var f = g.floorAt(x, z); return isNum(f) ? f : 0; }
      function addFrame(s) {
        var p = s.rp.slice(), fl = floorY(p[0], p[2]);
        if (p[1] < fl + 0.05) p[1] = fl + 0.05; /* the hips never go through the floor */
        cur.frames.push({ rp: p, rq: s.rq, q: s.q });
      }
      function sampleNow() {
        var tgt = Math.floor((g.now() - cur.t0) * FPS / 1000 + 1e-6), n = cur.frames.length;
        if (tgt < n) return;
        if (tgt > LIMITS.hardSeconds * FPS) { API.stop(true); return; }
        var s = read(cur.slot); if (!s) { s = null; }
        var last = cur.frames[n - 1];
        for (var i = n; i <= tgt; i++) {
          if (!s) { cur.frames.push(last); continue; }
          var w = (i - (n - 1)) / (tgt - (n - 1)), fr = { rp: [last.rp[0] + (s.rp[0] - last.rp[0]) * w, last.rp[1] + (s.rp[1] - last.rp[1]) * w, last.rp[2] + (s.rp[2] - last.rp[2]) * w], rq: slerp(last.rq, s.rq, w), q: {} };
          cur.joints.forEach(function (j) { var a = last.q[j], b = s.q[j] || a; if (a && b) fr.q[j] = slerp(a, b, w); else if (a) fr.q[j] = a; });
          var fl = floorY(fr.rp[0], fr.rp[2]); if (fr.rp[1] < fl + 0.05) fr.rp[1] = fl + 0.05;
          cur.frames.push(fr);
        }
      }
      API.recording = function () { return !!cur; };
      API.stop = function (tooLong) {
        if (!cur) return null;
        var c = cur; cur = null;
        if (c.frames.length < 2) { msg('That fall was too short to keep.'); return null; }
        var J = c.joints, n = c.frames.length, q = new Array(n * J.length * 4), rq = new Array(n * 4), rp = new Array(n * 3), i, k;
        for (i = 0; i < n; i++) {
          var fr = c.frames[i];
          for (k = 0; k < J.length; k++) { var qq = fr.q[J[k]] || [0, 0, 0, 1], o = (i * J.length + k) * 4; q[o] = Math.round(qq[0] * QS); q[o + 1] = Math.round(qq[1] * QS); q[o + 2] = Math.round(qq[2] * QS); q[o + 3] = Math.round(qq[3] * QS); }
          rq[i * 4] = Math.round(fr.rq[0] * QS); rq[i * 4 + 1] = Math.round(fr.rq[1] * QS); rq[i * 4 + 2] = Math.round(fr.rq[2] * QS); rq[i * 4 + 3] = Math.round(fr.rq[3] * QS);
          for (k = 0; k < 3; k++) rp[i * 3 + k] = clamp(Math.round((fr.rp[k] - c.p0[k]) * PS), -32767, 32767);
        }
        var id = 'rg' + nid++; while (recs[id]) id = 'rg' + nid++;
        var rec = { id: id, name: 'Fall ' + (meta.length + 1), fps: FPS, n: n, joints: J, p0: c.p0.map(r3), q: b64(packI16(q)), rq: b64(packI16(rq)), rp: b64(packI16(rp)) };
        var text = JSON.stringify(rec);
        if (tooLong === true || text.length > LIMITS.maxBytes) { msg('That fall is too long, shorten it. A recording can be about ' + Math.floor(LIMITS.maxBytes / (J.length * 4 * 2 * 4 / 3 * FPS)) + ' seconds.'); return null; }
        if (!g.putFile('ragdoll_' + id, text)) { msg('The fall could not be saved on this computer. It is kept for now but will not be in the saved scene.'); }
        recs[id] = rec; meta.push({ id: id, name: rec.name, frames: n, seconds: r3((n - 1) / FPS), bytes: text.length, joints: J.length });
        clipCache = {};
        g.persist(); g.emit('ragdoll-saved', { id: id });
        msg('Recorded ' + rec.name + ', ' + r3((n - 1) / FPS) + ' seconds.');
        return id;
      };

      /* ---------- the clips ---------- */
      function dataOf(id) {
        if (recs[id]) return recs[id];
        var raw = g.getFile('ragdoll_' + id); if (!raw) return null;
        var r; try { r = JSON.parse(raw); } catch (e) { return null; }
        if (!isObj(r) || !Array.isArray(r.joints) || !isNum(r.n) || r.n < 2 || r.n > LIMITS.hardSeconds * FPS + 2 || r.joints.length < 1 || r.joints.length > 21 || !Array.isArray(r.p0) || r.p0.length !== 3 || !r.p0.every(isNum)) return null;
        if (!r.joints.every(function (j) { return isNum(j) && j >= 1 && j <= 21 && Math.floor(j) === j; })) return null;
        var qd = unb64(r.q, r.n * r.joints.length * 4), rd = unb64(r.rq, r.n * 4), pd = unb64(r.rp, r.n * 3);
        if (!qd || !rd || !pd) return null;
        r.id = id; recs[id] = r; return r;
      }
      var clipCache = {};
      API.toClip = function (id) {
        if (clipCache[id]) return clipCache[id];
        var r = dataOf(id); if (!r) return null;
        var J = r.joints, n = r.n, qd = unb64(r.q, n * J.length * 4), rd = unb64(r.rq, n * 4), pd = unb64(r.rp, n * 3), frames = [], i, k;
        var unit = function (a, b, c, d) { var m = Math.sqrt(a * a + b * b + c * c + d * d) || 1; return [a / m, b / m, c / m, d / m]; }; /* the whole numbers lose a hair of length: put it back */
        for (i = 0; i < n; i++) {
          var q = new Array(22); q[0] = unit(rd[i * 4], rd[i * 4 + 1], rd[i * 4 + 2], rd[i * 4 + 3]);
          for (k = 0; k < J.length; k++) { var o = (i * J.length + k) * 4; q[J[k]] = unit(qd[o], qd[o + 1], qd[o + 2], qd[o + 3]); }
          var x = r.p0[0] + pd[i * 3] / PS, y = r.p0[1] + pd[i * 3 + 1] / PS, z = r.p0[2] + pd[i * 3 + 2] / PS, fl = floorY(x, z);
          frames.push({ q: q, root: [x, y < fl + 0.05 ? fl + 0.05 : y, z] });
        }
        var clip = { fps: r.fps || FPS, frames: frames, hip0: frames[0].root.slice() };
        clipCache[id] = clip; return clip;
      };
      API.clips = function () { return meta.map(function (m) { return Object.assign({}, m, { here: !!dataOf(m.id) }); }); };
      API.get = function (id) { for (var i = 0; i < meta.length; i++) if (meta[i].id === id) return Object.assign({}, meta[i]); return null; };
      API.seconds = function (id) { var m = API.get(id); return m ? m.seconds : 0; };
      API.remove = function (id) {
        if (g.isGuest()) return false;
        var i = meta.findIndex(function (m) { return m.id === id; }); if (i < 0) return false;
        meta.splice(i, 1); delete recs[id]; delete clipCache[id]; g.delFile('ragdoll_' + id); g.persist(); return true;
      };
      API.undoLast = function () {
        if (!meta.length) { msg('There is no recorded fall to undo.'); return false; }
        var last = meta[meta.length - 1].id; API.remove(last); msg('The last recorded fall was removed.'); return true;
      };
      API.rename = function (id, name) { var m = meta.find(function (x) { return x.id === id; }); if (!m || typeof name !== 'string' || !name.length) return false; m.name = name.slice(0, 40); if (recs[id]) recs[id].name = m.name; g.persist(); return true; };

      /* a check a person or the seat can run on any clip: do the knees ever bend backwards, do the hips ever go below the floor (60 Hz, turns blended as the player blends them) */
      API.audit = function (id) {
        var clip = API.toClip(id); if (!clip) return null;
        var n = clip.frames.length, hz = 60, steps = Math.floor((n - 1) / FPS * hz), kneeMin = 1e9, rootMin = 1e9, t;
        for (t = 0; t <= steps; t++) {
          var f = t * FPS / hz, i = Math.min(n - 2, Math.floor(f)), w = f - i, a = clip.frames[i], b = clip.frames[i + 1];
          [4, 5].forEach(function (j) { if (!a.q[j] || !b.q[j]) return; var q = slerp(a.q[j], b.q[j], w), ang = 2 * Math.atan2(q[0], q[3]) * 57.29578; if (ang > 180) ang -= 360; if (ang < kneeMin) kneeMin = ang; });
          var y = a.root[1] + (b.root[1] - a.root[1]) * w; if (y < rootMin) rootMin = y;
        }
        return { kneeMinDeg: kneeMin === 1e9 ? null : Math.round(kneeMin * 100) / 100, rootMinY: rootMin === 1e9 ? null : Math.round(rootMin * 1000) / 1000, samples: steps + 1, seconds: r3((n - 1) / FPS) };
      };

      /* ---------- playing ---------- */
      API.play = function (slot, id, opts) {
        opts = opts || {};
        if (slot === undefined || slot === null) slot = slotNow();
        var C = clipsA(); if (!C || typeof C.play !== 'function') { once('clips', 'The clip player is not connected yet, so a recorded fall cannot be played.'); return false; }
        var clip = API.toClip(id);
        if (!clip) { once('missing:' + id, 'The recorded fall ' + String(id).slice(0, 40) + ' is not on this computer.'); return false; }
        playing[slot] = { id: id, until: g.now() + (clip.frames.length - 1) / FPS * 1000 };
        try {
          var r = C.play(slot, clip, { loop: false, speed: isNum(opts.speed) ? opts.speed : 1 });
          var seek = function () { if (isNum(opts.from) && opts.from > 0 && typeof C.setTime === 'function') C.setTime(opts.from); };
          if (r && typeof r.then === 'function') r.then(seek, function () { /* the player refused */ }); else seek();
        } catch (e) { g.log({ who: 'ragdoll', what: 'The clip player stopped with an error' }); return false; }
        return true;
      };
      API.stopPlay = function (slot) {
        var C = clipsA(); if (slot === undefined || slot === null) slot = slotNow();
        delete playing[slot];
        if (C && typeof C.stop === 'function') { try { C.stop(slot); } catch (e) { /* the player was not running */ } }
        return true;
      };
      API.isPlaying = function (slot) { var p = playing[slot]; return !!p && g.now() < p.until; };

      /* the ragdoll beat (H2): by clip id, the hold is the clip's length so the next beat waits */
      A.register('ragdoll', {
        validate: function (p) { var c = typeof p.clipId === 'string' ? p.clipId.slice(0, 80) : ''; if (!c) return 'A ragdoll beat needs a recorded fall.'; var o = {}; ['id', 't', 'slot', 'kind', 'hold'].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; }); o.clipId = c; return o; },
        hold: function (p) { return isNum(p.hold) && p.hold > 0 ? p.hold : API.seconds(p.clipId); },
        start: function (p) { API.play(p.slot, p.clipId); },
        stop: function (p) { API.stopPlay(p.slot); }
      });

      /* ---------- the strip rows and the 2D panel ---------- */
      B.hooks.rows.push(function (h) {
        if (!adapter()) return [];
        var rows = [], slot = slotNow();
        if (cur) rows.push({ label: 'Stop recording the fall', ic: 'stop', act: function () { API.stop(); h.redraw(); } });
        else rows.push({ label: 'Record fall', ic: 'record', act: function () { API.record(slot); h.redraw(); } });
        meta.slice(-4).forEach(function (m) {
          rows.push({ label: 'Add ragdoll beat: ' + m.name + ' (' + m.seconds + ' s)', ic: 'plus', act: function () { A.add({ kind: 'ragdoll', slot: slot, clipId: m.id }); h.redraw(); } });
          rows.push({ label: 'Play fall: ' + m.name, ic: 'play', act: function () { API.play(slot, m.id); h.redraw(); } });
        });
        if (meta.length) { rows.push({ label: 'Stop the fall', ic: 'stop', act: function () { API.stopPlay(slot); h.redraw(); } }); rows.push({ label: 'Undo last recording', ic: 'trash', act: function () { g.pushUndo(); API.undoLast(); h.redraw(); } }); }
        return rows;
      });
      var part = {
        alwaysTick: true,
        tick: function () { if (cur) { try { sampleNow(); } catch (e) { g.log({ who: 'ragdoll', what: 'A frame of the fall could not be read' }); } } },
        mountPanel: function (el) {
          var doc = el && (el.ownerDocument || (typeof document !== 'undefined' ? document : null)); if (!doc || g.isGuest()) return false;
          var mk = function (tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
          var box = mk('div', 'gn-ragdoll'); box.appendChild(mk('div', 'gn-title', 'Record a fall')); var bar = mk('div', 'gn-bar');
          var btn = function (t, fn) { var b = mk('button', 'gn-btn', t); b.addEventListener('click', function () { try { fn(); } catch (e) { /* ignore */ } }); bar.appendChild(b); };
          btn('Record fall', function () { API.record(); }); btn('Stop recording', function () { API.stop(); }); btn('Play last fall', function () { if (meta.length) API.play(null, meta[meta.length - 1].id); });
          btn('Undo last recording', function () { g.pushUndo(); API.undoLast(); });
          box.appendChild(bar); el.appendChild(box); return true;
        },
        state: function () {
          if (!meta.length) return null;
          return { v: 1, clips: meta.map(function (m) { return { id: m.id, name: m.name, frames: m.frames, seconds: m.seconds, bytes: m.bytes, joints: m.joints }; }), files: meta.map(function (m) { return 'ragdoll_' + m.id; }), next: nid };
        },
        load: function (s) {
          cur = null; playing = {}; recs = {}; clipCache = {}; meta = []; told = {};
          if (isObj(s) && Array.isArray(s.clips)) s.clips.slice(0, LIMITS.maxClips).forEach(function (m) {
            if (!isObj(m) || typeof m.id !== 'string' || !/^rg\d{1,6}$/.test(m.id) || !isNum(m.frames) || !isNum(m.seconds)) return;
            meta.push({ id: m.id, name: typeof m.name === 'string' ? m.name.slice(0, 40) : m.id, frames: clamp(Math.floor(m.frames), 2, LIMITS.hardSeconds * FPS + 2), seconds: clamp(m.seconds, 0, LIMITS.hardSeconds + 1), bytes: isNum(m.bytes) ? clamp(m.bytes, 0, 4e6) : 0, joints: isNum(m.joints) ? clamp(Math.floor(m.joints), 1, 21) : 20 });
          });
          nid = isObj(s) && isNum(s.next) ? clamp(Math.floor(s.next), 1, 1e6) : meta.length + 1;
          meta.forEach(function (m) { var n = parseInt(m.id.slice(2), 10); if (n >= nid) nid = n + 1; });
        },
        reset: function () { cur = null; playing = {}; recs = {}; clipCache = {}; meta = []; nid = 1; told = {}; },
        dispose: function () { cur = null; }
      };
      API.limits = LIMITS;
      /* the saved scene carries the clip files by name, so a scene saver can ship them: files() gives {storage name: text} */
      API.files = function () { var o = {}; meta.forEach(function (m) { var t = g.getFile('ragdoll_' + m.id); if (t) o['ragdoll_' + m.id] = t; }); return o; };
      API.restoreFiles = function (map) {
        if (!isObj(map)) return 0; var n = 0;
        Object.keys(map).slice(0, LIMITS.maxClips).forEach(function (k) { if (/^ragdoll_rg\d{1,6}$/.test(k) && typeof map[k] === 'string' && map[k].length <= LIMITS.maxBytes) { g.putFile(k, map[k]); delete recs[k.slice(8)]; delete clipCache[k.slice(8)]; n++; } });
        return n;
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      return API;
    });
  }

  GN._ragdollRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
