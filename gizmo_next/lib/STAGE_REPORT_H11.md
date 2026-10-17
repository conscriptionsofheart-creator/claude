# STAGE REPORT H11: small gaps

**Done.** `gizmo_next_small.js` (Text sign, Door, material check, light budget, mirror cost, camera fade, sound pitch), `objcfg_mats_patch.json`, selftest, demo, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Text cap 1000 and Auto Fit, Door gated by live and sharing, 21 lights warn and 20 do not, bigger mirror radius costs more, camera cuts become a 0.4 s dip kept 0.4 s apart, pitch and min distance clamp and reach `ctx.sounds.set`.

**Selftest.** 17/17 (291/291 with earlier stages), in node and the demo page in headless Chromium.

**Untested.** Real scenes, camera, mirrors, sounds and `ObjCfg`, how the sign reads on a Quest, frame cost.

**The seat wires in.** H11-1 merge the materials patch; `ctx.openScene`, `sharedScenes`, `sceneList`, `lights`, `camera.shots/shot/fade`, `sounds.set`; the panel rows.

**Open facts, defaults used.**
1. Material numbers are the stage file's; Super ice friction 0.15 is below Ice on purpose.
2. Text width estimated at 0.52 of the letter size.
3. Camera shots in `camera_beats.js` are per line, so `shots()` has to name them.

**One question.** Is Super ice meant to be slipperier than Ice? If no answer, it stays.
