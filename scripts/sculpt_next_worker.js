/* sculpt_next_worker.js: meshes clay chunks off the page's own thread, so a long stroke never holds up a frame (Ruth's rule: never under 20 frames a second, aim 72).
   The page sends { id, jobs: [{ key, ver, d, c, n, i0, j0, k0, h }] } and gets back { id, out: [{ key, ver, position, normal, color, index }] }; the arrays move, they are not copied. */
import { meshChunk } from './sculpt_next_mesher.js';
self.onmessage = e => {
  const { id, jobs } = e.data, out = [], move = [];
  for (const j of jobs) { const m = meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h); out.push({ key: j.key, layer: j.layer, ver: j.ver, position: m.position, normal: m.normal, color: m.color, index: m.index }); move.push(m.position.buffer, m.normal.buffer, m.color.buffer, m.index.buffer); }
  self.postMessage({ id, out }, move);
};
