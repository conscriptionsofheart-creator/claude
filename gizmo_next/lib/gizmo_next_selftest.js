/* gizmo_next_selftest.js: the runner. node gizmo_next_selftest.js [--only=core,trigger]
   It finds every gizmo_next_<stage>_selftest.js in this folder (G0 first, then H1 to H12), runs each one's run(T, kit) and prints one line per check.
   A check prints "name: 1" (pass), "name: 0" (fail) or a measurement. The last line is RESULT passed/total. Exit code 1 if any check fails.
   --only=core,trigger runs just the stages whose section is named (core is G0). No headset, no real three.js, no network. */
'use strict';
const fs = require('fs'), path = require('path');
const kit = require('./gizmo_next_testkit.js');
const ORDER = ['G0', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'H12'];
const arg = process.argv.find(a => a.indexOf('--only=') === 0);
const only = arg ? arg.slice(7).split(',').map(s => s.trim()).filter(Boolean) : [];
const files = fs.readdirSync(__dirname).filter(f => /^gizmo_next_.+_selftest\.js$/.test(f) && f !== 'gizmo_next_selftest.js');
const stageOf = f => f.replace(/^gizmo_next_/, '').replace(/_selftest\.js$/, '');
/* stage order comes from the order of the stage names, not from the file name (H1's file is gizmo_next_beats_selftest.js) */
const loaded = files.map(f => { let mod = null, err = null; try { mod = require(path.join(__dirname, f)); } catch (e) { err = e; } return { f, mod, err }; });
const rank = x => { const i = ORDER.indexOf(String((x.mod && x.mod.stage) || stageOf(x.f)).toUpperCase()); return i < 0 ? 99 : i; };
loaded.sort((a, b) => rank(a) - rank(b) || a.f.localeCompare(b.f));
const T = kit.makeT();
let ran = 0;
loaded.forEach(({ f, mod, err }) => {
  if (err) { T.error(stageOf(f) + '_load', err); return; }
  if (!mod || typeof mod.run !== 'function') { T.error(stageOf(f) + '_load', 'no run(T, kit) exported'); return; }
  if (only.length && only.indexOf(mod.section) < 0 && only.indexOf(mod.stage) < 0) return;
  console.log('== ' + (mod.stage || stageOf(f)) + ' (' + (mod.section || '') + ') ==');
  ran++;
  try { mod.run(T, kit); } catch (e) { T.error((mod.section || stageOf(f)) + '_run', e); }
});
if (!ran && only.length) { T.check('runner_found_stage_' + only.join('_'), false); }
T.finish();
