/* sculpt_next_store.js: KEEP WORK, so clay stays clay after Sculpt closes (the Quest report: "glTF is not sufficient to preserve editable clay"; keep the native work as data).
   The work (clay bricks, rods, balls, the emblem, their looks and spins) is kept in the headset browser's own database (IndexedDB), on this headset only, and opened again as editable clay.
   A .glb (Save clay) is still the way to put a finished piece in the library. Figures are not kept here: they are saved with Save figure as before. */
const DB = 'sculpt_next', STORE = 'works';
function open() {
  return new Promise((ok, no) => { if (typeof indexedDB === 'undefined') { no(new Error('This browser keeps no data')); return; } const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}
const tx = (mode, fn) => open().then(d => new Promise((ok, no) => { const t = d.transaction(STORE, mode), s = t.objectStore(STORE), out = fn(s); t.oncomplete = () => { d.close(); ok(out && out.result !== undefined ? out.result : out); }; t.onerror = () => { d.close(); no(t.error); }; }));
/* keep: { name, data } -> its id */
export function keepWork(name, data) { const id = Date.now(); return tx('readwrite', s => { s.put({ id, name: String(name || 'Work').slice(0, 40), when: id, data }); return { result: id }; }); }
/* the kept works, newest first: [{ id, name, when, bytes }] (the data stays in the database until opened) */
export function listWorks() {
  return open().then(d => new Promise((ok, no) => { const out = [], t = d.transaction(STORE, 'readonly'), c = t.objectStore(STORE).openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { const v = cur.value; out.push({ id: v.id, name: v.name, when: v.when, bytes: JSON.stringify(v.data).length }); cur.continue(); } }; t.oncomplete = () => { d.close(); ok(out.sort((a, b) => b.when - a.when)); }; t.onerror = () => { d.close(); no(t.error); }; }));
}
export function loadWork(id) { return open().then(d => new Promise((ok, no) => { const r = d.transaction(STORE, 'readonly').objectStore(STORE).get(id); r.onsuccess = () => { d.close(); ok(r.result || null); }; r.onerror = () => { d.close(); no(r.error); }; })); }
export function forgetWork(id) { return tx('readwrite', s => { s.delete(id); return { result: true }; }); }
