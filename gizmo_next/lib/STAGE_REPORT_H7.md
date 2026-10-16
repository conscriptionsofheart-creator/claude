# STAGE REPORT H7: walk, run, jump, fly gaps

**Done.** `gizmo_next_walk.js` (pure `WalkModel` plus a `walk` part with Settings rows), selftest, demo buttons, README, CHANGES, RAY SPEC, wiki card and change row, lesson draft. Speed 0 to 45, gravity 0 to 9.81 (0 floats), run, jump, crouch (camera only), fly (up and down, no wall collision, floor holds, cap, drops to floor), comfort vignette 0 to 0.6 with at most 0.025 a frame, seat holds still.

**Selftest.** 17/17 (212/212 with earlier stages), in node and the demo page in headless Chromium.

**Untested.** The real stick and Fly buttons, collision in the app, drawing the vignette, Quest frame cost.

**The seat wires in.** Check Settings for Speed and Gravity first; if rows exist, take only the model. Call `walk.stepNow` per frame, pass `seated`, draw `vignette`.

**Open facts, defaults used.**
1. Speed and Gravity rows in Settings: unconfirmed, a check row is shown.
2. Run 1.8x, fly cap 12 m/s, jump 0.5 m are my defaults.
3. The Carried comfort rules are not in the package; only the vignette is built.
