/* gizmo_next_trigger.js: stage H3, the Trigger box gizmo (Horizon's "Trigger zone", with Meta's field names where they exist).
   A see-through box with the trigger picture and name on it, a real volume she resizes with the handles, a panel (Triggered By, Enabled, Armed, When, How often, what it starts),
   enter and leave detection, and a template. The host's page runs triggers; a friend's page never does. Nothing runs on open: the box must be Armed and Gizmos live must be on.
   Visitors: the local rig (ctx.head()), friends (ctx.peers()), figures if ticked (ctx.figures()), and props by tag (ctx.props()).
   Starts (run in order, each with a delay): beats (a named range of the Beat strip), sound, spawn, seat, script, show, hide. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') require('./gizmo_next_beats.js');

  var HYST = 0.15, SLEEP = 25, MAX_TESTS = 40, DOS = ['beats', 'sound', 'spawn', 'seat', 'script', 'show', 'hide'];
  var DO_LABEL = { beats: 'Play beats', sound: 'Play a sound', spawn: 'Send to a spawn point', seat: 'Sit them in a seat', script: 'Run a script function', show: 'Show an object', hide: 'Hide an object' };
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function pt3(p) { return Array.isArray(p) && p.length >= 3 && isNum(p[0]) && isNum(p[1]) && isNum(p[2]) ? p : null; }

  /* the oriented box test: the point in the box's own frame, grown by `margin` metres on every side */
  function inBox(rec, p, margin) {
    var dx = p[0] - rec.x, dy = p[1] - rec.y, dz = p[2] - rec.z, c = Math.cos(rec.yaw || 0), s = Math.sin(rec.yaw || 0);
    var lx = c * dx - s * dz, lz = s * dx + c * dz, m = margin || 0;
    return Math.abs(lx) <= rec.size[0] / 2 + m && Math.abs(dy) <= rec.size[1] / 2 + m && Math.abs(lz) <= rec.size[2] / 2 + m;
  }
  function cleanStarts(list) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 24).forEach(function (s) {
      if (!isObj(s) || DOS.indexOf(s.do) < 0) return;
      out.push({ do: s.do, arg: str(s.arg === undefined || s.arg === null ? '' : String(s.arg), 80), delay: isNum(s.delay) ? Math.round(clamp(s.delay, 0, 600) * 100) / 100 : 0 });
    });
    return out;
  }
  function faceTexture(T, name, col) {
    if (typeof document === 'undefined' || !T.CanvasTexture) return null;
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = 128; var c = cv.getContext('2d'); if (!c) return null;
      c.fillStyle = '#15111d'; c.fillRect(0, 0, 128, 128); c.globalAlpha = 0.35; c.fillStyle = col; c.fillRect(0, 0, 128, 128); c.globalAlpha = 1;
      c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round';
      glyph(c, 64, 52);
      c.font = '600 15px sans-serif'; c.textAlign = 'center'; c.fillText(String(name || 'Trigger box').slice(0, 16), 64, 114);
      return new T.CanvasTexture(cv);
    } catch (e) { return null; }
  }
  /* the trigger picture: a doorway frame with a figure stepping in */
  function glyph(c, cx, cy) {
    c.beginPath(); c.moveTo(cx - 24, cy + 24); c.lineTo(cx - 24, cy - 24); c.lineTo(cx + 24, cy - 24); c.lineTo(cx + 24, cy + 24); c.stroke();
    c.beginPath(); c.arc(cx, cy - 8, 6, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - 2); c.lineTo(cx, cy + 14); c.moveTo(cx - 8, cy + 4); c.lineTo(cx + 8, cy + 4); c.stroke();
    c.beginPath(); c.moveTo(cx - 40, cy + 30); c.lineTo(cx - 28, cy + 30); c.lineTo(cx - 33, cy + 25); c.moveTo(cx - 28, cy + 30); c.lineTo(cx - 33, cy + 35); c.stroke();
  }

  function register() {
    GN.register('trigger', { needs: ['beats'], version: 1 }, function (g) {
      var B = g.modules.beats;
      var API = {}, K = null, kapi = null;
      var inside = {}, cursor = 0, seenEver = null, remember = false, told = {}, totalFires = 0;
      var stats = { tests: 0, lastTests: 0, maxTests: 0, sleeping: 0 };
      var env = {};
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'trigger', what: t }); else g.say(t); };
      var once = function (key, t) { if (told[key]) return; told[key] = 1; msg(t); };
      var nowS = function () { return g.now() / 1000; };

      /* ---------- visitors ---------- */
      function visitors(rec) {
        var out = [], i;
        if (rec.by === 'objects') {
          var tags = rec.tags || [];
          if (!tags.length) return out;
          var ps = g.props();
          for (i = 0; i < ps.length; i++) {
            var p = ps[i]; if (!p || !p.object || !p.object.position) continue;
            var pt = p.tags || []; if (!tags.some(function (t) { return pt.indexOf(t) >= 0; })) continue;
            out.push({ id: 'obj:' + p.id, name: str(p.name || p.id, 40), guest: false, kind: 'object', head: [p.object.position.x, p.object.position.y, p.object.position.z], feet: null });
          }
          return out;
        }
        var who = rec.who, names = (rec.names || []).map(function (n) { return String(n).toLowerCase(); });
        var ok = function (v) { return who === 'anyone' || (who === 'guests' && v.guest) || (who === 'me' && v.local) || (who === 'named' && names.indexOf(String(v.name).toLowerCase()) >= 0); };
        var head = g.head();
        if (head) { var me = { id: 'me', name: str(g.ctx && g.ctx.localName, 40) || 'Me', guest: false, local: true, kind: 'player', head: head, feet: null }; if (ok(me)) out.push(me); }
        if (who !== 'me') g.peers().forEach(function (p) {
          if (!p || typeof p.id !== 'string') return; var h = pt3(p.head); if (!h) return;
          var v = { id: p.id, name: str(p.name || p.id, 40), guest: !!p.guest, local: false, kind: 'player', head: h, feet: pt3(p.feet) };
          if (ok(v)) out.push(v);
        });
        if (rec.figures && who !== 'me') g.figures().forEach(function (f) {
          if (!f) return; var h = pt3(f.head); if (!h) return;
          var v = { id: 'fig:' + f.slot, name: str(f.name || ('Figure ' + f.slot), 40), guest: false, local: false, kind: 'figure', head: h, feet: null };
          if (who === 'anyone' || (who === 'named' && names.indexOf(String(v.name).toLowerCase()) >= 0)) out.push(v);
        });
        return out;
      }

      /* ---------- firing ---------- */
      function everKey(rec, v, type) { return rec.id + '|' + String(v.name).toLowerCase() + '|' + type; }
      function loadEver() {
        if (seenEver) return seenEver;
        seenEver = {};
        var raw = g.getFile('trigger_ever'); if (raw) { try { var o = JSON.parse(raw); if (isObj(o)) Object.keys(o).slice(0, 2000).forEach(function (k) { if (o[k] === 1) seenEver[k] = 1; }); } catch (e) { /* start empty */ } }
        return seenEver;
      }
      function oftenOk(rec, v, type) {
        if (rec.cooldown > 0 && rec._cool && nowS() < rec._cool) return false;
        if (rec.often === 'visit' || rec.often === 'ever') {
          var seen = rec._seen || (rec._seen = {}), key = v.id + '|' + type;
          if (rec.often === 'ever' && remember) { var ev = loadEver(), k2 = everKey(rec, v, type); if (ev[k2]) return false; ev[k2] = 1; g.putFile('trigger_ever', JSON.stringify(ev)); seen[key] = 1; return true; }
          if (seen[key]) return false;
          seen[key] = 1;
        }
        return true;
      }
      function runStart(rec, v, s) {
        var c = g.ctx || {}, o;
        try {
          if (s.do === 'beats') { if (!B || !B.playRange(s.arg)) once('beats:' + rec.id, 'The trigger ' + rec.name + ' could not play the beats ' + s.arg + '.'); }
          else if (s.do === 'sound') { o = c.sounds; var parts = s.arg.split(':'); if (!o || typeof o.playMode !== 'function') return once('sound', 'Sound is not connected, so a trigger cannot start one.'); o.playMode(parts[0], parts[1] === 'loop' || parts[1] === 'stop' ? parts[1] : 'once'); }
          else if (s.do === 'spawn') { var SP = g.modules.spawn; if (SP && typeof SP.send === 'function') SP.send(v, s.arg); else { o = c.spawn; if (!o || typeof o.send !== 'function') return once('spawn', 'Spawn points are not connected yet, so a trigger cannot send anyone.'); o.send(v.id, s.arg); } }
          else if (s.do === 'seat') { var SM = g.modules.seat; if (SM && typeof SM.sit === 'function') SM.sit(s.arg, v); else { o = c.seat; if (!o || typeof o.sit !== 'function') return once('seat', 'Seats are not connected yet, so a trigger cannot sit anyone.'); o.sit(v.id, s.arg); } }
          else if (s.do === 'script') { o = c.scripts; if (!o || typeof o.event !== 'function') return once('script', 'Scripts are not connected yet, so a trigger cannot run one.'); o.event('trigger', rec.id, 'start', s.arg); }
          else if (s.do === 'show' || s.do === 'hide') { if (typeof c.setObjectVisible !== 'function') return once('show', 'Showing and hiding objects is not connected yet.'); c.setObjectVisible(s.arg, s.do === 'show'); }
        } catch (e) { g.log({ who: rec.name, what: 'A start stopped with an error' }); }
      }
      function fire(rec, v, type, isTest) {
        rec._count = (rec._count || 0) + 1; totalFires++;
        var word = type === 'leave' ? ' left' : ' entered';
        var entry = g.log({ who: rec.name, what: (v.name || 'Someone') + word + (isTest ? ' (test)' : '') });
        g.emit('fire', { trigger: rec, id: rec.id, who: v, type: type, test: !!isTest });
        g.send('trigger', { id: rec.id, who: str(v.name, 40), what: entry.what });
        if (rec.cooldown > 0) rec._cool = nowS() + rec.cooldown;
        cleanStarts(rec.starts).forEach(function (s) {
          if (s.delay > 0) g.after(s.delay, function () { runStart(rec, v, s); }, 'trigger:' + rec.id);
          else runStart(rec, v, s);
        });
      }
      function edge(rec, v, type) {
        g.emit(type, { trigger: rec, id: rec.id, who: v });
        if (rec.when !== type && rec.when !== 'both') return;
        if (!oftenOk(rec, v, type)) return;
        fire(rec, v, type, false);
      }

      /* ---------- detection: host only, live only, armed and enabled only ---------- */
      var shownNow = function (rec) { return !!(g._sel && g._sel.kind === 'trigger' && g._sel.id === rec.id) || !!rec._hover; };
      function detect() {
        stats.lastTests = 0; stats.sleeping = 0;
        var recs = kapi.list.filter(function (r) { return r.enabled && r.armed; });
        if (!recs.length) return;
        var vlist = {}, work = [], i, j;
        var nearest = function (rec, vs) { var best = 1e9; vs.forEach(function (v) { var d = Math.sqrt(Math.pow(v.head[0] - rec.x, 2) + Math.pow(v.head[1] - rec.y, 2) + Math.pow(v.head[2] - rec.z, 2)); if (d < best) best = d; if (v.feet) { var d2 = Math.sqrt(Math.pow(v.feet[0] - rec.x, 2) + Math.pow(v.feet[1] - rec.y, 2) + Math.pow(v.feet[2] - rec.z, 2)); if (d2 < best) best = d2; } }); return best; };
        for (i = 0; i < recs.length; i++) {
          var rec = recs[i], vs = vlist[rec.id] = visitors(rec), mem = inside[rec.id] || (inside[rec.id] = {});
          /* a visitor who is no longer here has left: that is an edge, and a visit that ended is forgotten */
          var here = {}; vs.forEach(function (v) { here[v.id] = 1; });
          Object.keys(mem).forEach(function (id) { if (!here[id]) { var gone = mem[id]; delete mem[id]; edge(rec, gone.v, 'leave'); } });
          if (rec._seen) Object.keys(rec._seen).forEach(function (k) { if (!here[k.split('|')[0]]) delete rec._seen[k]; });
          if (nearest(rec, vs) > SLEEP) { stats.sleeping++; continue; }
          for (j = 0; j < vs.length; j++) work.push([rec, vs[j]]);
        }
        if (!work.length) return;
        if (cursor >= work.length) cursor = 0;
        var n = 0, spent = 0;
        while (n < work.length && spent < MAX_TESTS) {
          var w = work[cursor], r = w[0], v = w[1], was = !!inside[r.id][v.id], now;
          var cost = v.feet ? 2 : 1;
          if (spent + cost > MAX_TESTS && spent > 0) break;
          spent += cost; stats.tests += cost;
          var m = was ? HYST : 0;
          now = inBox(r, v.head, m) || (v.feet ? inBox(r, v.feet, m) : false);
          if (now && !was) { inside[r.id][v.id] = { v: v }; edge(r, v, 'enter'); }
          else if (!now && was) { delete inside[r.id][v.id]; edge(r, v, 'leave'); }
          else if (now) inside[r.id][v.id] = { v: v };
          cursor = (cursor + 1) % work.length; n++;
        }
        stats.lastTests = spent; if (spent > stats.maxTests) stats.maxTests = spent;
      }

      /* ---------- the picture: a small box, and the whole volume while selected, hovered or its panel is open ---------- */
      function syncVolumes() {
        if (!kapi) return;
        kapi.list.forEach(function (rec) {
          var mk = rec._mk; if (!mk || !rec._vol) return;
          var on = shownNow(rec);
          if (rec._volOn === on) return;
          rec._volOn = on; rec._vol.forEach(function (o) { o.visible = on; });
        });
      }

      kapi = g.defineKind({
        id: 'trigger', name: 'Trigger box', plural: 'Trigger boxes', col: '#ff8a5c', H: 0, max: 12, copyable: true, resize: 'size', dupReset: ['armed'],
        glyph: glyph,
        defaults: function () {
          return { size: [1.5, 2, 1.5], enabled: true, armed: false, by: 'players', who: 'anyone', names: [], tags: [], figures: false, when: 'enter', often: 'visit', cooldown: 0, starts: [] };
        },
        fields: [
          { key: 'by', label: 'Triggered By', type: 'enum', opts: [['players', 'Players'], ['objects', 'Objects Tagged']] },
          { key: 'who', label: 'Players', type: 'enum', opts: [['anyone', 'Anyone'], ['guests', 'Guests only'], ['me', 'Just me'], ['named', 'Named person']] },
          { key: 'names', label: 'Named people', type: 'list' },
          { key: 'tags', label: 'Objects Tagged', type: 'list' },
          { key: 'figures', label: 'Include figures', type: 'bool' },
          { key: 'enabled', label: 'Enabled', type: 'bool' },
          { key: 'armed', label: 'Armed', type: 'bool' },
          { key: 'when', label: 'When', type: 'enum', opts: [['enter', 'Someone enters'], ['leave', 'Someone leaves'], ['both', 'Both']] },
          { key: 'often', label: 'How often', type: 'enum', opts: [['every', 'Every time'], ['visit', 'Once per visitor'], ['ever', 'Once ever for each name'], ['cooldown', 'Cooldown']] },
          { key: 'cooldown', label: 'Cooldown (s)', type: 'num', min: 0, max: 600, step: 1 }
        ],
        validate: function (rec) { rec.starts = cleanStarts(rec.starts); return true; },
        build: function (rec, T) {
          var grp = new T.Group(), col = '#ff8a5c', sz = rec.size || [1.5, 2, 1.5];
          grp.add(new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false })));
          var small = new T.BoxGeometry(0.25, 0.25, 0.25), map = faceTexture(T, rec.name, col);
          grp.add(new T.Mesh(small, new T.MeshBasicMaterial({ color: map ? 0xffffff : col, map: map || null, transparent: true, opacity: map ? 0.7 : 0.25, depthWrite: false })));
          grp.add(new T.LineSegments(new T.EdgesGeometry(small), new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false })));
          var big = new T.BoxGeometry(sz[0], sz[1], sz[2]);
          var vol = new T.Mesh(big, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false })), edges = new T.LineSegments(new T.EdgesGeometry(big), new T.LineBasicMaterial({ color: 0xffc9a8, transparent: true, opacity: 1, depthWrite: false }));
          vol.visible = edges.visible = false; grp.add(vol); grp.add(edges);
          rec._vol = [vol, edges]; rec._volOn = false;
          return grp;
        },
        rows: function (rec, H) {
          var rows = [];
          rows.push({ label: 'Test it', ic: 'play', act: function () { API.test(rec.id); H.redraw(); } });
          cleanStarts(rec.starts).forEach(function (s, i) {
            rows.push({ label: (i + 1) + '. ' + DO_LABEL[s.do] + (s.arg ? ': ' + s.arg : '') + ', after ' + s.delay + ' s', ic: null, act: function () { var d = [0, 0.5, 1, 2, 5], at = d.indexOf(s.delay); API.setStart(rec.id, i, { delay: d[(at + 1) % d.length] }); H.say('Delay: ' + s.delay + ' s'); H.redraw(); } });
            rows.push({ label: 'Remove start ' + (i + 1), ic: 'trash', act: function () { g.pushUndo(); API.removeStart(rec.id, i); H.redraw(); } });
          });
          var add = function (what, arg) { rows.push({ label: 'Add: ' + DO_LABEL[what] + (arg ? ' ' + arg : ''), ic: 'plus', act: function () { g.pushUndo(); API.addStart(rec.id, { do: what, arg: arg || '', delay: 0 }); H.redraw(); } }); };
          B.listRanges().slice(0, 6).forEach(function (r) { add('beats', r.name); });
          var ch = API.choices();
          ['sound', 'spawn', 'seat', 'script', 'show', 'hide'].forEach(function (d) { (ch[d] || []).slice(0, 4).forEach(function (a) { add(d, a); }); });
          if (rec.by === 'objects') API.tagChoices().slice(0, 6).forEach(function (t) { if ((rec.tags || []).indexOf(t) < 0) rows.push({ label: 'Add tag: ' + t, ic: 'plus', act: function () { g.pushUndo(); kapi.set(rec.id, { tags: (rec.tags || []).concat([t]) }); H.redraw(); } }); });
          if (rec.who === 'named') g.peers().slice(0, 6).forEach(function (p) { if (p && p.name && (rec.names || []).indexOf(p.name) < 0) rows.push({ label: 'Add name: ' + p.name, ic: 'plus', act: function () { g.pushUndo(); kapi.set(rec.id, { names: (rec.names || []).concat([String(p.name).slice(0, 40)]) }); H.redraw(); } }); });
          return rows;
        }
      });

      /* ---------- the public API ---------- */
      API.kind = kapi;
      API.add = function (spec) { return kapi.add(spec || {}); };
      API.get = function (id) { return kapi.get(id); };
      API.list = function () { return kapi.list.slice(); };
      API.visitors = function (id) { var m = inside[id] || {}; return Object.keys(m).map(function (k) { var v = m[k].v; return { id: v.id, name: v.name, guest: !!v.guest, kind: v.kind }; }); };
      API.stats = stats;
      API.isAsleep = function (id) { var rec = kapi.get(id); if (!rec) return false; var vs = visitors(rec); if (!vs.length) return true; return vs.every(function (v) { return Math.sqrt(Math.pow(v.head[0] - rec.x, 2) + Math.pow(v.head[1] - rec.y, 2) + Math.pow(v.head[2] - rec.z, 2)) > SLEEP && (!v.feet || Math.sqrt(Math.pow(v.feet[0] - rec.x, 2) + Math.pow(v.feet[1] - rec.y, 2) + Math.pow(v.feet[2] - rec.z, 2)) > SLEEP); }); };
      API.setHover = function (id, on) { var rec = kapi.get(id); if (rec) { rec._hover = !!on; syncVolumes(); } };
      API.volumeShown = function (id) { var rec = kapi.get(id); return !!rec && !!rec._volOn; };
      API.test = function (id, fake) {
        if (g.isGuest()) { msg('Only the host can test a trigger.'); return false; }
        var rec = kapi.get(id); if (!rec) return false;
        var v = Object.assign({ id: 'test', name: 'A test visitor', guest: true, kind: 'player', head: [rec.x, rec.y, rec.z], feet: null }, isObj(fake) ? fake : {});
        v.name = str(v.name, 40) || 'A test visitor';
        fire(rec, v, rec.when === 'leave' ? 'leave' : 'enter', true);
        msg('Tested ' + rec.name + '. Delayed steps need Gizmos live on.');
        return true;
      };
      API.starts = function (id) { var rec = kapi.get(id); return rec ? cleanStarts(rec.starts) : []; };
      API.setStarts = function (id, list) { var rec = kapi.get(id); if (!rec || g.isGuest()) return false; return !!kapi.set(id, { starts: cleanStarts(list) }); };
      API.addStart = function (id, s) { var list = API.starts(id); if (list.length >= 24) { msg('That trigger starts as many things as it can.'); return false; } list.push(s); return API.setStarts(id, list); };
      API.removeStart = function (id, i) { var list = API.starts(id); if (i < 0 || i >= list.length) return false; list.splice(i, 1); return API.setStarts(id, list); };
      API.setStart = function (id, i, patch) { var list = API.starts(id); if (!list[i]) return false; list[i] = Object.assign({}, list[i], patch); return API.setStarts(id, list); };
      API.choices = function () { var c = g.call('triggerChoices', null); return isObj(c) ? c : {}; };
      API.tagChoices = function () { var out = []; g.props().forEach(function (p) { ((p && p.tags) || []).forEach(function (t) { if (typeof t === 'string' && out.indexOf(t) < 0) out.push(t); }); }); return out; };
      API.whenOptions = function () {
        var out = [];
        kapi.list.forEach(function (rec) { out.push({ event: 'enter', trigger: rec.id, label: 'Someone enters ' + rec.name }); out.push({ event: 'leave', trigger: rec.id, label: 'Someone leaves ' + rec.name }); });
        return out.map(function (o) { o.label = plain(o.label); return o; });
      };
      Object.defineProperty(API, 'rememberNames', {
        get: function () { return remember; },
        set: function (v) { remember = !!v; g.putFile('trigger_prefs', JSON.stringify({ rememberNames: remember })); },
        enumerable: true
      });
      /* Greeting at the door: Players, Guests only, enters, once per visitor, starts the beats range Greeting. She edits the fields. */
      API.template = function (name) {
        if (name !== 'greeting') return null;
        if (g.isGuest()) { msg('Only the host can add a trigger.'); return null; }
        var id = g.addNearHead('trigger'); if (!id) return null;
        if (!B.getRange('Greeting') && B.length() >= 0.05) B.setRange('Greeting', 0, B.length());
        kapi.set(id, { name: 'Greeting at the door', by: 'players', who: 'guests', when: 'enter', often: 'visit', armed: false, starts: [{ do: 'beats', arg: 'Greeting', delay: 0 }] });
        return kapi.get(id);
      };

      var part = {
        alwaysTick: true,
        init: function () { var raw = g.getFile('trigger_prefs'); if (raw) { try { var o = JSON.parse(raw); if (isObj(o)) remember = !!o.rememberNames; } catch (e) { /* default off */ } } },
        tick: function () {
          syncVolumes();
          if (!g._live || g.isGuest() || !kapi.list.length) return;
          detect();
        },
        reset: function () { inside = {}; cursor = 0; told = {}; },
        load: function () { inside = {}; cursor = 0; told = {}; },
        onLive: function () { inside = {}; cursor = 0; told = {}; },
        sync: { parts: { trigger: {
          encode: function () { return totalFires ? { n: totalFires } : null; },
          validate: function (v) { return isObj(v) && ((isNum(v.n) && v.n >= 0) || (typeof v.id === 'string' && typeof v.what === 'string')); },
          apply: function (v) { if (typeof v.what === 'string') g.log({ who: 'trigger', what: plain(v.what) }); }
        } } },
        dispose: function () { inside = {}; }
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      return API;
    });
  }

  GN._triggerRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
