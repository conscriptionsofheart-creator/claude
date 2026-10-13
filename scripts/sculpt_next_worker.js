/* sculpt_next_worker.js: the heavy work off the page's own thread, so the headset keeps its frame rate (Ruth's rule: never under 20 frames a second, aim 72).
   { type: 'mesh', id, jobs: [{ layer, key, ver, d, c, n, i0, j0, k0, h }] }  -> { type: 'mesh', id, out: [{ layer, key, ver, position, normal, color, index }] }   clay chunks to triangles
   { type: 'voxel', id, tris, h, band, base }                                -> { type: 'voxel', id, r: { d, c, i0, j0, k0, nx, ny, nz } | null }                    Make clay, a stamp into clay
   { type: 'decimate', id, src, target }                                     -> { type: 'decimate', id, r: { position, index, color, uv, before, after } }           a lighter copy for a save
   Big arrays move between the threads, they are not copied. */
import { meshChunk } from './sculpt_next_mesher.js';
import { voxelizeTris } from './sculpt_next_sdf.js';
import { decimateArrays } from './sculpt_next_decimate.js';
self.onmessage = e => {
  const m = e.data, move = [];
  try {
    if (m.type === 'voxel') { const r = voxelizeTris(m.tris, m.h, m.band, m.base); if (r) move.push(r.d.buffer, r.c.buffer); self.postMessage({ type: 'voxel', id: m.id, r }, move); return; }
    if (m.type === 'decimate') { const r = decimateArrays(m.src, m.target); [r.position, r.index, r.color, r.uv].forEach(a => { if (a && a.buffer && !move.includes(a.buffer)) move.push(a.buffer); }); self.postMessage({ type: 'decimate', id: m.id, r }, move); return; }
    const out = []; for (const j of m.jobs) { const r = meshChunk(j.d, j.c, j.n, j.i0, j.j0, j.k0, j.h); out.push({ key: j.key, layer: j.layer, ver: j.ver, position: r.position, normal: r.normal, color: r.color, index: r.index }); move.push(r.position.buffer, r.normal.buffer, r.color.buffer, r.index.buffer); }
    self.postMessage({ type: 'mesh', id: m.id, out }, move);
  } catch (err) { self.postMessage({ type: m.type || 'mesh', id: m.id, error: String(err && err.message || err) }); }
};
