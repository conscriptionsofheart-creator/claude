/* SCULPT ENGINE SLOT (Ruth 2026-10-13). This file is what the Atelier and the BSA load when the Sculpt menu says "Engine: next".
   Until new code is dropped in, it hands back the current engine, so switching to "next" changes nothing.
   To plug in a new engine: replace this file (and add any helper files beside it in lib/, named sculpt_next_*.js (the server serves lib/ flat, no sub-folders)), then in the headset open Sculpt > More tools > "Engine: next" and re-enter Sculpt.
   CONTRACT, same as the current engine (lib/bst_vr_sculpt.js):
     export function createVrSculpt(THREE, core, host)   -> the engine object (cfg, set, enter, leave, frame, undo, redo, save, setFilter, filtered, cutAt, repose, ...). See lib/sculpt_next_README.md for the full list and what each does.
     export function makeSculpt(THREE)                   -> OPTIONAL: your own core (stroke maths). If you leave it out, lib/bst_sculpt_core.js is used.
   host = { say, figure, setBench, stampSource, props, sources, addObject, removeObject, strokeStart, dirty }  (the page gives you these). */
export * from '/pe_lib/bst_vr_sculpt.js?v=wr7';
