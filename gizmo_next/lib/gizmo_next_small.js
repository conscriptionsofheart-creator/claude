/* gizmo_next_small.js: stage H11, seven small gaps, each a few lines and a test.
   1 Text sign gizmo (kind `text`)   2 Door to a saved scene (kind `door`)   3 two materials (objcfg_mats_patch.json, checked here)   4 light budget
   5 mirror cost fields   6 camera beat that fades instead of cutting   7 sound pitch and min distance.
   Nothing here runs by itself. Meta caps were not found for most of these; every number below is a default, listed in README_H11.md. */
(function () {
  'use strict';
  var GN = (typeof window !== 'undefined' && window.GizmoNext) || require('./gizmo_next_core.js');
  if (typeof require === 'function' && typeof module !== 'undefined' && typeof window === 'undefined') require('./gizmo_next_actions.js');

  var BAD = { __proto__: 1, constructor: 1, prototype: 1 };
  var DASHES = new RegExp(' *[' + String.fromCharCode(0x2014, 0x2013) + '] *', 'g');
  var TEXT_MAX = 1000, LIGHT_MAX = 20, FADE = 0.4, SLEW = 2.5;
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function plain(s) { return String(s).replace(DASHES, ', '); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function same(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }

  /* ---------- 1 text: where the words go, pure ---------- */
  var PX_PER_M = 512, CHAR_W = 0.52, LINE_H = 1.15, MIN_FONT = 8;
  function wrap(text, widthPx, font, measure) {
    var m = measure || function (s, f) { return s.length * CHAR_W * f; }, out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(' '), line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (m(t, font) <= widthPx || !line) { line = t; }
        else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }
  /* autoFit shrinks the letters until all the words fit the box; a fixed size never changes and says when the words do not fit */
  function layout(text, boxW, boxH, o) {
    o = o || {}; text = String(text == null ? '' : text);
    var W = Math.max(8, boxW * PX_PER_M), H = Math.max(8, boxH * PX_PER_M), fixed = clamp(isNum(o.fontSize) ? o.fontSize : 48, MIN_FONT, 200), font = fixed, lines;
    if (o.autoFit === false) { lines = wrap(text, W, font, o.measure); return { font: font, lines: lines, overflow: lines.length * font * LINE_H > H + 1e-9 || lines.some(function (l) { return (o.measure || function (s, f) { return s.length * CHAR_W * f; })(l, font) > W + 1e-9; }), width: W, height: H }; }
    font = Math.min(200, H);
    for (;;) {
      lines = wrap(text, W, font, o.measure);
      var tooWide = lines.some(function (l) { return (o.measure || function (s, f) { return s.length * CHAR_W * f; })(l, font) > W + 1e-9; });
      if ((lines.length * font * LINE_H <= H + 1e-9 && !tooWide) || font <= MIN_FONT) break;
      font = Math.max(MIN_FONT, Math.floor(font * 0.92));
    }
    return { font: font, lines: lines, overflow: lines.length * font * LINE_H > H + 1e-9, width: W, height: H };
  }
  function cleanText(t) { return plain(typeof t === 'string' ? t : '').replace(/\r\n?/g, '\n').split('').filter(function (c) { var n = c.charCodeAt(0); return c === '\n' || (n >= 32 && n !== 127 && n !== 0x2028 && n !== 0x2029); }).join('').slice(0, TEXT_MAX); }

  /* ---------- 3 materials: the numbers, checked against the set the app already has ---------- */
  var MATS_EXISTING = { default: { b: 0.3, fr: 5, air: 0.2, ay: 0 }, feather: { b: 0.05, fr: 8, air: 4, ay: 3.2 }, hardwood: { b: 0.35, fr: 4, air: 0.2, ay: 0 }, ice: { b: 0.2, fr: 0.4, air: 0.1, ay: 0 }, metal: { b: 0.15, fr: 2.5, air: 0.1, ay: 0 }, rubber: { b: 0.75, fr: 2.5, air: 0.2, ay: 0 }, superball: { b: 0.92, fr: 1.5, air: 0.15, ay: 0 } };
  var MATS_PATCH = { softwood: { name: 'Softwood', b: 0.25, fr: 6, air: 0.2, ay: 0 }, superice: { name: 'Super ice', b: 0.1, fr: 0.15, air: 0.1, ay: 0 } };

  /* ---------- 4 lights ---------- */
  function lightAdvice(n) {
    n = isNum(n) ? Math.max(0, Math.floor(n)) : 0;
    return { count: n, max: LIGHT_MAX, over: n > LIGHT_MAX, message: n > LIGHT_MAX ? 'This scene has ' + n + ' lights. Meta suggests no more than ' + LIGHT_MAX + ' moving lights at once, so it may run slowly. Turn some off or delete some.' : (n + ' of ' + LIGHT_MAX + ' lights used.') };
  }

  /* ---------- 5 mirrors ---------- */
  var MIRROR_DEF = { radius: 16, nearLod: 3, farLod: 15, nearRes: 540, farRes: 360, nearFps: 30, farFps: 20 };
  var MIRROR_LIM = { radius: [1, 64], nearLod: [0.5, 30], farLod: [1, 60], nearRes: [120, 1080], farRes: [90, 1080], nearFps: [5, 60], farFps: [5, 60] };
  function mirrorFieldsClean(raw, base) {
    var o = Object.assign({}, MIRROR_DEF, base || {}), s = isObj(raw) ? raw : {};
    Object.keys(MIRROR_LIM).forEach(function (k) { if (isNum(s[k])) o[k] = r3(clamp(s[k], MIRROR_LIM[k][0], MIRROR_LIM[k][1])); });
    if (o.farLod < o.nearLod) o.farLod = o.nearLod;
    if (o.farRes > o.nearRes) o.farRes = o.nearRes;
    if (o.farFps > o.nearFps) o.farFps = o.nearFps;
    return o;
  }
  /* 0 to 1: the pixels a second the mirror asks for, scaled by how much of the room it looks at; the Meta defaults come to about 0.17 */
  function mirrorCost(m) {
    var f = mirrorFieldsClean(m), area = Math.pow(f.radius / MIRROR_LIM.radius[1], 2), top = 1080 * 1080 * 60;
    var near = f.nearRes * f.nearRes * f.nearFps / top, far = f.farRes * f.farRes * f.farFps / top, lod = clamp(0.55 + 0.45 * (f.farLod - f.nearLod) / 60, 0, 1);
    return r3(clamp((0.6 * near + 0.4 * far) * (0.35 + 0.65 * Math.sqrt(area)) * lod * 8, 0, 1));
  }
  function equalScale(sc) { var a = Array.isArray(sc) && sc.length >= 3 && sc.slice(0, 3).every(isNum) ? sc : [1, 1, 1], m = clamp(Math.max(a[0], a[1], a[2]), 0.04, 20); return [m, m, m]; }

  /* ---------- 7 sounds ---------- */
  var SND_LIM = { pitch: [0.5, 2], minDistance: [0.1, 20], fade: [0.4, 10] }, SND_DEF = { pitch: 1, minDistance: 1, fade: 0.4 };
  function soundClean(raw, base) { var o = Object.assign({}, SND_DEF, base || {}), s = isObj(raw) ? raw : {}; Object.keys(SND_LIM).forEach(function (k) { if (isNum(s[k])) o[k] = r3(clamp(s[k], SND_LIM[k][0], SND_LIM[k][1])); }); return o; }

  /* ---------- 6 camera fade, pure: a dip of at most 0.5 over 0.4 s, 2.5 a second both ways ---------- */
  function shotFade(t) { if (!isNum(t) || t <= 0 || t >= FADE) return 0; return t <= FADE / 2 ? SLEW * t : 0.5 - SLEW * (t - FADE / 2); }

  function register() {
    GN.register('small', { needs: ['actions'], version: 1 }, function (g) {
      var A = g.modules.actions, API = { text: {}, door: {}, light: {}, mirror: {}, camera: {}, sound: {} };
      var mirrors = {}, sounds = {}, told = {}, lastLights = -1, lightAcc = 0, shotT = -1, shotLast = 0;
      var nowS = function () { return g.now() / 1000; };
      var ctx = function () { return g.ctx || {}; };
      var msg = function (t) { t = plain(t); if (g._loading) g.log({ who: 'small', what: t }); else g.say(t); };
      var once = function (k, t) { if (told[k]) return; told[k] = 1; msg(t); };
      var host = function () { return !g.isGuest(); };
      var hh = function (H) { return { say: function (t) { if (H && typeof H.say === 'function') { try { H.say(plain(t)); } catch (e) { /* menu gone */ } } else msg(t); }, redraw: function () { if (H && typeof H.redraw === 'function') { try { H.redraw(); } catch (e) { /* menu gone */ } } else g.redraw(); } }; };

      /* ===== 1 TEXT ===== */
      var layer = null, planes = {}, tk = null;
      function layerObj() { if (layer && layer.parent) return layer; var T = g.THREE, sc = g.scene(); if (!T || !sc || typeof sc.add !== 'function') return null; layer = new T.Group(); layer.name = 'gizmoNext_text_layer'; sc.add(layer); return layer; }
      function drawText(rec, lay) {
        if (typeof document === 'undefined' || !g.THREE || !g.THREE.CanvasTexture) return null;
        try {
          var cv = document.createElement('canvas'); cv.width = Math.round(lay.width); cv.height = Math.round(lay.height); var c = cv.getContext('2d'); if (!c) return null;
          c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 ' + lay.font + 'px sans-serif';
          var lh = lay.font * LINE_H, y0 = cv.height / 2 - (lay.lines.length - 1) * lh / 2;
          lay.lines.forEach(function (l, i) { c.fillText(l, cv.width / 2, y0 + i * lh); });
          return new g.THREE.CanvasTexture(cv);
        } catch (e) { return null; }
      }
      function syncPlane(rec) {
        var T = g.THREE, L = layerObj(); if (!T || !L) return;
        var p = planes[rec.id], key = JSON.stringify([rec.text, rec.autoFit, rec.fontSize, rec.size, rec.x, rec.y, rec.z, rec.yaw, rec.visible]);
        if (p && p.key === key) return;
        if (p) { L.remove(p.mesh); if (p.mesh.geometry) p.mesh.geometry.dispose(); if (p.mesh.material) { if (p.mesh.material.map && p.mesh.material.map.dispose) p.mesh.material.map.dispose(); p.mesh.material.dispose(); } }
        var lay = layout(rec.text, rec.size[0], rec.size[1], { autoFit: rec.autoFit, fontSize: rec.fontSize }), map = drawText(rec, lay);
        var mesh = new T.Mesh(new T.PlaneGeometry(rec.size[0], rec.size[1]), new T.MeshBasicMaterial({ color: 0xffffff, map: map || null, transparent: true, opacity: map ? 1 : 0.0, depthWrite: false, side: T.DoubleSide }));
        mesh.position.set(rec.x, rec.y, rec.z); mesh.rotation.set(0, rec.yaw || 0, 0); mesh.visible = rec.visible !== false; mesh.name = 'text_' + rec.id; mesh.userData.lines = lay.lines.length; mesh.userData.font = lay.font;
        L.add(mesh); planes[rec.id] = { mesh: mesh, key: key, lay: lay };
      }
      tk = g.defineKind({
        id: 'text', name: 'Text sign', plural: 'Text signs', col: '#f3eee2', H: 0, max: 12, copyable: true, resize: 'size', strMax: { text: TEXT_MAX },
        glyph: function (c, cx, cy) { c.font = '700 40px sans-serif'; c.textAlign = 'center'; c.fillText('Aa', cx, cy + 12); },
        defaults: function () { return { text: 'Welcome', autoFit: true, fontSize: 48, visible: true, size: [1.2, 0.5, 0.02] }; },
        fields: [
          { key: 'autoFit', label: 'Auto Fit', type: 'bool' },
          { key: 'fontSize', label: 'Fixed Font Size', type: 'num', min: MIN_FONT, max: 200, step: 4 },
          { key: 'visible', label: 'Visible', type: 'bool' }
        ],
        validate: function (rec) { rec.text = cleanText(rec.text); return true; },
        build: function (rec, T) {
          var grp = new T.Group(), sz = rec.size || [1.2, 0.5, 0.02];
          grp.add(new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: 0xf3eee2, transparent: true, opacity: 0, depthWrite: false })));
          var box = new T.BoxGeometry(sz[0], sz[1], Math.max(sz[2], 0.02));
          grp.add(new T.LineSegments(new T.EdgesGeometry(box), new T.LineBasicMaterial({ color: 0xf3eee2, transparent: true, opacity: 0.6, depthWrite: false })));
          return grp;
        },
        rows: function (rec, H) {
          var h = hh(H), rows = [], samples = ['Welcome', 'Exit this way', 'No entry', 'Please sit down'];
          rows.push({ label: 'Words: ' + rec.text.slice(0, 24) + (rec.text.length > 24 ? '...' : ''), ic: null, act: function () { g.pushUndo(); var n = samples[(samples.indexOf(rec.text) + 1) % samples.length]; API.text.setText(rec.id, n); h.say('Words: ' + n); h.redraw(); } });
          rows.push({ label: 'Auto Fit: ' + (rec.autoFit ? 'on' : 'off'), ic: null, on: function () { return rec.autoFit; }, act: function () { g.pushUndo(); tk.set(rec.id, { autoFit: !rec.autoFit }); h.redraw(); } });
          rows.push({ label: 'Fixed Font Size: ' + rec.fontSize, ic: null, act: function () { var o = [24, 36, 48, 72, 96, 128], n = o[(o.indexOf(rec.fontSize) + 1) % o.length] || 48; g.pushUndo(); tk.set(rec.id, { fontSize: n }); h.say('Fixed Font Size: ' + n); h.redraw(); } });
          rows.push({ label: 'Visible: ' + (rec.visible ? 'on' : 'off'), ic: null, on: function () { return rec.visible; }, act: function () { g.pushUndo(); tk.set(rec.id, { visible: !rec.visible }); h.redraw(); } });
          return rows;
        }
      });
      API.text.kind = tk; API.text.layout = layout; API.text.cap = TEXT_MAX;
      API.text.add = function (spec) { if (g.isGuest()) { msg('Only the host places gizmos.'); return null; } var r = tk.add(spec || {}); if (r) r.text = cleanText(r.text); return r; };
      API.text.get = function (id) { return tk.get(id); };
      API.text.setText = function (id, t) { if (g.isGuest()) return null; return tk.set(id, { text: cleanText(t) }); };
      API.text.plane = function (id) { var p = planes[id]; return p ? p.mesh : null; };
      API.text.layoutOf = function (id) { var p = planes[id]; return p ? p.lay : null; };

      /* ===== 2 DOOR ===== */
      var dk = g.defineKind({
        id: 'door', name: 'Door', plural: 'Doors', col: '#c88a4a', H: 0, max: 12, copyable: true, resize: 'scale',
        glyph: function (c, cx, cy) { c.strokeRect(cx - 14, cy - 24, 28, 48); c.beginPath(); c.arc(cx + 8, cy, 2.5, 0, 7); c.fill(); },
        defaults: function () { return { sceneName: '', thumbKey: '' }; },
        fields: [],
        build: function (rec, T) {
          var grp = new T.Group(), col = 0xc88a4a;
          grp.add(new T.Mesh(new T.SphereGeometry(0.12, 10, 8), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false })));
          var box = new T.BoxGeometry(0.6, 1, 0.06);
          grp.add(new T.Mesh(box, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false })));
          grp.add(new T.LineSegments(new T.EdgesGeometry(box), new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false })));
          return grp;
        },
        rows: function (rec, H) {
          var h = hh(H), rows = [], names = API.door.choices();
          rows.push({ label: 'Go to ' + (rec.sceneName || 'no scene yet'), ic: 'play', act: function () { if (API.door.go(rec.id)) h.say('Going to ' + rec.sceneName); h.redraw(); } });
          rows.push({ label: 'Scene: ' + (rec.sceneName || 'none'), ic: null, act: function () { if (!names.length) { h.say('No scenes to pick yet. Share or save a scene first.'); return; } var n = names[(names.indexOf(rec.sceneName) + 1) % names.length]; g.pushUndo(); API.door.setScene(rec.id, n); h.say('Scene: ' + n); h.redraw(); } });
          return rows;
        }
      });
      API.door.kind = dk;
      API.door.add = function (spec) { if (g.isGuest()) { msg('Only the host places gizmos.'); return null; } return dk.add(spec || {}); };
      API.door.get = function (id) { return dk.get(id); };
      API.door.shared = function () { var l = g.call('sharedScenes', []); return Array.isArray(l) ? l.filter(function (x) { return typeof x === 'string'; }).map(function (x) { return x.slice(0, 80); }) : []; };
      API.door.choices = function () { var all = g.call('sceneList', null), shared = API.door.shared(); if (g.isGuest()) return shared; return Array.isArray(all) ? all.filter(function (x) { return typeof x === 'string'; }).slice(0, 48) : shared; };
      API.door.setScene = function (id, name) { if (g.isGuest()) return null; name = plain(str(name, 80)); return dk.set(id, { sceneName: name, thumbKey: name }); };
      /* a guest only sees doors to scenes she shared */
      API.door.visibleFor = function (id, asGuest) { var r = dk.get(id); if (!r) return false; if (!asGuest) return true; return !!r.sceneName && API.door.shared().some(function (s) { return same(s, r.sceneName); }); };
      API.door.canGo = function (id) { var r = dk.get(id); if (!r || !r.sceneName) return false; if (!g._live) return false; if (g.isGuest()) return API.door.visibleFor(id, true); return true; };
      /* the press: it never opens on its own. Go waits for Gizmos live, and a guest cannot go to a scene that was not shared. */
      API.door.go = function (id) {
        var r = dk.get(id); if (!r) return false;
        if (!r.sceneName) { msg('This door has no scene yet.'); return false; }
        if (!g._live) { msg('Turn Gizmos live on to use this door.'); return false; }
        if (g.isGuest() && !API.door.visibleFor(id, true)) { msg('This door leads to a scene that was not shared with you.'); return false; }
        var f = ctx().openScene; if (typeof f !== 'function') { once('openScene', 'Opening scenes is not connected yet.'); return false; }
        try { f(r.sceneName); } catch (e) { msg('That scene could not be opened.'); return false; }
        g.log({ who: r.name, what: 'Went to ' + r.sceneName }); return true;
      };

      /* ===== 3 MATERIALS ===== */
      API.mats = { patch: function () { return JSON.parse(JSON.stringify(MATS_PATCH)); }, existing: function () { var c = ctx().objCfg; return c && isObj(c.MATS) ? JSON.parse(JSON.stringify(c.MATS)) : JSON.parse(JSON.stringify(MATS_EXISTING)); } };
      API.mats.check = function (patch) {
        var ex = API.mats.existing(), rng = {}, bad = [];
        ['b', 'fr', 'air', 'ay'].forEach(function (k) { var v = Object.keys(ex).map(function (n) { return ex[n][k]; }); rng[k] = [Math.min.apply(null, v), Math.max.apply(null, v)]; });
        /* a new material may be a little outside the set (Super ice is slipperier than Ice on purpose): a quarter of the lowest to one and a quarter of the highest */
        Object.keys(patch || MATS_PATCH).forEach(function (id) { var m = (patch || MATS_PATCH)[id]; ['b', 'fr', 'air', 'ay'].forEach(function (k) { if (!isNum(m[k]) || m[k] < rng[k][0] * 0.25 || m[k] > rng[k][1] * 1.25) bad.push(id + '.' + k); }); if (typeof m.name !== 'string' || !m.name) bad.push(id + '.name'); });
        return { ok: bad.length === 0, bad: bad, ranges: rng };
      };

      /* ===== 4 LIGHTS ===== */
      API.light.advice = lightAdvice;
      API.light.count = function () { var l = g.call('lights', null); return Array.isArray(l) ? l.length : (isNum(l) ? Math.max(0, Math.floor(l)) : 0); };
      API.light.check = function () { var a = lightAdvice(API.light.count()); if (a.over && lastLights !== a.count) once('lights:' + a.count, a.message); lastLights = a.count; return a; };

      /* ===== 5 MIRRORS ===== */
      API.mirror.defaults = function () { return Object.assign({}, MIRROR_DEF); };
      API.mirror.fields = function (id) { return mirrorFieldsClean(mirrors[String(id)] || {}); };
      API.mirror.set = function (id, patch) {
        if (g.isGuest()) return API.mirror.fields(id); id = String(id); if (BAD[id] || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return API.mirror.fields(id);
        mirrors[id] = mirrorFieldsClean(patch, mirrors[id]); if (JSON.stringify(mirrors[id]) === JSON.stringify(MIRROR_DEF)) delete mirrors[id]; if (!g._loading) g.persist(); return API.mirror.fields(id);
      };
      API.mirror.cost = mirrorCost; API.mirror.equalScale = equalScale;
      API.mirror.advice = function (count) { return count > 1 ? 'This scene has ' + count + ' mirrors. One is recommended, because each mirror draws the room again.' : ''; };
      API.mirror.rows = function (id, H) {
        if (g.isGuest()) return []; var h = hh(H), rows = [], f = API.mirror.fields(id);
        var cyc = function (key, vals, label, unit) { rows.push({ label: label + ': ' + f[key] + unit, ic: null, act: function () { var n = vals[(vals.indexOf(f[key]) + 1) % vals.length]; g.pushUndo(); var p = {}; p[key] = n; API.mirror.set(id, p); h.say(label + ': ' + n + unit); h.redraw(); } }); };
        rows.push({ label: 'Mirror cost: ' + Math.round(mirrorCost(f) * 100) + ' of 100', ic: null, act: function () { h.say('Lower the radius, the sizes, or the frame rates to make the mirror cheaper.'); } });
        cyc('radius', [4, 8, 16, 32, 64], 'Render Radius', ' m'); cyc('nearLod', [1, 3, 6], 'Near LOD', ''); cyc('farLod', [6, 15, 30], 'Far LOD', ''); cyc('nearRes', [270, 360, 540, 720, 1080], 'Near resolution', 'p'); cyc('farRes', [180, 270, 360, 540], 'Far resolution', 'p'); cyc('nearFps', [10, 20, 30, 60], 'Near frame rate', ''); cyc('farFps', [5, 10, 20, 30], 'Far frame rate', '');
        rows.push({ label: 'Defaults: radius 16, LOD 3 and 15, 540p and 360p, 30 and 20 frames', ic: null, act: function () { g.pushUndo(); delete mirrors[String(id)]; g.persist(); h.say('Mirror settings reset'); h.redraw(); } });
        return rows;
      };

      /* ===== 6 CAMERA: a cut becomes a 0.4 s fade ===== */
      API.camera.fadeAt = shotFade;
      API.camera.fade = function () { return shotT < 0 ? 0 : shotFade(nowS() - shotT); };
      API.camera.shots = function () { var c = ctx().camera; if (c && typeof c.shots === 'function') { try { var l = c.shots(); if (Array.isArray(l)) return l.filter(function (x) { return typeof x === 'string'; }); } catch (e) { /* none */ } } return null; };
      API.camera.valid = function (name) { if (typeof name !== 'string' || !name.trim() || name.length > 40) return false; var l = API.camera.shots(); return l === null || l.indexOf(name) >= 0; };
      API.camera.cut = function (name) {
        var c = ctx().camera; if (!c || typeof c.shot !== 'function') { once('camera', 'Camera shots are not connected yet, so camera beats do nothing.'); return false; }
        if (!API.camera.valid(name)) { once('shot:' + name, 'There is no camera shot called ' + str(name, 40) + '.'); return false; }
        shotT = nowS();
        try { c.shot(name, { fadeSec: FADE }); } catch (e) { return false; }
        return true;
      };
      A.register('camera', {
        looks: true,
        validate: function (p) { var s = str(p.shot, 40).trim(); if (!s) return 'A camera beat needs a shot.'; if (!API.camera.valid(s)) return 'There is no camera shot called ' + s + '.'; var o = {}; ['id', 't', 'slot', 'kind', 'hold'].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; }); o.shot = s; return o; },
        hold: function () { return FADE; },
        start: function (p) { API.camera.cut(p.shot); }
      });

      /* ===== 7 SOUNDS ===== */
      API.sound.defaults = function () { return Object.assign({}, SND_DEF); };
      API.sound.fields = function (id) { return soundClean(sounds[String(id)] || {}); };
      API.sound.set = function (id, patch) {
        if (g.isGuest()) return API.sound.fields(id); id = String(id); if (BAD[id] || !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return API.sound.fields(id);
        var f = soundClean(patch, sounds[id]); sounds[id] = f; if (JSON.stringify(f) === JSON.stringify(SND_DEF)) delete sounds[id];
        var S = ctx().sounds; if (S && typeof S.set === 'function') { try { S.set(id, { pitch: f.pitch, minDistance: f.minDistance, fade: f.fade }); } catch (e) { /* the page keeps its own */ } } else once('sounds', 'Sound settings are not connected yet, so pitch and distance are kept but not heard.');
        if (!g._loading) g.persist(); return API.sound.fields(id);
      };
      API.sound.rows = function (id, H) {
        if (g.isGuest()) return []; var h = hh(H), f = API.sound.fields(id), rows = [];
        var step = function (dir) { return function () { var p = Math.pow(2, Math.round(Math.log2(f.pitch) * 12 + dir) / 12); g.pushUndo(); var n = API.sound.set(id, { pitch: p }); h.say('Pitch: ' + n.pitch); h.redraw(); }; };
        rows.push({ label: 'Pitch: ' + f.pitch + ' (0.5 to 2)', ic: null, act: function () { h.say('Pitch is how high the sound is. 1 is normal.'); } });
        rows.push({ label: 'Pitch down', ic: null, act: step(-1) }); rows.push({ label: 'Pitch up', ic: null, act: step(1) });
        rows.push({ label: 'Min distance: ' + f.minDistance + ' m', ic: null, act: function () { var o = [0.5, 1, 2, 4, 8], n = o[(o.indexOf(f.minDistance) + 1) % o.length] || 1; g.pushUndo(); API.sound.set(id, { minDistance: n }); h.say('Min distance: ' + n + ' m'); h.redraw(); } });
        rows.push({ label: 'Fade: ' + f.fade + ' s (0.4 or more)', ic: null, act: function () { var o = [0.4, 1, 2, 4], n = o[(o.indexOf(f.fade) + 1) % o.length] || 0.4; g.pushUndo(); API.sound.set(id, { fade: n }); h.say('Fade: ' + n + ' s'); h.redraw(); } });
        return rows;
      };

      /* ---------- the Settings page for the numbers that are about the whole scene ---------- */
      g.registerPage({ id: 'small', title: 'Scene limits', label: 'Scene limits', where: 'settings', rows: function (H) {
        var a = API.light.check(), h = hh(H), rows = [];
        rows.push({ label: a.message, ic: null, act: function () { h.say(a.message); } });
        var mc = g.call('mirrorCount', 0); if (isNum(mc) && mc > 1) rows.push({ label: API.mirror.advice(mc), ic: null, act: function () { h.say(API.mirror.advice(mc)); } });
        return rows;
      } });

      var part = {
        alwaysTick: true,
        tick: function (dt) {
          tk.list.forEach(syncPlane);
          Object.keys(planes).forEach(function (id) { if (!tk.get(id)) { var p = planes[id]; if (layer) layer.remove(p.mesh); delete planes[id]; } });
          if (g.isGuest() || !g._live) { /* doors for a guest */ }
          dk.list.forEach(function (rec) { var mk = rec._mk; if (mk && g.isGuest()) mk.visible = false; });
          lightAcc += dt; if (lightAcc >= 2 && !g.isGuest()) { lightAcc = 0; if (ctx().lights) API.light.check(); }
          var c = ctx().camera; if (shotT >= 0) { var f = shotFade(nowS() - shotT); if (c && typeof c.fade === 'function') { try { c.fade(f); } catch (e) { /* the page has no fade */ } } if (nowS() - shotT >= FADE) { shotT = -1; if (c && typeof c.fade === 'function') { try { c.fade(0); } catch (e) { /* none */ } } } }
        },
        state: function () { var any = Object.keys(mirrors).length || Object.keys(sounds).length; return any ? { v: 1, mirrors: mirrors, sounds: sounds } : null; },
        load: function (s) {
          mirrors = {}; sounds = {}; told = {}; if (!isObj(s)) return;
          if (isObj(s.mirrors)) Object.keys(s.mirrors).slice(0, 24).forEach(function (id) { if (!BAD[id] && /^[A-Za-z0-9_-]{1,40}$/.test(id) && isObj(s.mirrors[id])) mirrors[id] = mirrorFieldsClean(s.mirrors[id]); });
          if (isObj(s.sounds)) Object.keys(s.sounds).slice(0, 48).forEach(function (id) { if (!BAD[id] && /^[A-Za-z0-9_-]{1,40}$/.test(id) && isObj(s.sounds[id])) sounds[id] = soundClean(s.sounds[id]); });
        },
        reset: function () { mirrors = {}; sounds = {}; told = {}; shotT = -1; },
        dispose: function () { Object.keys(planes).forEach(function (id) { if (layer) layer.remove(planes[id].mesh); }); planes = {}; if (layer && layer.parent) layer.parent.remove(layer); layer = null; }
      };
      Object.keys(part).forEach(function (k) { API[k] = part[k]; });
      return API;
    });
  }

  GN.smallPure = { layout: layout, cleanText: cleanText, lightAdvice: lightAdvice, mirrorCost: mirrorCost, mirrorFields: mirrorFieldsClean, equalScale: equalScale, shotFade: shotFade, soundClean: soundClean, matsPatch: MATS_PATCH, matsExisting: MATS_EXISTING };
  GN._smallRegister = register;
  register();
  if (typeof module !== 'undefined') module.exports = GN;
})();
