# STAGE REPORT H10: scripting layer

**Done.** `gizmo_next_script.js`, `gizmo_next_blocks.js`, `gizmo_next_templates.js` (five templates), a test model of `obj_scripts.js`, selftest, demo, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Fields as rows, events between scripts, enter and leave, raycast by tag, spawn budget 20, scene variables, visitor counts off by default, blocks that write code and grey out when the code is edited, a log with the running block, Test it with me. Nothing runs on open; Scripts off stops timers and puts things back.

**Selftest.** 19/19 (274/274 with earlier stages), in node and the demo page in headless Chromium.

**Untested.** The real `obj_scripts.js` with the two edits, `atelier_scripts.js` (not in the package), real raycast, spawn and show or hide, Quest frame cost.

**The seat wires in.** H10-1 in `obj_scripts.js` `make()` and `setOn(false)`, H10-2 `mountBlocks` and `codeEdited` in the Scripts tab, and `ctx.spawnObject`, `despawnObject`, `objectVisible`, `raycast`, `objCfg.setCode`.

**Open facts, defaults used.**
1. `fields = {...}` cannot work; `fields({...})` is used.
2. `onEnter` and `onLeave` are extra names beyond the four listed.
3. Without `ctx.objectVisible`, Scripts off sets shown or hidden back to the opposite.
