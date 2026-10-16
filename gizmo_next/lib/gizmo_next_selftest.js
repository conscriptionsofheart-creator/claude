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
files.sort((a, b) => {
  const ia = ORDER.indexOf(stageOf(a).toUpperCase().replace(/^H(\d+)$/, 'H$1')), ib = ORDER.indexOf(stageOf(b).toUpperCase().replace(/^H(\d+)$/, 'H$1'));
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
});
const T = kit.makeT();
let ran = 0;
files.forEach(f => {
  let mod;
  try { mod = require(path.join(__dirname, f)); } catch (e) { T.error(stageOf(f) + '_load', e); return; }
  if (!mod || typeof mod.run !== 'function') { T.error(stageOf(f) + '_load', 'no run(T, kit) exported'); return; }
  if (only.length && only.indexOf(mod.section) < 0 && only.indexOf(mod.stage) < 0) return;
  console.log('== ' + (mod.stage || stageOf(f)) + ' (' + (mod.section || '') + ') ==');
  ran++;
  try { mod.run(T, kit); } catch (e) { T.error((mod.section || stageOf(f)) + '_run', e); }
});
if (!ran && only.length) { T.check('runner_found_stage_' + only.join('_'), false); }
T.finish();
