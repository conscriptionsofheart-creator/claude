# STAGE REPORT G0: the plug-in kit

**What exists.** The core (`gizmo_next_core.js`), a three.js stub, a testkit, a runner, the selftest, the demo page, the host template, a test-only Probe box part, README, CHANGES, RAY SPEC, wiki card with its change row, lesson draft, assets line.

**Selftest.** 44/44 in node. 44/44 again in the demo page, opened from a file in headless Chromium, with no console error and no outside request.

**Cost.** About 0.003 ms a tick with 12 live armed gizmos (limit 0.05, on the stub).

**Not verified.** Real three.js drawing. The real `gizmos.js`, `vr_objects.js` and `vr_core.js`. Real grab, resize and Undo on a gizmo. Headset tile size. Real RoomSync between two tabs. Quest frame cost.

**The seat wires in.** Edits E1 to E13 of the contract, plus G0-1 (tile picture), G0-2 (list rows, optional), G0-3 (check Undo), G0-4 (load the Probe box for the ray test, then remove it). Then the ray test in `gizmo_next_G0_RAY_SPEC.md`.

**Open facts, defaults used.**
1. `Gizmos.thumb` has no hook, so the core draws its own tile picture (edit G0-1).
2. The headset has no tile for Gizmos live in the contract, so it is a Settings page.
3. Gizmo boxes are hidden on a friend's page, and a friend cannot place, copy or delete.
4. Cap of 12 for each kind.

**One question.** Is Settings the right place to turn Gizmos live on? If you do not answer, it stays there.
