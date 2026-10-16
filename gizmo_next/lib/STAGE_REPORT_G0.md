# STAGE REPORT G0: the plug-in kit

**What exists.** The core, a three.js stub, a testkit, a runner, the selftest, the demo page, the host template, a test-only Probe box, README, CHANGES, RAY SPEC, and the wiki, lesson and assets files.

**Selftest.** 44/44 in node. 44/44 in the demo page, opened from a file in headless Chromium, no console error.

**Cost.** About 0.003 ms a tick with 12 live armed gizmos (limit 0.05, on the stub).

**Not verified.** Real three.js drawing. The real `gizmos.js`, `vr_objects.js`, `vr_core.js`. Real grab, resize and Undo on a gizmo. Headset tile size. Real RoomSync. Quest frame cost.

**The seat wires in.** Contract edits E1 to E13, plus G0-1 (tile picture), G0-2 (list rows, optional), G0-3 (check Undo), G0-4 (load the Probe box for the ray test, then remove it). Then `gizmo_next_G0_RAY_SPEC.md`.

**Open facts, defaults used.**
1. `Gizmos.thumb` has no hook, so the core draws its own tile picture.
2. Gizmos live is a Settings page, since the contract names no tile.
3. A friend's page hides the boxes and cannot place, copy or delete.
4. Cap of 12 for each kind.

**One question.** Is Settings the right place for Gizmos live? If no answer, it stays.
