/* Builds the emblem preview page (dev tool): the page inlines the engine's own clay files (sculpt_next_sdf.js, sculpt_next_mesher.js, sculpt_next_emblem.js), so the preview is built by the same code
   as the headset. node tools/sculpt_next_emblem_page.mjs <out.html> */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), lib = path.join(here, '..', 'scripts');
const strip = f => fs.readFileSync(path.join(lib, f), 'utf8').replace(/^import .*$/gm, '').replace(/^export (function|const|let|class|function\*)/gm, '$1').replace(/^export \{[^}]*\};?$/gm, '');
const engine = ['sculpt_next_sdf.js', 'sculpt_next_mesher.js', 'sculpt_next_emblem.js'].map(f => '/* ---- ' + f + ' ---- */\n' + strip(f)).join('\n');
const page = `<title>Emblem in Clay</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">
<style>
/* Layout: one stage (the emblem turning) with a quiet control strip under it; the parts list beside it on wide screens, under it on a phone. One look only: the Atelier's own night purple. */
:root {
  --night: #120d1b; --panel: #1d1529; --tile: #2a2036; --line: #3a2e4a; --ink: #f1ebe0; --soft: #b9aec8; --amber: #e8a866; --amber-ink: #20140a;
  --display: "Bricolage Grotesque", "Avenir Next", "Segoe UI", system-ui, sans-serif; --body: "Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif;
  color-scheme: dark;
}
html, body { height: 100%; }
body { background: var(--night); color: var(--ink); font: 16px/1.5 var(--body); margin: 0; padding-inline: 16px; padding-block: 20px 28px; box-sizing: border-box; }
.wrap { max-width: 1100px; margin: 0 auto; display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr) 300px; align-items: start; }
@media (max-width: 820px) { .wrap { grid-template-columns: minmax(0, 1fr); } }
header { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 16px; }
h1 { font: 700 clamp(28px, 4vw, 40px)/1.1 var(--display); margin: 0; letter-spacing: -0.01em; text-wrap: balance; }
.sub { color: var(--soft); margin: 0; max-width: 62ch; }
.stage { position: relative; background: radial-gradient(120% 90% at 50% 40%, #241a33 0%, var(--night) 70%); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; aspect-ratio: 1 / 1; max-width: 100%; touch-action: none; cursor: grab; }
.stage:active { cursor: grabbing; }
canvas { display: block; width: 100%; height: 100%; }
.progress { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(60%, 320px); display: grid; gap: 10px; text-align: center; color: var(--soft); font-size: 15px; }
.progress[hidden] { display: none; }
.bar { height: 6px; border-radius: 3px; background: var(--tile); overflow: hidden; }
.bar > i { display: block; height: 100%; width: 0; background: var(--amber); transition: width .2s linear; }
.controls { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
button { font: 700 15px/1 var(--body); color: var(--ink); background: var(--tile); border: 1px solid var(--line); border-radius: 10px; padding: 11px 16px; cursor: pointer; }
button[aria-pressed="true"] { background: var(--amber); color: var(--amber-ink); border-color: var(--amber); }
button:focus-visible { outline: 3px solid var(--amber); outline-offset: 2px; }
.hint { color: var(--soft); font-size: 14px; margin: 10px 0 0; }
aside { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px; display: grid; gap: 16px; min-width: 0; }
h2 { font: 600 13px/1 var(--body); text-transform: uppercase; letter-spacing: .09em; color: var(--soft); margin: 0; }
ul.parts { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
ul.parts li { display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 12px; align-items: center; }
.swatch { height: 14px; border-radius: 7px; }
.pname { font-size: 15px; }
dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; font-size: 15px; }
dt { color: var(--soft); } dd { margin: 0; font-variant-numeric: tabular-nums; text-align: right; }
.note { color: var(--soft); font-size: 14px; margin: 0; }
</style>
<div class="wrap">
  <header><h1>Your emblem, in clay</h1><p class="sub">Built by the next sculpt engine from your picture: each body is one rectangular rod, painted in a gradient and twisted, so its other face shows where it turns. The heads are spheres. It turns slowly. In the headset it appears beside you with Sculpt &gt; Clay &amp; shapes &gt; Make the emblem.</p></header>
  <section>
    <div class="stage" id="stage"><canvas id="c" aria-label="The emblem in 3D, turning"></canvas>
      <div class="progress" id="progress"><span id="ptext">Shaping the clay…</span><div class="bar"><i id="pbar"></i></div></div></div>
    <div class="controls">
      <button id="spin" aria-pressed="true">Spin</button>
      <button id="speed" aria-pressed="false">Slow turn</button>
      <button id="front" aria-pressed="false">Face me</button>
      <button id="detail" aria-pressed="false">Detail: normal</button>
    </div>
    <p class="hint">Drag the emblem to turn it yourself. Spin takes about ten seconds a turn and eases in and out; it never flashes.</p>
  </section>
  <aside>
    <h2>Parts (each a clay layer)</h2><p class="note">Rods show two bars: the front face, then the back face that appears where the rod twists.</p>
    <ul class="parts" id="parts"></ul>
    <h2>This build</h2>
    <dl><dt>Triangles</dt><dd id="tris">…</dd><dt>Clay detail</dt><dd id="det">2.5 mm</dd><dt>Build time</dt><dd id="ms">…</dd><dt>Height</dt><dd>42 cm</dd></dl>
    <p class="note">Same files as the headset (sculpt_next_sdf.js, sculpt_next_mesher.js, sculpt_next_emblem.js), so this is exactly what you will get there. Save clay keeps it in the library as a .glb with the spin as an animation.</p>
  </aside>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script type="module">
${engine}
/* ---- the page ---- */
const T = window.THREE, cv = document.getElementById('c'), stage = document.getElementById('stage');
const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); renderer.setClearColor(0x000000, 0);   /* the stage's own night-purple glow shows through */ renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
const scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.01, 10); cam.position.set(0, 0.02, 1.0); cam.lookAt(0, 0, 0);
scene.add(new T.HemisphereLight(0xffffff, 0x3a2e4a, 0.95)); const key = new T.DirectionalLight(0xffffff, 0.95); key.position.set(0.6, 1, 1.6); scene.add(key); const rim = new T.DirectionalLight(0xe8a866, 0.45); rim.position.set(-1, 0.4, -1); scene.add(rim);
const turn = new T.Group(); scene.add(turn);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let spinOn = !reduce, T_TURN = 10, k = spinOn ? 0 : 0, yaw = 0, pitch = 0, dragging = null, detail = 2.5;
const size = () => { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); };
new ResizeObserver(size).observe(stage); size();
const btn = id => document.getElementById(id);
const setPressed = (b, on) => b.setAttribute('aria-pressed', on ? 'true' : 'false');
setPressed(btn('spin'), spinOn); if (reduce) document.querySelector('.hint').textContent = 'Your device asks for less motion, so the spin starts off. Tap Spin to turn it on, or drag the emblem to turn it yourself.';
btn('spin').onclick = () => { spinOn = !spinOn; setPressed(btn('spin'), spinOn); };
btn('speed').onclick = () => { T_TURN = T_TURN === 10 ? 18 : 10; setPressed(btn('speed'), T_TURN === 18); };
btn('front').onclick = () => { yaw = 0; pitch = 0; spinOn = false; setPressed(btn('spin'), false); };
btn('detail').onclick = () => { detail = detail === 2.5 ? 4 : detail === 4 ? 1.8 : 2.5; btn('detail').textContent = 'Detail: ' + ({ 2.5: 'normal', 4: 'light', 1.8: 'fine' })[detail]; build(); };
stage.addEventListener('pointerdown', e => { dragging = { x: e.clientX, y: e.clientY, yaw, pitch }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', e => { if (!dragging) return; yaw = dragging.yaw + (e.clientX - dragging.x) * 0.01; pitch = Math.max(-0.6, Math.min(0.6, dragging.pitch + (e.clientY - dragging.y) * 0.006)); });
stage.addEventListener('pointerup', () => { dragging = null; });
/* the parts list, from the engine's own colour stops */
const css = stops => 'linear-gradient(90deg,' + stops.map(([t, c]) => c + ' ' + Math.round(t * 100) + '%').join(',') + ')';
document.getElementById('parts').innerHTML = EMBLEM.parts.map(p => '<li><span style="display:grid;gap:4px"><span class="swatch" style="background:' + css(p.front || p.stops) + '"></span>' + (p.back ? '<span class="swatch" style="background:' + css(p.back) + '"></span>' : '') + '</span><span class="pname">' + p.name + (p.kind === 'rod' ? ' (twisted rod)' : ' (sphere)') + '</span></li>').join('');
/* build: the engine's sliced generator, a few ms a frame, then mesh each part in chunks as the headset does */
let buildId = 0;
async function build() {
  const id = ++buildId; document.getElementById('progress').hidden = false; document.getElementById('det').textContent = detail + ' mm';
  while (turn.children.length) { const m = turn.children.pop(); m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const t0 = performance.now(), g = buildEmblemGen({ height: 0.42, h: detail / 1000 }); let r, steps = 0;
  do { const tf = performance.now(); do { r = g.next(); steps++; } while (!r.done && performance.now() - tf < 12); document.getElementById('pbar').style.width = Math.min(92, steps / (detail >= 4 ? 110 : detail >= 2.5 ? 330 : 900)) + '%'; await new Promise(q => requestAnimationFrame(q)); if (id !== buildId) return; } while (!r.done);
  document.getElementById('ptext').textContent = 'Turning clay into triangles…'; await new Promise(q => requestAnimationFrame(q));
  let tris = 0; const N = 16;
  for (const part of r.value) {
    const f = part.field, bb = f.bounds(); if (!bb) continue; const grp = new T.Group(), mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.02 });
    for (let cz = Math.ceil((bb[2] - N) / N); cz <= Math.floor((bb[5] + 1) / N); cz++) for (let cy = Math.ceil((bb[1] - N) / N); cy <= Math.floor((bb[4] + 1) / N); cy++) for (let cx = Math.ceil((bb[0] - N) / N); cx <= Math.floor((bb[3] + 1) / N); cx++) {
      const rd = f.read(cx * N - 1, cy * N - 1, cz * N - 1, N + 2, N + 2, N + 2), m = meshChunk(rd.d, rd.c, N + 2, cx * N - 1, cy * N - 1, cz * N - 1, f.h); if (!m.tris) continue;
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(m.position, 3)); geo.setAttribute('normal', new T.BufferAttribute(m.normal, 3)); geo.setAttribute('color', new T.BufferAttribute(m.color, 3)); geo.setIndex(new T.BufferAttribute(m.index, 1)); grp.add(new T.Mesh(geo, mat)); tris += m.tris;
    }
    turn.add(grp);
  }
  document.getElementById('tris').textContent = tris.toLocaleString('en-US'); document.getElementById('ms').textContent = (performance.now() - t0 < 1000 ? Math.round(performance.now() - t0) + ' ms' : ((performance.now() - t0) / 1000).toFixed(1) + ' s');
  document.getElementById('pbar').style.width = '100%'; document.getElementById('progress').hidden = true;
}
let last = performance.now(), angle = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  k = Math.max(0, Math.min(1, k + (spinOn && !dragging ? dt : -dt) / 1.2)); angle += dt * k * Math.PI * 2 / T_TURN;
  turn.rotation.set(pitch, angle + yaw, 0); renderer.render(scene, cam); requestAnimationFrame(loop);
}
requestAnimationFrame(loop); build();
</script>
`;
fs.writeFileSync(process.argv[2], page); console.log('wrote', process.argv[2], (page.length / 1024).toFixed(0) + ' kB');
